import { app, ipcMain, net, shell } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

const RELEASES_DOWNLOAD_URL =
  "https://github.com/Braggiouy/ctv-bridge/releases/download";

let latestUpdate: UpdateInfo | null = null;

export function registerUpdaterHandlers() {
  // Covers both the startup check in main.ts and manual checks
  autoUpdater.on("update-available", (info) => {
    latestUpdate = info;
  });

  // Check for updates
  ipcMain.handle("check-for-updates", async () => {
    return await checkForUpdates();
  });

  // Download update
  ipcMain.handle("download-update", async () => {
    return await downloadUpdate();
  });

  // Install update and restart
  ipcMain.handle("install-update", () => {
    installUpdate();
  });

  // Get current version
  ipcMain.handle("get-app-version", () => {
    return getAppVersion();
  });
}

export async function checkForUpdates() {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo || null;
  } catch (error) {
    console.error("Error checking for updates:", error);
    return null;
  }
}

export async function downloadUpdate() {
  try {
    // Ad-hoc signed macOS builds can't replace themselves (Squirrel.Mac requires a
    // stable signature), so download the DMG and open it for the user instead
    if (process.platform === "darwin") {
      await downloadAndOpenDmg();
      return { success: true, installerOpened: true };
    }
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error("Error downloading update:", error);
    return { success: false, error: String(error) };
  }
}

async function downloadAndOpenDmg() {
  if (!latestUpdate) throw new Error("No update available");

  const dmgs = latestUpdate.files.filter((f) => f.url.endsWith(".dmg"));
  const dmg = dmgs.find((f) => f.url.includes(process.arch)) ?? dmgs[0];
  if (!dmg) throw new Error("No macOS installer found in this release");

  const response = await net.fetch(
    `${RELEASES_DOWNLOAD_URL}/v${latestUpdate.version}/${dmg.url}`
  );
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (HTTP ${response.status})`);
  }

  const target = path.join(app.getPath("downloads"), dmg.url);
  await pipeline(
    Readable.fromWeb(response.body as ReadableStream),
    createWriteStream(target)
  );

  const openError = await shell.openPath(target);
  if (openError) throw new Error(openError);
}

export function installUpdate() {
  autoUpdater.quitAndInstall();
}

export function getAppVersion() {
  return autoUpdater.currentVersion.version;
}
