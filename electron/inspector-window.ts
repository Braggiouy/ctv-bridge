import { BrowserWindow, session, shell, type Session } from "electron";
import { isInspectorUrl } from "./platforms/inspector";
import { WINDOW_CONSTANTS } from "./utils/constants";

let inspectorWindow: BrowserWindow | null = null;
let inspectorSession: Session | null = null;
const closedListeners = new Set<() => void>();

export function onInspectorClosed(listener: () => void): void {
  closedListeners.add(listener);
}

/**
 * DevTools gets its own session. Chromium 111+ refuses debug connections that
 * carry an Origin header, so it is dropped here, for local sockets only.
 */
function getInspectorSession(): Session {
  if (inspectorSession) return inspectorSession;
  inspectorSession = session.fromPartition("inspector");
  inspectorSession.webRequest.onBeforeSendHeaders(
    { urls: ["ws://127.0.0.1/*"] },
    ({ requestHeaders }, callback) => {
      delete requestHeaders.Origin;
      callback({ requestHeaders });
    }
  );
  return inspectorSession;
}

/** Opens DevTools for a debug target, reusing the window of the previous session. */
export async function openInspector(url: string): Promise<void> {
  if (!isInspectorUrl(url)) throw new Error("Invalid inspector URL.");

  if (inspectorWindow && !inspectorWindow.isDestroyed()) {
    if (inspectorWindow.webContents.getURL() !== url) {
      await inspectorWindow.loadURL(url);
    }
    if (inspectorWindow.isMinimized()) inspectorWindow.restore();
    inspectorWindow.focus();
    return;
  }

  inspectorWindow = new BrowserWindow({
    width: WINDOW_CONSTANTS.DEFAULT_WIDTH,
    height: WINDOW_CONSTANTS.DEFAULT_HEIGHT,
    title: "DevTools",
    webPreferences: {
      session: getInspectorSession(),
      sandbox: true,
      contextIsolation: true,
    },
  });
  inspectorWindow.on("closed", () => {
    inspectorWindow = null;
    closedListeners.forEach((listener) => listener());
  });
  inspectorWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });
  await inspectorWindow.loadURL(url);
}
