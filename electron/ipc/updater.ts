import { app, BrowserWindow, net, shell } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  createReadStream,
  createWriteStream,
} from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import type {
  EventChannel,
  IpcEventChannels,
  UpdateDownloadResult,
} from "../../shared/ipc";
import { releaseUrl, REPO_URL } from "../../shared/links";
import { runCli } from "../utils/cli";
import { logger } from "../utils/logger";
import { handle, handleRaw, sendTo } from "./handle";

const FIRST_CHECK_DELAY_MS = 5_000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const isMac = process.platform === "darwin";

let latestUpdate: UpdateInfo | null = null;
/** macOS: the extracted new app bundle, waiting to replace the running one. */
let stagedMacApp: string | null = null;

function broadcast<C extends EventChannel>(
  channel: C,
  payload: IpcEventChannels[C]
) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) sendTo(win.webContents, channel, payload);
  }
}

/** The running .app bundle, if macOS lets us overwrite it in place. */
function replaceableMacBundle(): string | null {
  const bundle = path.resolve(app.getPath("exe"), "../../..");
  // Opened from the DMG or from a translocated (quarantined) copy.
  if (
    !bundle.endsWith(".app") ||
    /^\/Volumes\/|\/AppTranslocation\//.test(bundle)
  ) {
    return null;
  }
  try {
    accessSync(path.dirname(bundle), constants.W_OK);
    accessSync(bundle, constants.W_OK);
    return bundle;
  } catch {
    return null;
  }
}

/**
 * Where the update can be applied by the app itself. Ad-hoc signed macOS builds
 * can't use Squirrel.Mac (it requires a Developer ID), so macOS swaps the bundle
 * itself; Linux can only self-update when running as an AppImage.
 */
function canSelfUpdate(): boolean {
  if (isMac) return replaceableMacBundle() !== null;
  if (process.platform === "linux") return !!process.env.APPIMAGE;
  return true;
}

export function registerUpdater(checkPeriodically: boolean) {
  // Windows/Linux download in the background and install on quit or restart.
  autoUpdater.autoDownload = !isMac && canSelfUpdate();
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    latestUpdate = info;
    broadcast("updater:available", { version: info.version });
  });
  autoUpdater.on("download-progress", ({ percent }) =>
    broadcast("updater:progress", Math.round(percent))
  );
  autoUpdater.on("update-downloaded", ({ version }) =>
    broadcast("updater:ready", { version })
  );
  autoUpdater.on("error", (error) => logger.error("Auto-updater error", error));

  handle("updater:check", async () => {
    const result = await autoUpdater.checkForUpdates();
    return {
      version: result?.isUpdateAvailable
        ? result.updateInfo.version
        : undefined,
    };
  });

  handle("updater:download", async () => {
    if (!latestUpdate) throw new Error("No update available");
    // Older releases ship only the DMG on macOS.
    const hasMacZip = latestUpdate.files.some((f) => f.url.endsWith(".zip"));
    if (!canSelfUpdate() || (isMac && !hasMacZip)) {
      return installManually(latestUpdate);
    }
    if (isMac) {
      stagedMacApp = await downloadMacApp(latestUpdate);
      broadcast("updater:ready", { version: latestUpdate.version });
    } else {
      await autoUpdater.downloadUpdate();
    }
  });

  handleRaw("updater:install", () => {
    if (isMac) swapMacAppAndRelaunch();
    else autoUpdater.quitAndInstall();
  });
  handleRaw("updater:get-version", () => app.getVersion());

  if (checkPeriodically) {
    const check = () =>
      autoUpdater
        .checkForUpdates()
        .catch((error) => logger.error("Update check failed", error));
    setTimeout(check, FIRST_CHECK_DELAY_MS);
    setInterval(check, CHECK_INTERVAL_MS);
  }
}

/** The release asset for this platform/arch with the given extension. */
function findAsset(info: UpdateInfo, extension: string) {
  const files = info.files.filter((f) => f.url.endsWith(extension));
  const file = files.find((f) => f.url.includes(process.arch)) ?? files[0];
  if (!file)
    throw new Error(`No ${extension} file found in release ${info.version}`);
  return file;
}

/** Downloads a release asset, reporting progress and checking its sha512. */
async function downloadAsset(
  info: UpdateInfo,
  extension: string,
  directory: string
) {
  const file = findAsset(info, extension);
  const response = await net.fetch(
    `${REPO_URL}/releases/download/v${info.version}/${file.url}`
  );
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (HTTP ${response.status})`);
  }

  const total =
    Number(response.headers.get("content-length")) || file.size || 0;
  let received = 0;
  let lastPercent = -1;
  const progress = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      const percent = total ? Math.floor((received / total) * 100) : 0;
      if (percent !== lastPercent)
        broadcast("updater:progress", (lastPercent = percent));
      callback(null, chunk);
    },
  });

  const target = path.join(directory, path.basename(file.url));
  await pipeline(
    Readable.fromWeb(response.body as ReadableStream),
    progress,
    createWriteStream(target)
  );

  const hash = createHash("sha512");
  await pipeline(createReadStream(target), hash);
  if (hash.digest("base64") !== file.sha512) {
    await rm(target, { force: true });
    throw new Error(
      "The downloaded update is corrupted (checksum mismatch). Try again."
    );
  }
  return target;
}

/** Downloads and unpacks the new app next to the temp dir, verifying it's really CTV Bridge. */
async function downloadMacApp(info: UpdateInfo): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ctv-bridge-update-"));
  const zip = await downloadAsset(info, ".zip", directory);
  await runCli("ditto", ["-x", "-k", zip, directory]);
  await rm(zip, { force: true });

  const bundleName = (await readdir(directory)).find((name) =>
    name.endsWith(".app")
  );
  if (!bundleName) throw new Error("The update doesn't contain an app");
  const bundle = path.join(directory, bundleName);

  const { stdout } = await runCli("plutil", [
    "-extract",
    "CFBundleIdentifier",
    "raw",
    path.join(bundle, "Contents/Info.plist"),
  ]);
  if (stdout.trim() !== "com.ctv.bridge")
    throw new Error("The update isn't a CTV Bridge build");
  await runCli("codesign", ["--verify", "--deep", "--strict", bundle]);
  return bundle;
}

/** Replaces the running bundle once this process exits, then opens the new version. */
function swapMacAppAndRelaunch() {
  const target = replaceableMacBundle();
  if (!stagedMacApp || !target)
    throw new Error("No update is ready to install");

  const script = `
    while kill -0 "$1" 2>/dev/null; do sleep 0.2; done
    backup="$3.previous"
    rm -rf "$backup"
    if mv "$3" "$backup" && mv "$2" "$3"; then
      rm -rf "$backup" "$(dirname "$2")"
    elif [ -d "$backup" ] && [ ! -d "$3" ]; then
      mv "$backup" "$3"
    fi
    open "$3"
  `;
  spawn(
    "/bin/bash",
    [
      "-c",
      script,
      "ctv-bridge-update",
      String(process.pid),
      stagedMacApp,
      target,
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  ).unref();
  app.quit();
}

/** Fallback when the app can't replace itself: hand the installer (or release page) to the user. */
async function installManually(
  info: UpdateInfo
): Promise<UpdateDownloadResult> {
  if (!isMac) {
    await shell.openExternal(releaseUrl(info.version));
    return { success: true, manual: "release-page" };
  }
  const dmg = await downloadAsset(info, ".dmg", app.getPath("downloads"));
  const openError = await shell.openPath(dmg);
  if (openError) throw new Error(openError);
  return { success: true, manual: "installer" };
}
