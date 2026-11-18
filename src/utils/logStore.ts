import { useSyncExternalStore } from "react";

export type LogType = "log" | "info" | "step" | "warning" | "error";

export interface LogEntry {
  id: number;
  type: LogType;
  message: string;
  timestamp: number;
}

const MAX_ENTRIES = 1000;

let entries: LogEntry[] = [];
let nextId = 0;
// Bumped when something worth seeing is logged, so the log panel can open itself.
let revealCount = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function addLog(
  type: LogType,
  message: string,
  reveal = type === "error"
) {
  entries = [
    ...entries.slice(-(MAX_ENTRIES - 1)),
    { id: nextId++, type, message, timestamp: Date.now() },
  ];
  if (reveal) revealCount++;
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
export const useLogRevealCount = () =>
  useSyncExternalStore(subscribe, () => revealCount);
