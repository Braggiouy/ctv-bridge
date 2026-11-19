import fs from "node:fs/promises";
import path from "node:path";
import { app, clipboard, dialog, ipcMain, nativeImage, shell } from "electron";
import type {
  DeployMode,
  DeployTarget,
  Device,
  Platform,
  RemoteKey,
  SdkPaths,
} from "../../shared/ipc";
import { store } from "../store";
import {
  captureAppScreen,
  openInspectorForApp,
  pressRemoteKey,
  startAppConsole,
  stopAppConsole,
} from "../app-console";
import { getErrorMessage } from "../utils/errors";
import { handle, replyLog } from "./handle";
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

export function registerIpcHandlers() {
  handle("devices:list", async (_e, platform: Platform) => ({
    devices: await adapterFor(platform).listDevices(),
  }));
  handle("devices:add", async (_e, platform: Platform, device: Device) => ({
    message: await adapterFor(platform).addDevice(device),
  }));
  handle(
    "devices:update",
    async (_e, platform: Platform, previous: Device, next: Device) =>
      adapterFor(platform).updateDevice(previous, next)
  );
  handle("devices:remove", async (_e, platform: Platform, device: Device) =>
    adapterFor(platform).removeDevice(device)
  );
  handle("devices:test", async (_e, platform: Platform, device: Device) =>
    adapterFor(platform).testConnection(device)
  );
  handle("devices:discover", async (_e, platform: Platform) => ({
    tvs: await discoverTvs(platform),
  }));

  ipcMain.handle("sdk:get-paths", () => store.getAll());
  handle("sdk:save-paths", async (_e, paths: SdkPaths) => store.setAll(paths));
  handle("sdk:verify", async (_e, platform: Platform) => {
    const tools = await adapterFor(platform).verifySdk();
    const failed = tools.filter((tool) => !tool.ok);
    return {
      tools,
      success: failed.length === 0,
      message: failed.map((tool) => `${tool.tool}: ${tool.detail}`).join("\n"),
    };
  });

  handle(
    "package:build",
    async (
      _e,
      platform: Platform,
      projectPath: string,
      profileName?: string
    ) => {
      const packagePath = await adapterFor(platform).build(
        projectPath,
        profileName
      );
      return { packagePath };
    }
  );
  handle(
    "package:deploy",
    async (
      event,
      platform: Platform,
      device: Device,
      target: DeployTarget,
      mode: DeployMode
    ) => {
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
        await startAppConsole(
          outcome.inspectorUrl,
          platform,
          event.sender
        ).catch((error) =>
          log(`App logs unavailable: ${getErrorMessage(error)}`)
        );
      }
      return outcome;
    }
  );

  handle("inspector:open", async (_e, url: string) => openInspectorForApp(url));
  handle("app-console:stop", async () => stopAppConsole());
  handle("remote:press", async (_e, key: RemoteKey) => pressRemoteKey(key));
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
  handle("tizen:delete-profile", async (_e, name: string) =>
    deleteTizenProfile(name)
  );

  ipcMain.handle("dialog:select-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dialog:select-file", async (_e, extensions?: string[]) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: extensions?.length ? [{ name: "Files", extensions }] : [],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("shell:open-external", (_e, url: string) => {
    if (/^https?:\/\//.test(url)) return shell.openExternal(url);
  });
  ipcMain.handle("shell:show-in-folder", (_e, target: string) =>
    shell.showItemInFolder(target)
  );
}
