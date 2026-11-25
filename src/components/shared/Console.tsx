import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Info,
  Save,
  Square,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppConsole } from "@/hooks/useAppConsole";
import { usePersistentState } from "@/hooks/usePersistentState";
import { toast } from "sonner";
import { RemoteControl, RemoteKeypad } from "./RemoteControl";
import {
  addLog,
  clearLogs,
  cn,
  formatLogs,
  notify,
  useLogs,
  type LogEntry,
  type LogType,
} from "@/utils";

const STYLES: Record<LogType, { icon: typeof Info; className: string }> = {
  log: { icon: ChevronRight, className: "text-foreground/80" },
  info: { icon: Info, className: "text-blue-600 dark:text-blue-400" },
  step: { icon: CheckCircle2, className: "text-green-600 dark:text-green-400" },
  warning: {
    icon: AlertTriangle,
    className: "text-yellow-600 dark:text-yellow-400",
  },
  error: {
    icon: XCircle,
    className: "text-red-600 dark:text-red-400 bg-red-500/10",
  },
};

type Level = "all" | "warning" | "error";

const LEVELS: { id: Level; label: string }[] = [
  { id: "all", label: "All" },
  { id: "warning", label: "Warnings" },
  { id: "error", label: "Errors" },
];

const matchesLevel = (log: LogEntry, level: Level) =>
  level === "all" ||
  log.type === "error" ||
  (level === "warning" && log.type === "warning");

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

const linkify = (message: string) =>
  message.split(URL_PATTERN).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {part}
      </a>
    ) : (
      part
    )
  );

/** Docked output of every SDK command and of the app being debugged, newest at the bottom like a terminal. */
export const Console = ({ className }: { className?: string }) => {
  const allLogs = useLogs();
  const [showAppLogs, setShowAppLogs] = usePersistentState(
    "console:show-app-logs",
    true
  );
  const appConsole = useAppConsole(showAppLogs);
  const [moreKeys, setMoreKeys] = usePersistentState(
    "console:more-remote-keys",
    false
  );
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<Level>("all");
  const hasAppLogs = allLogs.some((log) => log.source === "app");
  const logs =
    showAppLogs || !hasAppLogs
      ? allLogs
      : allLogs.filter((log) => log.source !== "app");
  const scroller = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const term = search.toLowerCase();
  const visible =
    term || level !== "all"
      ? logs.filter(
          (log) =>
            matchesLevel(log, level) && log.message.toLowerCase().includes(term)
        )
      : logs;

  useEffect(() => {
    const el = scroller.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible]);

  // What's shown, so a filtered view copies or saves just those lines.
  const copyLogs = async () => {
    const result = await window.electron.logs.copy(formatLogs(visible));
    if (result.success) toast.success(`Copied ${visible.length} line(s)`);
    else notify.error("Couldn't copy the console", result.message);
  };

  const saveLogs = async () => {
    const result = await window.electron.logs.save(formatLogs(visible));
    if (!result.success)
      notify.error("Couldn't save the console", result.message);
    else if (result.path) addLog("step", `Console saved to ${result.path}`);
  };

  const trackScroll = () => {
    const el = scroller.current!;
    pinnedToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  return (
    <section className={cn("flex min-h-0 flex-col border-t", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-1.5">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Console
        </h2>
        {appConsole.state !== "stopped" && (
          <span className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                appConsole.state === "live"
                  ? "animate-pulse bg-green-500"
                  : "bg-yellow-500"
              )}
            />
            {appConsole.state === "live"
              ? "App console live"
              : "App console paused"}
            <button
              type="button"
              onClick={appConsole.stop}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              title="Stop streaming the app's console"
              aria-label="Stop streaming the app's console"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
            </button>
          </span>
        )}
        {appConsole.state !== "stopped" && (
          <RemoteControl
            disabled={appConsole.state === "paused"}
            expanded={moreKeys}
            onExpandedChange={setMoreKeys}
          />
        )}
        {(appConsole.state !== "stopped" || hasAppLogs) && (
          <button
            type="button"
            aria-pressed={showAppLogs}
            onClick={() => setShowAppLogs(!showAppLogs)}
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs hover:bg-muted",
              showAppLogs ? "text-foreground" : "text-muted-foreground"
            )}
            title={
              showAppLogs
                ? "Hide the app's logs; the remote and screenshots keep working"
                : "Show the app's logs in the console"
            }
          >
            {showAppLogs ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            App logs
          </button>
        )}
        <div
          role="radiogroup"
          aria-label="Level"
          className="ml-auto flex rounded-md bg-muted p-0.5"
        >
          {LEVELS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={level === id}
              onClick={() => setLevel(id)}
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                level === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Filter…"
          className="h-7 w-44 text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={copyLogs}
          disabled={visible.length === 0}
          title="Copy the lines shown"
          aria-label="Copy console"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={saveLogs}
          disabled={visible.length === 0}
          title="Save the lines shown to a file"
          aria-label="Save console"
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={clearLogs}
          disabled={logs.length === 0}
          title="Clear"
          aria-label="Clear console"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {moreKeys && appConsole.state !== "stopped" && (
        <RemoteKeypad disabled={appConsole.state === "paused"} />
      )}
      <div
        ref={scroller}
        onScroll={trackScroll}
        className="flex-1 overflow-y-auto bg-muted/30 px-2 py-1 font-mono text-xs"
        role="log"
      >
        {visible.length === 0 ? (
          <p className="py-6 text-center font-sans text-muted-foreground">
            {logs.length === 0
              ? "Output from builds, deployments and the app being debugged appears here."
              : "No entries match the filter."}
          </p>
        ) : (
          visible.map((log) => {
            const { icon: Icon, className } = STYLES[log.type];
            return (
              <div
                key={log.id}
                className={cn("flex gap-2 rounded px-2 py-0.5", className)}
              >
                <span className="shrink-0 text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                {log.source === "app" && (
                  <span className="h-fit shrink-0 rounded bg-foreground/10 px-1 text-[10px] font-semibold uppercase leading-4 text-muted-foreground">
                    app
                  </span>
                )}
                <span className="flex-1 whitespace-pre-wrap break-all">
                  {linkify(log.message)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
