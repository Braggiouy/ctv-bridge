export type LogType = "log" | "warning" | "error" | "step" | "info";

export interface LogEntry {
  type: LogType;
  message: string;
  timestamp: number;
}

export function createLog(type: LogType, message: string): LogEntry {
  return {
    type,
    message,
    timestamp: Date.now(),
  };
}
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
