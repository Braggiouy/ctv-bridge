import {
  ChildProcess,
  exec,
  execFile,
  execFileSync,
  spawn,
} from "node:child_process";
import { processManager } from "./process-manager";

export { killTree } from "./process-manager";

const isWindows = process.platform === "win32";

export interface CliResult {
  stdout: string;
  stderr: string;
}

export interface CliError extends Error {
  stdout?: string;
  stderr?: string;
}

// SDK wrappers on Windows are .bat/.cmd scripts that only run through a shell,
// so there we quote every argument ourselves instead of passing an argv array.
function toWindowsCommand(command: string, args: string[]): string {
  return [command, ...args]
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(" ");
}

/** Runs an SDK command without shell interpolation of user-provided values. */
export function runCli(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const callback = (
      error: CliError | null,
      stdout: string,
      stderr: string
    ) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    };

    if (isWindows) {
      exec(
        toWindowsCommand(command, args),
        { ...options, windowsHide: true },
        callback
      );
    } else {
      execFile(command, args, options, callback);
    }
  });
}

/** Spawns a long-running SDK process that is killed when the app quits. */
export function spawnCli(command: string, args: string[]): ChildProcess {
  const proc = isWindows
    ? spawn(toWindowsCommand(command, args), { shell: true, windowsHide: true })
    : // Own process group, so killTree also reaches the node process that
      // wrapper scripts like ares-inspect start.
      spawn(command, args, { detached: true });
  processManager.track(proc);
  return proc;
}

/** The most useful text of a failed CLI call: SDK tools often report errors on stdout. */
export function describeCliError(error: unknown): string {
  const { message = "", stdout = "", stderr = "" } = (error ?? {}) as CliError;
  return (stderr.trim() || stdout.trim() || message).slice(-2000);
}

/** Combined stdout/stderr/message of a failed CLI call, for error matching. */
export function cliOutput(error: unknown): string {
  const { message = "", stdout = "", stderr = "" } = (error ?? {}) as CliError;
  return [message, stdout, stderr].join("\n");
}

/**
 * Apps launched from Finder/desktop get a minimal PATH, so SDK tools (and the
 * `node` that ares-* scripts need) aren't found. Borrow the login shell's PATH.
 */
export function inheritLoginShellPath(): void {
  if (isWindows) return;
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const output = execFileSync(
      shell,
      ["-ilc", 'printf "__PATH__%s__PATH__" "$PATH"'],
      { encoding: "utf8", timeout: 5000 }
    );
    const shellPath = output.match(/__PATH__(.*)__PATH__/)?.[1];
    if (shellPath) {
      const merged = new Set([
        ...shellPath.split(":"),
        ...(process.env.PATH ?? "").split(":"),
      ]);
      process.env.PATH = [...merged].filter(Boolean).join(":");
    }
  } catch {
    // Keep the default PATH; explicit SDK paths still work.
  }
}
