import { ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

export function registerUpdaterHandlers() {
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
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error("Error downloading update:", error);
    return { success: false, error: String(error) };
  }
}

export function installUpdate() {
  autoUpdater.quitAndInstall();
}

export function getAppVersion() {
  return autoUpdater.currentVersion.version;
}
