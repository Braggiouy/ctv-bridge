import { useState, useEffect } from "react";
import { createLog, LogEntry, LogType } from "./cn";

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
