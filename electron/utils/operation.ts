import { AsyncLocalStorage } from "node:async_hooks";
import { execFile, execFileSync, type ChildProcess } from "node:child_process";

import { CANCELLED_MESSAGE } from "../../shared/ipc";

export class CancelledError extends Error {
  constructor() {
    super(CANCELLED_MESSAGE);
  }
}

/** A build or deploy the user can cancel. */
interface Operation {
  cancelled: boolean;
  processes: Set<ChildProcess>;
  cancel(): void;
}

// Follows the operation through its awaits, so CLI calls know which one they belong to.
const storage = new AsyncLocalStorage<Operation>();
let running: Operation | null = null;

/** The operation the caller is part of, if any. */
export const currentOperation = () => storage.getStore();

/**
 * Runs `work` so that cancelOperation() can stop it: its CLI processes are
 * killed, later CLI calls in it are refused, and this rejects with
 * CancelledError at once rather than when the work notices.
 */
export async function runCancellable<T>(work: () => Promise<T>): Promise<T> {
  let reject!: (error: Error) => void;
  const cancelled = new Promise<never>((_, onReject) => (reject = onReject));
  const operation: Operation = {
    cancelled: false,
    processes: new Set(),
    cancel: () => reject(new CancelledError()),
  };
  running = operation;
  try {
    const result = storage.run(operation, work);
    // Once cancelled, the work fails on its own; that failure isn't news.
    result.catch(() => undefined);
    return await Promise.race([result, cancelled]);
  } finally {
    if (running === operation) running = null;
  }
}

/** Cancels the running build or deploy; false if there's none. */
export function cancelOperation(): boolean {
  const operation = running;
  if (!operation || operation.cancelled) return false;
  operation.cancelled = true;
  operation.processes.forEach(killWithDescendants);
  operation.cancel();
  return true;
}

/** Records a process of the current operation, so cancelling kills it. */
export function trackInOperation(proc: ChildProcess): void {
  const operation = currentOperation();
  if (!operation) return;
  operation.processes.add(proc);
  proc.once("close", () => operation.processes.delete(proc));
}

/** pid → child pids, from `ps` output ("pid ppid" per line). */
export function childrenByParent(psOutput: string): Map<number, number[]> {
  const children = new Map<number, number[]>();
  for (const line of psOutput.split("\n")) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!pid || ppid === undefined || Number.isNaN(ppid)) continue;
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  return children;
}

/**
 * SDK tools are wrapper scripts that start the real work in child processes
 * (tizen → java → sdb), so those are stopped too. Signalling the pids directly
 * keeps Node from reporting a timeout (error.killed stays false), so no
 * timeout recovery kicks in.
 */
function killWithDescendants(proc: ChildProcess): void {
  const pid = proc.pid;
  if (!pid || proc.exitCode !== null || proc.signalCode !== null) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(pid), "/T", "/F"]);
    return;
  }
  let children = new Map<number, number[]>();
  try {
    children = childrenByParent(
      execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" })
    );
  } catch {
    // Kill at least the process itself.
  }
  const tree: number[] = [];
  const collect = (id: number) => {
    tree.push(id);
    children.get(id)?.forEach(collect);
  };
  collect(pid);
  for (const id of tree.reverse()) {
    try {
      process.kill(id, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
}
