import { app, BrowserWindow, ipcMain, net, shell } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/errors";
import { DEPLOY_CONSTANTS } from "../utils/constants";

const RELEASES_DOWNLOAD_URL =
  "https://github.com/Braggiouy/ctv-bridge/releases/download";

let latestUpdate: UpdateInfo | null = null;

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function registerUpdater(checkOnStartup: boolean) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    latestUpdate = info;
    broadcast("update-available", info);
  });
  autoUpdater.on("error", (error) => {
    logger.error("Auto-updater error", error);
    broadcast("update-error", error.message);
  });

  ipcMain.handle("updater:check", async () => {
    try {
      return (await autoUpdater.checkForUpdates())?.updateInfo ?? null;
    } catch (error) {
      logger.error("Update check failed", error);
      return null;
    }
  });
  ipcMain.handle("updater:download", async () => {
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
      logger.error("Update download failed", error);
      return { success: false, message: getErrorMessage(error) };
    }
  });
  ipcMain.handle("updater:install", () => autoUpdater.quitAndInstall());
  ipcMain.handle("updater:get-version", () => app.getVersion());

  if (checkOnStartup) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        logger.error("Failed to check for updates", error);
      });
    }, DEPLOY_CONSTANTS.UPDATE_CHECK_DELAY_MS);
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
