/**
 * Streams the console of a page on a forwarded debug port over the Chrome
 * DevTools Protocol. Free of Electron imports so the formatting can be tested.
 */
import type { AppLogEntry, AppLogLevel } from "../../shared/ipc";

interface PropertyPreview {
  name: string;
  type: string;
  subtype?: string;
  value?: string;
}

interface ObjectPreview {
  subtype?: string;
  overflow?: boolean;
  properties: PropertyPreview[];
}

export interface RemoteObject {
  type: string;
  subtype?: string;
  objectId?: string;
  value?: unknown;
  unserializableValue?: string;
  description?: string;
  preview?: ObjectPreview;
}

interface StackTrace {
  callFrames: {
    functionName: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  }[];
}

const MAX_TEXT_LENGTH = 5000;
const MAX_STACK_FRAMES = 5;
const FLUSH_INTERVAL_MS = 100;
const CONNECT_TIMEOUT_MS = 5000;
const COMMAND_TIMEOUT_MS = 5000;
const SERIALIZE_TIMEOUT_MS = 1000;
// Runs on the TV: older Chrome sends console objects without a preview.
const SERIALIZE_OBJECT = `function () {
  try {
    var json = JSON.stringify(this);
    return json && json.length > 2000 ? json.slice(0, 2000) + "…" : json;
  } catch (e) {
    return null;
  }
}`;
// Chrome 63 was the first to accept more than one DevTools client per page.
const FIRST_MULTI_CLIENT_CHROME = 63;

const truncate = (text: string) =>
  text.length > MAX_TEXT_LENGTH
    ? `${text.slice(0, MAX_TEXT_LENGTH)}… (${text.length - MAX_TEXT_LENGTH} more characters)`
    : text;

function formatPreviewValue(property: PropertyPreview): string {
  if (property.type === "string") return JSON.stringify(property.value ?? "");
  return property.value ?? property.type;
}

function formatPreview(preview: ObjectPreview): string {
  const isArray = preview.subtype === "array";
  const items = preview.properties.map((property) =>
    isArray
      ? formatPreviewValue(property)
      : `${property.name}: ${formatPreviewValue(property)}`
  );
  if (preview.overflow) items.push("…");
  return isArray ? `[${items.join(", ")}]` : `{${items.join(", ")}}`;
}

/** A console argument as DevTools would print it on one line. */
export function formatRemoteObject(object: RemoteObject): string {
  if (object.type === "string") return String(object.value);
  if (object.unserializableValue) return object.unserializableValue;
  if (object.type === "undefined") return "undefined";
  if (object.subtype === "null") return "null";
  if (object.type !== "object" && object.type !== "function") {
    return String(object.value ?? object.description);
  }
  if (object.subtype === "error") return object.description ?? "Error";
  if (object.type === "function") {
    return `ƒ ${object.description?.split("\n")[0] ?? ""}`.trim();
  }
  if (object.preview) return formatPreview(object.preview);
  return object.description ?? object.type;
}

/** Joins console arguments, applying %s/%d/%i/%f/%o/%O/%c substitutions like browsers do. */
export function formatConsoleArgs(args: RemoteObject[]): string {
  const [first, ...rest] = args;
  if (!first) return "";
  if (first.type !== "string") return args.map(formatRemoteObject).join(" ");

  const remaining = [...rest];
  const text = String(first.value).replace(/%([sdifoOc%])/g, (match, spec) => {
    if (spec === "%") return "%";
    const arg = remaining.shift();
    if (!arg) return match;
    if (spec === "c") return "";
    if (spec === "d" || spec === "i") {
      return String(Math.trunc(Number(arg.value ?? arg.description)));
    }
    if (spec === "f") return String(Number(arg.value ?? arg.description));
    return formatRemoteObject(arg);
  });
  return [text, ...remaining.map(formatRemoteObject)].join(" ");
}

