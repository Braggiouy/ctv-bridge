import { useSyncExternalStore } from "react";

export type LogType = "log" | "info" | "step" | "warning" | "error";

/** `app`: printed by the app on the TV rather than by CTV Bridge. */
export type LogSource = "app";

export interface LogEntry {
  id: number;
  type: LogType;
  message: string;
  timestamp: number;
  source?: LogSource;
}

const MAX_ENTRIES = 1000;

let entries: LogEntry[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function addLog(type: LogType, message: string, source?: LogSource) {
  addLogs([{ type, message, source }]);
}

/** Adds several entries with a single re-render. */
export function addLogs(
  batch: { type: LogType; message: string; source?: LogSource }[]
) {
  const timestamp = Date.now();
  const added = batch.map((entry) => ({ ...entry, id: nextId++, timestamp }));
  entries = [...entries, ...added].slice(-MAX_ENTRIES);
  emit();
}

export function clearLogs() {
  entries = [];
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useLogs = () => useSyncExternalStore(subscribe, () => entries);
