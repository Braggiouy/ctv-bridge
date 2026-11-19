import { useEffect, useRef, useState } from "react";
import type { AppConsoleState } from "@/types";
import { addLog, addLogs } from "@/utils";

const STATE_MESSAGES: Record<AppConsoleState, string> = {
  live: "Streaming the app's console from the TV",
  paused:
    "App console paused while DevTools is open (this TV allows one debugger at a time)",
  stopped: "App console stream ended",
};

/**
 * Mirrors the console of the app being debugged into the log, and reports whether it is streaming.
 * With `recordLogs` off the stream stays connected (the remote needs it) but its output is dropped.
 */
export function useAppConsole(recordLogs: boolean) {
  const [state, setState] = useState<AppConsoleState>("stopped");
  const current = useRef(state);
  const recording = useRef(recordLogs);
  recording.current = recordLogs;

  useEffect(() => {
    const { appConsole } = window.electron;
    const offEntries = appConsole.onEntries(
      (entries) =>
        recording.current &&
        addLogs(
          entries.map(({ level, text }) => ({
            type: level,
            message: text,
            source: "app" as const,
          }))
        )
    );
    const offState = appConsole.onState((next) => {
      if (next === current.current) return;
      current.current = next;
      addLog("info", STATE_MESSAGES[next]);
      setState(next);
    });
    return () => {
      offEntries();
      offState();
    };
  }, []);

  return { state, stop: () => window.electron.appConsole.stop() };
}
