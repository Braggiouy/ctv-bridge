import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "fs/promises";
import {
  registerTizenHandlers,
  testTizenConnection,
  buildTizenPackage,
  deployTizenApp,
} from "./tizen/handlers";
import {
  registerWebOsHandlers,
  testWebOsConnection,
  buildWebOsPackage,
  deployWebOsApp,
} from "./webos/handlers";
import * as secureStorage from "../common/secure-storage";

export function registerIpcHandlers() {
  registerTizenHandlers();
  registerWebOsHandlers();

  ipcMain.handle("select-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select Project Directory",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(
    "test-connection",
    async (
      _event,
      platform: string,
      identifier: string,
      passphrase?: string
    ) => {
      try {
        if (platform === "tizen") {
          return await testTizenConnection(identifier);
        } else if (platform === "webos") {
          return await testWebOsConnection(identifier, passphrase);
        }
        return { success: false, message: "Unknown platform" };
      } catch (error: any) {
        return {
          success: false,
          message: error.message || "Connection failed",
        };
      }
    }
  );

  ipcMain.handle(
    "build-package",
    async (_event, platform: string, projectPath: string) => {
      try {
        await fs.access(projectPath);
        if (platform === "tizen") {
          return await buildTizenPackage(projectPath);
        } else if (platform === "webos") {
          return await buildWebOsPackage(projectPath);
        }
        return { success: false, message: "Unknown platform" };
      } catch (error: any) {
        return { success: false, message: error.message || "Build failed" };
      }
    }
  );

  ipcMain.handle(
    "deploy-app",
    async (
      _event,
      platform: string,
      identifier: string,
      projectPath: string,
      mode: "debug" | "run"
    ) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const sendLog = (message: string) => {
        if (mainWindow) mainWindow.webContents.send("deploy-log", message);
      };
      try {
        sendLog(`[${new Date().toLocaleTimeString()}] Starting deployment...`);
        if (platform === "tizen") {
          return await deployTizenApp(identifier, projectPath, mode, sendLog);
        } else if (platform === "webos") {
          return await deployWebOsApp(identifier, projectPath, mode, sendLog);
        }
        return { success: false, message: "Unknown platform" };
      } catch (error: any) {
        const errorMessage = error.message || "Deployment failed";
        sendLog(`[${new Date().toLocaleTimeString()}] ERROR: ${errorMessage}`);
        return { success: false, message: errorMessage };
      }
    }
  );

  // Secure storage handlers
  ipcMain.handle(
    "save-passphrase",
    async (_event, deviceName: string, passphrase: string) => {
      try {
        await secureStorage.savePassphrase(deviceName, passphrase);
        return { success: true };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  );

  ipcMain.handle("get-passphrase", async (_event, deviceName: string) => {
    try {
      const passphrase = await secureStorage.getPassphrase(deviceName);
      return { success: true, passphrase };
    } catch (error: any) {
      return { success: false, message: error.message, passphrase: null };
    }
  });

  ipcMain.handle("delete-passphrase", async (_event, deviceName: string) => {
    try {
      await secureStorage.deletePassphrase(deviceName);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle("get-all-device-names", async () => {
    try {
      const deviceNames = await secureStorage.getAllDeviceNames();
      return { success: true, deviceNames };
    } catch (error: any) {
      return { success: false, message: error.message, deviceNames: [] };
    }
  });

  ipcMain.handle("is-secure-storage-available", async () => {
    return {
      success: true,
      available: secureStorage.isSecureStorageAvailable(),
    };
  });
}
