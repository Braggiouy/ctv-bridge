import { execFile, type ChildProcess } from "node:child_process";
import { app } from "electron";
import { logger } from "./logger";

/** Kills a spawned process together with anything it started (see spawnCli). */
export function killTree(proc: ChildProcess): void {
  if (proc.exitCode !== null || proc.signalCode !== null || !proc.pid) return;
  try {
    if (process.platform === "win32") {
      execFile("taskkill", ["/pid", String(proc.pid), "/T", "/F"]);
    } else {
      process.kill(-proc.pid, "SIGTERM");
    }
  } catch {
    // Already gone.
  }
}

/**
 * Kills every tracked child process on shutdown, so orphaned SDK processes
 * don't keep running or message a closed window.
 */
class ProcessManager {
  private processes = new Set<ChildProcess>();

  constructor() {
    app.on("before-quit", () => this.killAll());
    // On macOS closing the last window doesn't quit the app.
    app.on("window-all-closed", () => this.killAll());
  }

  track(proc: ChildProcess): void {
    this.processes.add(proc);
    const forget = () => this.processes.delete(proc);
    proc.on("close", forget);
    proc.on("error", forget);
  }

  killAll(): void {
    if (this.processes.size === 0) return;
    logger.info(`Killing ${this.processes.size} child process(es)`);
    this.processes.forEach(killTree);
    this.processes.clear();
  }
}

export const processManager = new ProcessManager();
