import type { Platform } from "../../shared/ipc";
import { runCli, cliOutput } from "../utils/cli";
import { DEPLOY_CONSTANTS } from "../utils/constants";
import {
  assertReachable,
  knownDevices,
  mergeWithKnownDevices,
  unreachableMessage,
} from "./common";
import { parseAttachedSerials } from "./parsers";
import type { PlatformAdapter } from "./types";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** What differs between sdb (Tizen) and adb (Android). */
export interface BridgeConfig {
  platform: Platform;
  cli: () => string;
  /** The TV's debug bridge port. */
  port: number;
  /** How to open the port on the TV, e.g. "Turn on Developer Mode". */
  portFix: string;
  /** A user-facing error for a failed `connect`, when the output is recognised. */
  connectError?: (output: string) => string | undefined;
  /** Tizen reads the TV's DUID once connected. */
  readDuid?: (serial: string) => Promise<string | undefined>;
}

type DeviceMethods = Pick<
  PlatformAdapter,
  | "listDevices"
  | "addDevice"
  | "updateDevice"
  | "removeDevice"
  | "testConnection"
>;

/**
 * Device handling shared by sdb and adb: both list attached devices, connect
 * over the network as ip:port and forget TVs once disconnected, so the TVs
 * the user added are remembered separately (see knownDevices).
 */
export function createBridge(config: BridgeConfig) {
  const { platform, cli, port } = config;
  // Emulators and USB devices are listed by name rather than IP.
  const serialOf = (ip: string) => (IPV4.test(ip) ? `${ip}:${port}` : ip);
  const ipOf = (serial: string) => serial.replace(new RegExp(`:${port}$`), "");

  async function attachedIps(): Promise<string[]> {
    const { stdout } = await runCli(cli(), ["devices"]);
    return parseAttachedSerials(stdout).map(ipOf);
  }

  async function connect(ip: string): Promise<void> {
    if ((await attachedIps()).includes(ip)) return;
    if (IPV4.test(ip)) await assertReachable(ip, port, config.portFix);

    let output = "";
    try {
      const { stdout, stderr } = await runCli(
        cli(),
        ["connect", serialOf(ip)],
        {
          timeout: DEPLOY_CONSTANTS.CONNECTION_TIMEOUT_MS,
        }
      );
      output = stdout + stderr;
    } catch (error) {
      output = cliOutput(error);
    }

    // connect can exit 0 even when it fails, so trust the device list instead.
    if (!(await attachedIps()).includes(ip)) {
      const known = config.connectError?.(output);
      if (known) throw new Error(known);
      if (/no route|unreachable|timed? ?out/i.test(output)) {
        throw new Error(unreachableMessage());
      }
      throw new Error(output.trim() || `Could not connect to ${ip}.`);
    }
  }

  const disconnect = (ip: string) =>
    runCli(cli(), ["disconnect", serialOf(ip)]).catch(() => undefined);

  /** Connects and remembers the TV, with its DUID where the platform has one. */
  async function connectAndRemember(ip: string, name: string) {
    await connect(ip);
    const duid = await config.readDuid?.(serialOf(ip));
    knownDevices.remember(platform, ip, { name, duid });
    return duid;
  }

  const devices: DeviceMethods = {
    async listDevices() {
      return mergeWithKnownDevices(platform, await attachedIps());
    },

    async addDevice(device) {
      await connectAndRemember(device.ip, device.name);
      return `Connected to ${device.name || device.ip}`;
    },

    async updateDevice(previous, next) {
      if (previous.ip !== next.ip) {
        await connect(next.ip);
        await disconnect(previous.ip);
        knownDevices.forget(platform, previous.ip);
      }
      knownDevices.remember(platform, next.ip, { name: next.name });
    },

    async removeDevice(device) {
      await disconnect(device.ip);
      knownDevices.forget(platform, device.ip);
    },

    async testConnection(device) {
      const duid = await connectAndRemember(device.ip, device.name);
      return { message: `Connected to ${device.name || device.ip}`, duid };
    },
  };

  return { serialOf, connect, devices };
}
