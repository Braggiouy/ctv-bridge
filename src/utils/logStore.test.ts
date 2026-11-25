import { describe, expect, it } from "vitest";
import { formatLogs, type LogEntry } from "./logStore";

const at = (time: string) => new Date(`2026-11-25T${time}`).getTime();

describe("formatLogs", () => {
  it("prints one line per entry with time, level and the app tag", () => {
    const entries: LogEntry[] = [
      { id: 1, type: "info", message: "Deploying…", timestamp: at("09:05:01") },
      {
        id: 2,
        type: "error",
        source: "app",
        message: "Uncaught TypeError: x\n    at main.js:1:2",
        timestamp: at("09:05:02"),
      },
    ];
    expect(formatLogs(entries)).toBe(
      "09:05:01 info          Deploying…\n" +
        "09:05:02 error [app]   Uncaught TypeError: x\n        at main.js:1:2\n"
    );
  });

  it("is empty without entries", () => {
    expect(formatLogs([])).toBe("");
  });
});
