import type { WebContents } from "electron";
import type {
  AppConsoleState,
  AppLogEntry,
  Platform,
  RemoteKey,
} from "../shared/ipc";
import {
  allowsSecondClient,
  ConsoleStream,
  socketUrlFromInspector,
} from "./platforms/console-stream";
import { remoteKeyEvents } from "./platforms/remote-keys";
import {
  isInspectorOpen,
  onInspectorClosed,
  openInspector,
} from "./inspector-window";
import { logger } from "./utils/logger";

/** The app being debugged, whose console is streamed to the window that deployed it. */
interface Session {
  socketUrl: string;
  platform: Platform;
  window: WebContents;
  stream?: ConsoleStream;
  /** Older TVs accept one debugger per page, so DevTools and the stream take turns. */
  singleClient: boolean;
  lastTimestamp: number;
}

let session: Session | null = null;

function send(
  current: Session,
  channel: string,
  payload: AppLogEntry[] | AppConsoleState
) {
  if (!current.window.isDestroyed()) current.window.send(channel, payload);
}

async function connect(current: Session): Promise<void> {
  const stream = new ConsoleStream(current.socketUrl, {
    since: current.lastTimestamp,
    onEntries: (entries) => send(current, "app-console:entries", entries),
    onDisconnect: () => {
      if (session !== current) return;
      session = null;
      send(current, "app-console:state", "stopped");
    },
  });
  current.stream = stream;
  const chromeMajor = await stream.open();
  current.singleClient = !allowsSecondClient(chromeMajor);
  send(current, "app-console:state", "live");
}

function pause(current: Session) {
  if (!current.stream) return;
  current.lastTimestamp = current.stream.lastTimestamp;
  current.stream.close();
  current.stream = undefined;
}

/** Starts streaming the console of the page DevTools would open. */
export async function startAppConsole(
  inspectorUrl: string,
  platform: Platform,
  window: WebContents
): Promise<void> {
  stopAppConsole();
  const current: Session = {
    socketUrl: socketUrlFromInspector(inspectorUrl),
    platform,
    window,
    singleClient: true,
    lastTimestamp: 0,
  };
  session = current;
  try {
    await connect(current);
  } catch (error) {
    if (session === current) session = null;
    throw error;
  }
}

export function stopAppConsole(): void {
  if (!session) return;
  const current = session;
  session = null;
  current.stream?.close();
  send(current, "app-console:state", "stopped");
}

function connectedSession(): Session & { stream: ConsoleStream } {
  if (!session)
    throw new Error("No app is being debugged. Deploy in Debug mode first.");
  if (!session.stream) {
    throw new Error(
      "Close DevTools first: this TV allows one debugger at a time."
    );
  }
  return session as Session & { stream: ConsoleStream };
}

/** Presses a remote key in the app being debugged. */
export async function pressRemoteKey(key: RemoteKey): Promise<void> {
  const { stream, platform } = connectedSession();
  for (const event of remoteKeyEvents(key, platform)) {
    await stream.command("Input.dispatchKeyEvent", event);
  }
}

/** A PNG of what the app is showing. Video drawn by the TV's player may come out black. */
export async function captureAppScreen(): Promise<Buffer> {
  const { data } = (await connectedSession().stream.command(
    "Page.captureScreenshot",
    { format: "png" }
  )) as { data: string };
  return Buffer.from(data, "base64");
}

/**
 * Opens DevTools, first handing it the connection on TVs that allow only one.
 * `background`: only reconnects a DevTools window that is already open, without focusing it.
 */
export async function openInspectorForApp(
  url: string,
  background = false
): Promise<void> {
  if (background && !isInspectorOpen()) return;
  if (session?.singleClient && session.stream) {
    pause(session);
    send(session, "app-console:state", "paused");
  }
  await openInspector(url, !background);
}

onInspectorClosed(() => {
  const current = session;
  if (!current || current.stream) return;
  connect(current).catch((error) => {
    logger.warn("Couldn't resume the app console", error);
    if (session === current) stopAppConsole();
  });
});
