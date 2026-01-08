import { ipcMain } from "electron";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function registerSdkCheckHandlers() {
  // Check if Tizen SDK commands are available
  ipcMain.handle("check-tizen-sdk", async () => {
    try {
      // Check for sdb command
      await execAsync("which sdb");
      // Check for tizen command
      await execAsync("which tizen");

      // Try to get version to ensure they're working
      const { stdout: sdbVersion } = await execAsync("sdb version");

      return {
        available: true,
        sdbVersion: sdbVersion.trim(),
      };
    } catch {
      return {
        available: false,
        error:
          "Tizen SDK commands not found. Please ensure Tizen Studio is installed and in your PATH.",
      };
    }
  });

  // Check if webOS SDK commands are available
  ipcMain.handle("check-webos-sdk", async () => {
    try {
      // Check for ares commands
      await execAsync("which ares-package");
      await execAsync("which ares-install");
      await execAsync("which ares-launch");

      // Try to get version
      const { stdout: aresVersion } = await execAsync("ares-package --version");

      return {
        available: true,
        aresVersion: aresVersion.trim(),
      };
    } catch {
      return {
        available: false,
        error:
          "webOS CLI commands not found. Please ensure webOS TV SDK is installed and in your PATH.",
      };
    }
  });
}
