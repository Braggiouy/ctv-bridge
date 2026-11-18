import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  clearLogs,
  cn,
  useLogRevealCount,
  useLogs,
  type LogType,
} from "@/utils";

const STYLES: Record<LogType, { icon: typeof Info; className: string }> = {
  log: { icon: ChevronRight, className: "text-foreground" },
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

/** Collapsible activity log; opens by itself on errors and deployments. */
export const LogViewer = () => {
  const logs = useLogs();
  const revealCount = useLogRevealCount();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const initialReveal = useRef(revealCount);

  useEffect(() => {
    if (revealCount !== initialReveal.current) setOpen(true);
  }, [revealCount]);

  const term = search.toLowerCase();
  const visible = logs
    .filter((log) => !term || log.message.toLowerCase().includes(term))
    .reverse();
  const errorCount = logs.filter((log) => log.type === "error").length;

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Terminal className="h-4 w-4" />
          Activity log
          <span className="text-xs font-normal text-muted-foreground">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
          {errorCount > 0 && (
            <span className="rounded-full bg-red-500/10 px-2 text-xs text-red-600 dark:text-red-400">
              {errorCount} {errorCount === 1 ? "error" : "errors"}
            </span>
          )}
        </button>
        {open && (
          <>
            <Input
              placeholder="Filter…"
              className="h-8 w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </>
        )}
      </div>
      {open && (
        <ScrollArea className="h-72 border-t bg-muted/30 px-4 py-2">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {logs.length === 0
                ? "Nothing logged yet."
                : "No entries match the filter."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {visible.map((log) => {
                const { icon: Icon, className } = STYLES[log.type];
                return (
                  <div
                    key={log.id}
                    className={cn(
                      "flex gap-2 rounded px-2 py-1 font-mono text-xs",
                      className
                    )}
                  >
                    <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="flex-1 whitespace-pre-wrap break-all">
                      {linkify(log.message)}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      )}
    </section>
  );
};
