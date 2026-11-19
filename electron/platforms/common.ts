import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { Device, Platform, SdkPaths, ToolCheck } from "../../shared/ipc";
import { store } from "../store";
import { runCli, cliOutput, killTree } from "../utils/cli";

interface KnownDevice {
  name: string;
  duid?: string;
}

type KnownDevices = Record<string, KnownDevice>;

const knownDevicesKey = (platform: Platform) => `known-devices:${platform}`;

/**
 * sdb/adb only report what is attached right now, so TVs the user added are
 * remembered here (keyed by IP) and survive SDK server restarts and reboots.
 */
export const knownDevices = {
  get(platform: Platform): KnownDevices {
    return store.getExtra<KnownDevices>(knownDevicesKey(platform)) ?? {};
  },
  remember(platform: Platform, ip: string, entry: Partial<KnownDevice>) {
    const all = this.get(platform);
    all[ip] = { name: ip, ...all[ip], ...stripEmpty(entry) };
    store.setExtra(knownDevicesKey(platform), all);
  },
  forget(platform: Platform, ip: string) {
    const all = this.get(platform);
    delete all[ip];
    store.setExtra(knownDevicesKey(platform), all);
  },
};

function stripEmpty<T extends object>(entry: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(entry).filter(([, value]) => value)
  ) as Partial<T>;
}

/** Remembered devices plus anything currently attached. */
export function mergeWithKnownDevices(
  platform: Platform,
  connectedIps: string[]
): Device[] {
  const known = knownDevices.get(platform);
  const ips = new Set([...connectedIps, ...Object.keys(known)]);
  return [...ips].map((ip) => ({
    ip,
    name: known[ip]?.name || ip,
    duid: known[ip]?.duid,
  }));
}

export async function findNewestFile(
  dir: string,
  extension: string
): Promise<string | null> {
  const entries = await fs.readdir(dir);
  let newest: { file: string; mtime: number } | null = null;
  for (const file of entries.filter((f) => f.endsWith(extension))) {
    const { mtimeMs } = await fs.stat(path.join(dir, file));
    if (!newest || mtimeMs > newest.mtime) newest = { file, mtime: mtimeMs };
  }
  return newest ? path.join(dir, newest.file) : null;
}

/** Uses the package from the last build, falling back to the newest one in the project. */
export async function resolvePackage(
  projectPath: string,
  packagePath: string | undefined,
  extension: string
): Promise<string> {
  if (packagePath) {
    try {
      await fs.access(packagePath);
      return packagePath;
    } catch {
      // Package was moved or deleted; fall back to scanning the project.
    }
  }
  const newest = await findNewestFile(projectPath, extension).catch(() => {
    throw new Error(`Project folder not found: ${projectPath}`);
  });
  if (!newest) {
    throw new Error(
      `No ${extension} package found in ${projectPath}. Build the package first.`
    );
  }
  return newest;
}

export async function checkTool(
  key: keyof SdkPaths,
  tool: string,
  command: string,
  args: string[]
): Promise<ToolCheck> {
  try {
    const { stdout, stderr } = await runCli(command, args, { timeout: 15000 });
    const firstLine = (stdout || stderr).trim().split(/\r?\n/)[0] ?? "";
    return { key, tool, ok: true, detail: firstLine || "Available" };
  } catch (error) {
    const output = cliOutput(error);
    const notFound = /ENOENT|not found|not recognized/i.test(output);
    return {
      key,
      tool,
      ok: false,
      detail: notFound
        ? `${command} was not found. Set its full path or add it to your PATH.`
        : output.trim().split(/\r?\n/)[0],
    };
  }
}

export function unreachableMessage(): string {
  return process.platform === "darwin"
    ? "TV unreachable. Check it is on, on the same network, and that its IP hasn't changed. If it answers ping, allow CTV Bridge under System Settings → Privacy & Security → Local Network, then restart the app."
    : "TV unreachable. Check it is on, on the same network, and that its IP hasn't changed.";
}

const PROBE_TIMEOUT_MS = 3000;

/** Fails within seconds when nothing answers on the TV's port, instead of waiting out the CLI's timeout. */
export async function assertReachable(
  ip: string,
  port: number | string,
  /** How to open the port on the TV, e.g. "Turn on Developer Mode". */
  fix: string
): Promise<void> {
  const result = await probePort(ip, Number(port));
  // Refused can also mean the TV's IP now belongs to another device.
  if (result === "refused")
    throw new Error(
      `${ip} refused the connection. ${fix}, or check the TV's IP hasn't changed.`
    );
  if (result === "unreachable") throw new Error(unreachableMessage());
}

function probePort(
  host: string,
  port: number
): Promise<"open" | "refused" | "unreachable"> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: PROBE_TIMEOUT_MS });
    const done = (result: "open" | "refused" | "unreachable") => {
      socket.destroy();
      resolve(result);
    };
    socket.once("connect", () => done("open"));
    socket.once("timeout", () => done("unreachable"));
    socket.once("error", (error: NodeJS.ErrnoException) =>
      done(error.code === "ECONNREFUSED" ? "refused" : "unreachable")
    );
  });
}

let debugSessionCleanup: (() => void)[] = [];

/** Ends the running debug session: kills its bridge process and removes its port forwards. */
export function endDebugSession(): void {
  debugSessionCleanup.forEach((cleanup) => cleanup());
  debugSessionCleanup = [];
}

/** Keeps a bridge process alive until the debug session ends. */
export function addDebugProcess(proc: ChildProcess): void {
  debugSessionCleanup.push(() => killTree(proc));
}

/** Removes a `forward tcp:PORT` (sdb or adb) when the debug session ends. */
export function addDebugForward(
  cli: string,
  serial: string,
  port: number | string
): void {
  debugSessionCleanup.push(() => {
    runCli(cli, ["-s", serial, "forward", "--remove", `tcp:${port}`]).catch(
      () => {}
    );
  });
}
