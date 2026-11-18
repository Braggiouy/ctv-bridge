import type { DeployOutcome, LogFn } from "./types";

/** An entry of a debug port's /json/list. */
export interface DevToolsTarget {
  id?: string;
  type?: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

// Some TVs don't answer /json/list; /pagelist.json is what older webOS serves.
const LIST_PATHS = ["/json/list", "/json", "/pagelist.json"];
const ATTEMPTS = 10;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 3000;

/** The page's WebSocket path, e.g. "/devtools/page/1". */
export function targetSocketPath(target: DevToolsTarget): string | undefined {
  if (target.webSocketDebuggerUrl) {
    try {
      return new URL(target.webSocketDebuggerUrl).pathname;
    } catch {
      // Fall through to the frontend URL.
    }
  }
  return target.devtoolsFrontendUrl?.match(/[?&]ws=[^/&]+(\/[^&]+)/)?.[1];
}

/** The page showing the app when it can be told apart, otherwise the first page. */
export function pickTarget(
  targets: DevToolsTarget[],
  appHint?: string
): DevToolsTarget | undefined {
  const pages = targets.filter(
    (target) => (target.type ?? "page") === "page" && targetSocketPath(target)
  );
  const matchesApp = (target: DevToolsTarget) =>
    !!appHint &&
    [target.url, target.title].some((text) => text?.includes(appHint));
  return pages.find(matchesApp) ?? pages[0];
}

/** Only Electron's bundled DevTools on a local port may be opened from the renderer. */
export const isInspectorUrl = (url: string) =>
  /^devtools:\/\/devtools\/bundled\/inspector\.html\?ws=127\.0\.0\.1:\d+\/[\w/.-]+$/.test(
    url
  );

/** Electron's bundled DevTools, connected to a forwarded debug port. */
export function inspectorUrl(port: number, socketPath: string): string {
  return `devtools://devtools/bundled/inspector.html?ws=127.0.0.1:${port}${socketPath}`;
}

async function listTargets(port: number): Promise<DevToolsTarget[]> {
  for (const listPath of LIST_PATHS) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${listPath}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const targets: unknown = await response.json();
      if (Array.isArray(targets) && targets.length > 0) return targets;
    } catch {
      // Not served on this path, or the app isn't ready yet.
    }
  }
  return [];
}

/** Waits for the app's page to appear on a forwarded debug port and returns its inspector URL. */
export async function discoverInspector(
  port: number,
  appHint?: string,
  { attempts = ATTEMPTS, retryDelayMs = RETRY_DELAY_MS } = {}
): Promise<string | undefined> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const target = pickTarget(await listTargets(port), appHint);
    const socketPath = target && targetSocketPath(target);
    if (socketPath) return inspectorUrl(port, socketPath);
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return undefined;
}

/** Finishes a debug deploy once the TV's debug port is forwarded to `port`. */
export async function attachInspector(
  port: number,
  appHint: string | undefined,
  log: LogFn
): Promise<DeployOutcome> {
  log(`Debug port forwarded to 127.0.0.1:${port}`);
  const url = await discoverInspector(port, appHint);
  if (url) return { message: "Deployed in debug mode", inspectorUrl: url };

  log("Could not find the app's page on the debug port. To inspect manually:");
  log("1. Open chrome://inspect/#devices in Chrome");
  log(`2. Click "Configure…" and add localhost:${port}`);
  log(`3. Click "inspect" under your app`);
  return { message: "Deployed in debug mode (open the inspector manually)" };
}
