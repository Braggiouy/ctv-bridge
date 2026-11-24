import fs from "node:fs/promises";
import type { WebContents } from "electron";
import type { IpcEventChannels, Platform, RemoteKey } from "../shared/ipc";
import {
  allowsSecondClient,
  ConsoleStream,
  socketUrlFromInspector,
} from "./platforms/console-stream";
import {
  baseUrlOf,
  contentType,
  needsReinstall,
  projectFileFor,
} from "./platforms/live-reload";
import { remoteKeyEvents } from "./platforms/remote-keys";
import {
  isInspectorOpen,
  onInspectorClosed,
  openInspector,
} from "./inspector-window";
import { logger } from "./utils/logger";
import { sendTo } from "./ipc/handle";

/** The app being debugged, whose console is streamed to the window that deployed it. */
interface Session {
  socketUrl: string;
  platform: Platform;
  window: WebContents;
  stream?: ConsoleStream;
  /** Older TVs accept one debugger per page, so DevTools and the stream take turns. */
  singleClient: boolean;
  lastTimestamp: number;
  /** Set while the app's files are served from the project (live reload). */
  liveReload?: LiveReload;
  /** The TV doesn't route the app's own files through CDP Fetch (e.g. Tizen). */
  liveReloadUnsupported?: boolean;
}

interface LiveReload {
  projectPath: string;
  /** The folder the app's page is loaded from on the TV. */
  baseUrl: string;
  /** Set once the TV has let one of the app's files be served from the project. */
  confirmed: boolean;
  onFirstServe?: () => void;
}

/** How long the first live reload waits for the TV to request a file through Fetch. */
const LIVE_RELOAD_PROBE_MS = 5000;

let session: Session | null = null;

function send<C extends "app-console:entries" | "app-console:state">(
  current: Session,
  channel: C,
  payload: IpcEventChannels[C]
) {
  sendTo(current.window, channel, payload);
}

async function connect(current: Session): Promise<void> {
  const stream = new ConsoleStream(current.socketUrl, {
    since: current.lastTimestamp,
    onEntries: (entries) => send(current, "app-console:entries", entries),
    onEvent: (method, params) => {
      if (method === "Fetch.requestPaused")
        void serveFile(current, stream, params);
    },
    onDisconnect: () => {
      if (session !== current) return;
      session = null;
      send(current, "app-console:state", "stopped");
    },
  });
  current.stream = stream;
  const chromeMajor = await stream.open();
  current.singleClient = !allowsSecondClient(chromeMajor);
  // Interception ends with the connection, e.g. while DevTools had the TV's only one.
  if (current.liveReload) await enableFetch(stream, current.liveReload.baseUrl);
  send(current, "app-console:state", "live");
}

const enableFetch = (stream: ConsoleStream, baseUrl: string) =>
  stream.command("Fetch.enable", { patterns: [{ urlPattern: `${baseUrl}*` }] });

/** Answers a request the TV paused: from the project when live reload has the file, else as usual. */
async function serveFile(
  current: Session,
  stream: ConsoleStream,
  params: Record<string, unknown>
): Promise<void> {
  const { requestId, request } = params as {
    requestId: string;
    request: { url: string };
  };
  const live = current.liveReload;
  const file =
    live && projectFileFor(request.url, live.baseUrl, live.projectPath);
  // Folders and files missing from the project fall back to the installed copy.
  const body = file && (await fs.readFile(file).catch(() => undefined));
  try {
    if (!live || !file || !body) {
      await stream.command("Fetch.continueRequest", { requestId });
      return;
    }
    await stream.command("Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: contentType(file) }],
      body: body.toString("base64"),
    });
    live.confirmed = true;
    live.onFirstServe?.();
  } catch (error) {
    logger.warn("Live reload couldn't answer a request", error);
  }
}

/**
 * Reloads the app with the project's files, without a reinstall. Resolves with
 * why it couldn't, so the caller can redeploy instead.
 */
export async function reloadAppLive(
  projectPath: string,
  changed: string[]
): Promise<{ reloaded: true } | { reloaded: false; reason: string }> {
  if (needsReinstall(changed)) {
    return { reloaded: false, reason: "The app's manifest changed" };
  }
  const current = session;
  if (!current) return { reloaded: false, reason: "No app is being debugged" };
  if (current.liveReloadUnsupported) {
    return {
      reloaded: false,
      reason: "This TV doesn't let CTV Bridge serve the app's files",
    };
  }
  const stream = current.stream;
  if (!stream) {
    return { reloaded: false, reason: "DevTools has the TV's only debugger" };
  }

  if (current.liveReload?.projectPath !== projectPath) {
    const { result } = (await stream.command("Runtime.evaluate", {
      expression: "location.href",
      returnByValue: true,
    })) as { result: { value?: string } };
    const baseUrl = baseUrlOf(result.value ?? "");
    current.liveReload = { projectPath, baseUrl, confirmed: false };
    await enableFetch(stream, baseUrl);
  }

  const live = current.liveReload;
  const served = live.confirmed
    ? Promise.resolve(true)
    : new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), LIVE_RELOAD_PROBE_MS);
        live.onFirstServe = () => {
          clearTimeout(timer);
          live.onFirstServe = undefined;
          resolve(true);
        };
      });
  await stream.command("Page.reload", { ignoreCache: true });
  if (await served) return { reloaded: true };

  // The reload went ahead with the installed files; don't try again this session.
  current.liveReload = undefined;
  current.liveReloadUnsupported = true;
  await stream.command("Fetch.disable").catch(() => undefined);
  return {
    reloaded: false,
    reason: "This TV doesn't let CTV Bridge serve the app's files",
  };
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
