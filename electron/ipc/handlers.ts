import { dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import type {
  DeployMode,
  DeployTarget,
  Device,
  Platform,
  SdkPaths,
} from "../../shared/ipc";
import { store } from "../store";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/errors";
import type { PlatformAdapter } from "../platforms/types";
import {
  tizenAdapter,
  listTizenProfiles,
  deleteTizenProfile,
} from "../platforms/tizen";
import { webosAdapter } from "../platforms/webos";
import { androidAdapter } from "../platforms/android";

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

/** Registers an IPC handler whose thrown errors are returned as `{ success: false, message }`. */
export function handle<Args extends unknown[]>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: Args) => Promise<object | void>
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { success: true, ...(await fn(event, ...(args as Args))) };
    } catch (error) {
      logger.error(`${channel} failed`, getErrorMessage(error));
      return { success: false, message: getErrorMessage(error) };
    }
  });
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
      const log = (line: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("deploy-log", line);
        }
      };
      return {
        message: await adapterFor(platform).deploy(device, target, mode, log),
      };
    }
  );

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
