import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Terminal,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ChevronRight,
  Search,
} from "lucide-react";
import { mergeClassNames } from "@/utils";
import { useGlobalLogs } from "@/utils";

export const LogViewer = () => {
  const { logs, clearLogs } = useGlobalLogs();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const message = typeof log.message === "string" ? log.message : "";
    return (
      message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              App Logs
            </CardTitle>
            <CardDescription>
              Real-time logs from the entire app: errors, warnings, and activity
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] w-full rounded-md border bg-muted/30 p-4">
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {logs.length === 0
                ? "No logs yet. All app activity, errors, and warnings will appear here."
                : "No logs match your search."}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredLogs
                .slice()
                .reverse()
                .map((log, index) => {
                  let icon = <ChevronRight className="h-3 w-3" />;
                  let color = "text-foreground";
                  if (log.type === "error") {
                    icon = <XCircle className="h-3 w-3 text-red-500" />;
                    color = "text-red-500";
                  } else if (log.type === "warning") {
                    icon = (
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    );
                    color = "text-yellow-500";
                  } else if (log.type === "step") {
                    icon = <CheckCircle2 className="h-3 w-3 text-green-500" />;
                    color = "text-green-500";
                  } else if (log.type === "info") {
                    icon = <Info className="h-3 w-3 text-blue-500" />;
                    color = "text-blue-500";
                  }
                  return (
                    <div
                      key={index}
                      className={mergeClassNames(
                        "flex items-center gap-2 font-mono text-xs leading-relaxed py-1 px-2 rounded",
                        color,
                        log.type === "error" && "bg-red-50 dark:bg-red-950",
                        log.type === "warning" &&
                          "bg-yellow-50 dark:bg-yellow-950",
                        log.type === "step" && "bg-green-50 dark:bg-green-950",
                        log.type === "info" && "bg-blue-50 dark:bg-blue-950"
                      )}
                    >
                      {icon}
                      <span>
                        {typeof log.message === "string"
                          ? log.message
                              .split(/(https?:\/\/[^\s]+)/g)
                              .map((part, i) =>
                                part.match(/^https?:\/\//) ? (
                                  <a
                                    key={i}
                                    href={part}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline text-blue-600 hover:text-blue-800"
                                  >
                                    {part}
                                  </a>
                                ) : (
                                  part
                                )
                              )
                          : log.message}
                      </span>
                      <span className="ml-auto text-muted-foreground text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
