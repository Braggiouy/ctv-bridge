import type { LogType } from "@/types";

/** Maps main-process certificate log lines to App Log severity. */
export function classifyCertLogLine(log: string): LogType {
  if (log.startsWith("Error:")) return "error";
  if (log.startsWith("Warning:")) return "warning";
  if (
    /successful|successfully|ready|Done!/i.test(log) ||
    log.includes("Profile")
  ) {
    return "step";
  }
  return "info";
}
