import fs from "node:fs/promises";
import path from "node:path";
import { app, clipboard, dialog, nativeImage, shell } from "electron";
import type { Platform } from "../../shared/ipc";
import { store } from "../store";
import {
  captureAppScreen,
  openInspectorForApp,
  pressRemoteKey,
  reloadAppLive,
  startAppConsole,
  stopAppConsole,
} from "../app-console";
import { getErrorMessage } from "../utils/errors";
import { handle, handleRaw, replyLog, sendTo } from "./handle";
import type { PlatformAdapter } from "../platforms/types";
import {
  tizenAdapter,
  listTizenProfiles,
  deleteTizenProfile,
} from "../platforms/tizen";
import { webosAdapter } from "../platforms/webos";
import { androidAdapter } from "../platforms/android";
import { endDebugSession } from "../platforms/common";
import { discoverTvs } from "../platforms/discovery";
import { watchProject } from "../project-watcher";

const adapters: Record<Platform, PlatformAdapter> = {
  tizen: tizenAdapter,
  webos: webosAdapter,
  android: androidAdapter,
};

function adapterFor(platform: Platform): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`Unknown platform: ${platform}`);
  return adapter;
}

/** Stops watching the project for auto-redeploy; one project is watched at a time. */
let stopProjectWatch: () => void = () => undefined;

export function registerIpcHandlers() {
  handle("devices:list", async (_e, platform) => ({
    devices: await adapterFor(platform).listDevices(),
  }));
  handle("devices:add", async (_e, platform, device) => ({
    message: await adapterFor(platform).addDevice(device),
  }));
  handle("devices:update", async (_e, platform, previous, next) =>
    adapterFor(platform).updateDevice(previous, next)
  );
  handle("devices:remove", async (_e, platform, device) =>
    adapterFor(platform).removeDevice(device)
  );
  handle("devices:test", async (_e, platform, device) =>
    adapterFor(platform).testConnection(device)
  );
  handle("devices:discover", async (_e, platform) => ({
    tvs: await discoverTvs(platform),
  }));

  handleRaw("sdk:get-paths", () => store.getAll());
  handle("sdk:save-paths", async (_e, paths) => store.setAll(paths));
  handle("sdk:verify", async (_e, platform) => {
    const tools = await adapterFor(platform).verifySdk();
    const failed = tools.filter((tool) => !tool.ok);
    return {
      tools,
      success: failed.length === 0,
      message: failed.map((tool) => `${tool.tool}: ${tool.detail}`).join("\n"),
    };
  });

  handle("package:build", async (_e, platform, projectPath, profileName) => {
    const packagePath = await adapterFor(platform).build(
      projectPath,
      profileName
    );
    return { packagePath };
  });
  handle("package:deploy", async (event, platform, device, target, mode) => {
    stopAppConsole();
    endDebugSession();
    const log = replyLog(event, "deploy-log");
    const outcome = await adapterFor(platform).deploy(
      device,
      target,
      mode,
      log
    );
    if (outcome.inspectorUrl) {
      await startAppConsole(outcome.inspectorUrl, platform, event.sender).catch(
        (error) => log(`App logs unavailable: ${getErrorMessage(error)}`)
      );
    }
    return outcome;
  });

  handle("project-watch:start", async (event, target) => {
    stopProjectWatch();
    let stop: () => void;
    try {
      stop = watchProject(target, (changed) => {
        sendTo(event.sender, "project-watch:changed", changed);
      });
    } catch {
      throw new Error(`Can't watch ${target}: it no longer exists.`);
    }
    const onWindowClosed = () => stopProjectWatch();
    event.sender.once("destroyed", onWindowClosed);
    stopProjectWatch = () => {
      stop();
      event.sender.off("destroyed", onWindowClosed);
      stopProjectWatch = () => undefined;
    };
  });
  handle("project-watch:stop", async () => stopProjectWatch());

  handle("inspector:open", async (_e, url, background) =>
    openInspectorForApp(url, background)
  );
  handle("app-console:stop", async () => stopAppConsole());
  handle("app-console:live-reload", async (_e, projectPath, changed) => {
    const outcome = await reloadAppLive(projectPath, changed);
    return outcome.reloaded
      ? { reloaded: true }
      : { reloaded: false, message: outcome.reason };
  });
  handle("remote:press", async (_e, key) => pressRemoteKey(key));
  handle("remote:screenshot", async () => {
    const png = await captureAppScreen();
    clipboard.writeImage(nativeImage.createFromBuffer(png));
    const dir = path.join(app.getPath("pictures"), "CTV Bridge");
    await fs.mkdir(dir, { recursive: true });
    // Local time, e.g. screenshot-2026-11-19-14-05-09.png
    const now = new Date();
    const stamp = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 19)
      .replace(/[T:]/g, "-");
    const file = path.join(dir, `screenshot-${stamp}.png`);
    await fs.writeFile(file, png);
    return { path: file };
  });

  handle("tizen:list-profiles", async () => ({
    profiles: await listTizenProfiles(),
  }));
  handle("tizen:delete-profile", async (_e, name) => deleteTizenProfile(name));

  handleRaw("dialog:select-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handleRaw("dialog:select-file", async (_e, extensions) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: extensions?.length ? [{ name: "Files", extensions }] : [],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  handleRaw("shell:open-external", (_e, url) => {
    if (/^https?:\/\//.test(url)) return shell.openExternal(url);
  });
  handleRaw("shell:show-in-folder", (_e, target) =>
    shell.showItemInFolder(target)
  );
}