export function formatStackTrace(stack?: StackTrace): string {
  if (!stack?.callFrames.length) return "";
  const frames = stack.callFrames.slice(0, MAX_STACK_FRAMES).map((frame) => {
    const file =
      frame.url.split(/[/?#]/).filter(Boolean).pop() || "<anonymous>";
    // CDP line and column numbers are zero-based.
    const location = `${file}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
    return `    at ${frame.functionName ? `${frame.functionName} (${location})` : location}`;
  });
  if (stack.callFrames.length > MAX_STACK_FRAMES) frames.push("    …");
  return `\n${frames.join("\n")}`;
}

const shortenStackUrls = (stack: string) =>
  stack.replace(/(?:file|https?):\/\/\S*?\/([^/\s)]+:\d+:\d+)/g, "$1");

const CONSOLE_LEVELS: Record<string, AppLogLevel> = {
  error: "error",
  assert: "error",
  warning: "warning",
  info: "info",
};

const SKIPPED_CONSOLE_TYPES = new Set([
  "endGroup",
  "clear",
  "profile",
  "profileEnd",
]);

/** Turns a CDP event into a log entry, or null for events that aren't worth showing. */
export function toLogEntry(
  method: string,
  params: Record<string, unknown>
): AppLogEntry | null {
  if (method === "Runtime.consoleAPICalled") {
    const type = String(params.type);
    if (SKIPPED_CONSOLE_TYPES.has(type)) return null;
    const level = CONSOLE_LEVELS[type] ?? "log";
    const stack =
      level === "error" || type === "trace"
        ? formatStackTrace(params.stackTrace as StackTrace | undefined)
        : "";
    const text = formatConsoleArgs((params.args as RemoteObject[]) ?? []);
    return { level, text: truncate(text + stack) };
  }

  if (method === "Runtime.exceptionThrown") {
    const details = params.exceptionDetails as {
      text: string;
      exception?: RemoteObject;
      stackTrace?: StackTrace;
    };
    const description = details.exception?.description;
    // An Error's description already includes its stack; shorten its URLs like formatStackTrace.
    const text = description
      ? `Uncaught ${shortenStackUrls(description)}`
      : `${details.text}${formatStackTrace(details.stackTrace)}`;
    return { level: "error", text: truncate(text) };
  }

  if (method === "Log.entryAdded") {
    const entry = params.entry as { level: string; text: string; url?: string };
    if (entry.level === "verbose") return null;
    const level: AppLogLevel =
      entry.level === "error" || entry.level === "warning"
        ? entry.level
        : "info";
    const text = entry.url ? `${entry.text} (${entry.url})` : entry.text;
    return { level, text: truncate(text) };
  }

  return null;
}

const eventTimestamp = (method: string, params: Record<string, unknown>) =>
  Number(
    method === "Log.entryAdded"
      ? (params.entry as { timestamp?: number }).timestamp
      : params.timestamp
  ) || 0;

export function chromeMajorVersion(userAgent: string): number | undefined {
  // Tizen 5.5+ omits "Chrome/": "(KHTML, like Gecko) 120.0.6099.5/9.0 TV Safari".
  const match =
    userAgent.match(/Chrome\/(\d+)/) ??
    userAgent.match(/like Gecko\) (\d+)\.[\d.]+\/[\d.]+ TV/);
  const major = Number(match?.[1]);
  return major || undefined;
}

interface CdpResponse {
  result?: unknown;
  error?: { message: string };
}

export interface ConsoleStreamOptions {
  /** Called with batches of entries, at most every 100ms. */
  onEntries(entries: AppLogEntry[]): void;
  /** Called when the connection drops without close() being called. */
  onDisconnect(): void;
  /** Skip events at or before this TV timestamp (messages already shown). */
  since?: number;
}

/** One CDP connection to a page, forwarding its console output. */
export class ConsoleStream {
  private socket?: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (response?: CdpResponse) => void>();
  private batch: AppLogEntry[] = [];
  private flushTimer?: ReturnType<typeof setTimeout>;
  private closedByUs = false;
  /** Events are processed in order, though objects may need a round trip to the TV. */
  private queue = Promise.resolve();
  private readonly since: number;
  /** TV timestamp of the newest event, to resume without repeats. */
  lastTimestamp: number;

  constructor(
    private readonly socketUrl: string,
    private readonly options: ConsoleStreamOptions
  ) {
    this.since = options.since ?? 0;
    this.lastTimestamp = this.since;
  }

  /** Connects and subscribes; resolves with the page's Chrome version when known. */
  async open(): Promise<number | undefined> {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.socketUrl);
      this.socket = socket;
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("Timed out connecting to the app's debug port."));
      }, CONNECT_TIMEOUT_MS);
      socket.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Couldn't connect to the app's debug port."));
      };
      socket.onmessage = (message) => this.handleMessage(String(message.data));
      socket.onclose = () => {
        this.pending.forEach((resolve) => resolve(undefined));
        this.pending.clear();
        this.flush();
        if (!this.closedByUs) this.options.onDisconnect();
      };
    });

    // The Log domain is missing on some older TVs; console output still works without it.
    await Promise.all([this.send("Runtime.enable"), this.send("Log.enable")]);
    const result = (await this.send("Runtime.evaluate", {
      expression: "navigator.userAgent",
      returnByValue: true,
    })) as { result?: { value?: string } } | undefined;
    return chromeMajorVersion(result?.result?.value ?? "");
  }

  close(): void {
    this.closedByUs = true;
    this.flush();
    this.socket?.close();
  }

  private request(
    method: string,
    params?: object
  ): Promise<CdpResponse | undefined> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.socket?.send(JSON.stringify({ id, method, params }));
    });
  }

  private async send(method: string, params?: object): Promise<unknown> {
    return (await this.request(method, params))?.result;
  }

  /** Runs a CDP command on the page, failing on protocol errors and timeouts. */
  async command(method: string, params?: object): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), COMMAND_TIMEOUT_MS);
    });
    const response = await Promise.race([
      this.request(method, params),
      timeout,
    ]);
    clearTimeout(timer);
    if (!response) throw new Error("The TV didn't respond.");
    if (response.error) throw new Error(response.error.message);
    return response.result;
  }

  /** JSON of a console object that came without a preview, read from the TV. */
  private async serialize(object: RemoteObject): Promise<RemoteObject> {
    const needsSerializing =
      object.type === "object" &&
      object.objectId &&
      !object.preview &&
      !["error", "null", "node"].includes(object.subtype ?? "");
    if (!needsSerializing) return object;

    const timeout = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), SERIALIZE_TIMEOUT_MS)
    );
    const response = (await Promise.race([
      this.send("Runtime.callFunctionOn", {
        objectId: object.objectId,
        functionDeclaration: SERIALIZE_OBJECT,
        returnByValue: true,
      }),
      timeout,
    ])) as { result?: { value?: unknown } } | undefined;
    const json = response?.result?.value;
    return typeof json === "string" ? { ...object, description: json } : object;
  }

  private handleMessage(data: string): void {
    let message: {
      id?: number;
      result?: unknown;
      error?: { message: string };
      method?: string;
      params?: Record<string, unknown>;
    };
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    if (message.id !== undefined) {
      this.pending.get(message.id)?.(message);
      this.pending.delete(message.id);
      return;
    }
    const { method, params } = message;
    if (!method || !params) return;

    // Runtime.enable replays earlier messages; skip those shown before a reconnect.
    const timestamp = eventTimestamp(method, params);
    if (timestamp && timestamp <= this.since) return;
    this.lastTimestamp = Math.max(this.lastTimestamp, timestamp);

    this.queue = this.queue.then(async () => {
      const args = params.args as RemoteObject[] | undefined;
      const resolved =
        method === "Runtime.consoleAPICalled" && args
          ? {
              ...params,
              args: await Promise.all(args.map((arg) => this.serialize(arg))),
            }
          : params;
      const entry = toLogEntry(method, resolved);
      if (!entry) return;
      this.batch.push(entry);
      this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
    });
  }

  private flush(): void {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.batch.length === 0) return;
    const entries = this.batch;
    this.batch = [];
    this.options.onEntries(entries);
  }
}

/** Whether DevTools and the log stream can be connected to this page at the same time. */
export const allowsSecondClient = (chromeMajor: number | undefined) =>
  chromeMajor !== undefined && chromeMajor >= FIRST_MULTI_CLIENT_CHROME;

/** The page's WebSocket URL, from the bundled-DevTools URL built by the inspector. */
export const socketUrlFromInspector = (inspectorUrl: string) =>
  `ws://${new URL(inspectorUrl).searchParams.get("ws")}`;
