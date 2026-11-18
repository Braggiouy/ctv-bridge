import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearLogs, cn, useLogs, type LogType } from "@/utils";

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

/** Docked output of every SDK command, newest at the bottom like a terminal. */
export const Console = ({ className }: { className?: string }) => {
  const logs = useLogs();
  const [search, setSearch] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const term = search.toLowerCase();
  const visible = term
    ? logs.filter((log) => log.message.toLowerCase().includes(term))
    : logs;

  useEffect(() => {
    const el = scroller.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible]);

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
        <Input
          placeholder="Filter…"
          className="ml-auto h-7 w-44 text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
      <div
        ref={scroller}
        onScroll={trackScroll}
        className="flex-1 overflow-y-auto bg-muted/30 px-2 py-1 font-mono text-xs"
        role="log"
      >
        {visible.length === 0 ? (
          <p className="py-6 text-center font-sans text-muted-foreground">
            {logs.length === 0
              ? "Output from builds and deployments appears here."
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
