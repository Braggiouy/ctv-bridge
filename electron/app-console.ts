import type { WebContents } from "electron";
import type { AppConsoleState, AppLogEntry } from "../shared/ipc";
import {
  allowsSecondClient,
  ConsoleStream,
  socketUrlFromInspector,
} from "./platforms/console-stream";
import { onInspectorClosed, openInspector } from "./inspector-window";
import { logger } from "./utils/logger";

/** The app being debugged, whose console is streamed to the window that deployed it. */
interface Session {
  socketUrl: string;
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
  window: WebContents
): Promise<void> {
  stopAppConsole();
  const current: Session = {
    socketUrl: socketUrlFromInspector(inspectorUrl),
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

/** Opens DevTools, first handing it the connection on TVs that allow only one. */
export async function openInspectorForApp(url: string): Promise<void> {
  if (session?.singleClient && session.stream) {
    pause(session);
    send(session, "app-console:state", "paused");
  }
  await openInspector(url);
}

onInspectorClosed(() => {
  const current = session;
  if (!current || current.stream) return;
  connect(current).catch((error) => {
    logger.warn("Couldn't resume the app console", error);
    if (session === current) stopAppConsole();
  });
});
