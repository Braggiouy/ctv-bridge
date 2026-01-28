import { useState, useEffect } from "react";
import { type LogEntry, type LogType } from "@/types";

/**
 * Creates a new log entry
 */
export function createLog(type: LogType, message: string): LogEntry {
  return {
    type,
    message,
    timestamp: Date.now(),
  };
}

let listeners: ((logs: LogEntry[]) => void)[] = [];
let logs: LogEntry[] = [];

export function addLog(type: LogType, message: string) {
  const entry = createLog(type, message);
  logs.push(entry);
  listeners.forEach((cb) => cb([...logs]));
}

export function clearLogs() {
  logs = [];
  listeners.forEach((cb) => cb([]));
}

export function useGlobalLogs() {
  const [state, setState] = useState<LogEntry[]>(logs);

  // Subscribe on mount and cleanup on unmount
  useEffect(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter((cb) => cb !== setState);
    };
  }, []);

  return {
    logs: state,
    addLog,
    clearLogs,
  };
}
