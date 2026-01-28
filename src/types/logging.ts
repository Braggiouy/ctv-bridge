export type LogType = "log" | "warning" | "error" | "step" | "info";

export interface LogEntry {
  type: LogType;
  message: string;
  timestamp: number;
}
