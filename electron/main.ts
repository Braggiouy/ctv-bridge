import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { autoUpdater } from "electron-updater";
import { registerIpcHandlers } from "./ipc/handlers";
import { registerSdkCheckHandlers } from "./common/sdk-check";
import { registerUpdaterHandlers } from "./ipc/updater/handlers";
import { store } from "./store";
import { WINDOW_CONSTANTS, DEPLOY_CONSTANTS } from "./utils/constants";
import { logger } from "./utils/logger";
import { processManager } from "./utils/process-manager";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");

let win: BrowserWindow | null = null;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

function setupIpcHandlers() {
  // Register IPC handlers
  registerIpcHandlers();
  registerSdkCheckHandlers();
  registerUpdaterHandlers();

  // Register SDK paths handlers
  ipcMain.handle("save-sdk-paths", async (_event, paths) => {
    store.setAll(paths);
    return { success: true };
  });

  ipcMain.handle("get-sdk-paths", async () => {
    return store.getAll();
  });

  // Open external URL in system browser
  ipcMain.handle("open-external", async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });
}

function setupAutoUpdater() {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Disable code signing validation on macOS (since we don't have a paid cert)
  if (process.platform === "darwin") {
    // @ts-expect-error - Property exists at runtime but might be missing in types
    autoUpdater.forceCodeSigning = false;
  }

  // Auto-updater event handlers
  autoUpdater.on("update-available", (info) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("update-available", info);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("update-downloaded", info);
    }
  });

  autoUpdater.on("error", (err) => {
    logger.error("Auto-updater error", err);
    let message = err.message;
    // Handle macOS code signing errors
    if (
      message.includes("Code signature") ||
      message.includes("did not pass validation") ||
      message.includes("firma indica que deben estar presentes")
    ) {
      message =
        "Update failed due to macOS security. Please download the new version manually.";
    }
    if (win && !win.isDestroyed()) {
      win.webContents.send("update-error", message);
    }
  });
}

function setupCsp() {
  // Configure Content Security Policy on the default session
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // In development mode, we need to allow inline scripts for Vite HMR
    const isDevMode = !!VITE_DEV_SERVER_URL;

    const scriptSrc = isDevMode
      ? "'self' 'unsafe-inline' 'unsafe-eval'" // Vite needs these for HMR
      : "'self'"; // Strict for production

    const connectSrc = isDevMode
      ? "'self' https://github.com ws://localhost:*" // Allow websocket for HMR
      : "'self' https://github.com"; // Only GitHub for auto-updater in production

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self';` +
            `script-src ${scriptSrc};` +
            `style-src 'self' 'unsafe-inline';` + // unsafe-inline needed for React inline styles
            `img-src 'self' data:;` +
            `font-src 'self';` +
            `connect-src ${connectSrc};` +
            `frame-src 'none';` +
            `object-src 'none';` +
            `base-uri 'self';`,
        ],
      },
    });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: WINDOW_CONSTANTS.DEFAULT_WIDTH,
    height: WINDOW_CONSTANTS.DEFAULT_HEIGHT,
    minWidth: WINDOW_CONSTANTS.MIN_WIDTH,
    minHeight: WINDOW_CONSTANTS.MIN_HEIGHT,
    title: "CTV Bridge",
    icon: process.env.VITE_PUBLIC
      ? path.join(process.env.VITE_PUBLIC, "logo.png")
      : undefined,
    webPreferences: {
      preload: path.join(__dirname, "../dist-electron/preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("main-process-message", new Date().toLocaleString());
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(process.env.DIST!, "index.html"));
  }

  // Make all outside links open in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Also handle navigation attempts (standard <a> tags)
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win?.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
  win = null;
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  setupIpcHandlers();
  setupAutoUpdater();
  setupCsp();
  createWindow();

  // Check for updates after app is ready (with delay to not slow down startup)
  if (!VITE_DEV_SERVER_URL) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error("Failed to check for updates", err);
      });
    }, DEPLOY_CONSTANTS.UPDATE_CHECK_DELAY_MS);
  }
});
