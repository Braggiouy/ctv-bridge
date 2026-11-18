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
 * Central registry for spawned child processes.
 * Ensures all child processes are killed when the app quits,
 * preventing "Object has been destroyed" errors from orphaned
 * processes trying to send IPC messages to a closed window.
 */
class ProcessManager {
  private processes = new Set<ChildProcess>();

  constructor() {
    // Kill all tracked processes before the app quits
    app.on("before-quit", () => {
      this.killAll();
    });

    // Also handle window-all-closed for macOS where quit != window close
    app.on("window-all-closed", () => {
      this.killAll();
    });
  }

  /**
   * Register a spawned child process for lifecycle tracking.
   * The process will be automatically killed on app shutdown
   * and removed from the registry when it exits.
   */
  track(proc: ChildProcess): void {
    this.processes.add(proc);

    // Auto-remove when the process exits naturally
    const cleanup = () => {
      this.processes.delete(proc);
    };

    proc.on("close", cleanup);
    proc.on("error", cleanup);
  }

  /**
   * Kill all tracked child processes.
   */
  killAll(): void {
    if (this.processes.size === 0) return;

    logger.info(`Killing ${this.processes.size} child process(es) on shutdown`);

    this.processes.forEach(killTree);
    this.processes.clear();
  }
}

export const processManager = new ProcessManager();
