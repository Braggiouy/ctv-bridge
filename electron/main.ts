import { app, BrowserWindow, session, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc/handlers";
import { endDebugSession } from "./platforms/common";
import { registerTizenCertHandlers } from "./ipc/tizen-certificates";
import { registerUpdater } from "./ipc/updater";
import { WINDOW_CONSTANTS } from "./utils/constants";
import { inheritLoginShellPath } from "./utils/cli";
import "./utils/process-manager";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "../dist");
const PUBLIC_DIR = app.isPackaged ? DIST : path.join(DIST, "../public");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const OPEN_DEVTOOLS = process.env["ELECTRON_OPEN_DEVTOOLS"] === "1";

let win: BrowserWindow | null = null;

function setupCsp() {
  const isDev = !!VITE_DEV_SERVER_URL;
  // Vite HMR needs inline/eval scripts and a websocket in development.
  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  const connectSrc = isDev
    ? "'self' https://github.com ws://localhost:*"
    : "'self' https://github.com";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self';` +
            `script-src ${scriptSrc};` +
            `style-src 'self' 'unsafe-inline';` +
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
    icon: path.join(PUBLIC_DIR, "logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "../dist-electron/preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    if (OPEN_DEVTOOLS) win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(DIST, "index.html"));
  }

  // Open external links in the default browser instead of inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win?.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
  win = null;
});

// Port forwards outlive the app otherwise.
app.on("before-quit", endDebugSession);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  if (app.isPackaged) inheritLoginShellPath();
  // Passphrases used to be duplicated here behind the macOS Keychain; the webOS
  // CLI already stores them, so drop the obsolete copy.
  fs.rmSync(path.join(app.getPath("userData"), "secure-credentials.json"), {
    force: true,
  });
  registerIpcHandlers();
  registerTizenCertHandlers();
  registerUpdater(!VITE_DEV_SERVER_URL);
  setupCsp();
  createWindow();
});
