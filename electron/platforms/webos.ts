import fs from "node:fs/promises";
import path from "node:path";
import type { Device } from "../../shared/ipc";
import { store } from "../store";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/errors";
import { runCli, spawnCli, cliOutput, describeCliError } from "../utils/cli";
import { DEPLOY_CONSTANTS, WEBOS_CONSTANTS } from "../utils/constants";
import * as secureStorage from "../common/secure-storage";
import {
  findNewestFile,
  replaceDebugSession,
  resolvePackage,
  checkTool,
  unreachableMessage,
} from "./common";
import type { LogFn, PlatformAdapter } from "./types";

const GETKEY_TIMEOUT_MS = 30000;
const INSPECT_RETRY_TIMEOUT_MS = 15000;

/** `aresPath` points at the `ares` binary; the other tools sit next to it as `ares-<tool>`. */
const ares = (tool: string) => {
  const aresPath = store.get("aresPath");
  return aresPath ? `${aresPath}-${tool}` : `ares-${tool}`;
};

function parseDeviceList(stdout: string): Device[] {
  const lines = stdout.split(/\r?\n/);
  const header = lines.findIndex(
    (line) => line.includes("deviceinfo") && line.includes("connection")
  );
  // Skip the header and the dashed separator under it.
  return lines
    .slice(header >= 0 ? header + 2 : 0)
    .map((line) => line.trim().split(/\s{2,}/))
    .map(([name, info]) => ({
      name: name?.replace(/ \(default\)/, "").trim(),
      match: info?.match(/([^@]+)@([\d.]+):(\d+)/),
    }))
    .filter(({ name, match }) => name && match)
    .map(({ name, match }) => ({
      name,
      username: match[1],
      ip: match[2],
      port: match[3],
    }));
}

// ares-setup-device has no upsert, so replace any entry with the same name.
async function register(device: Device): Promise<void> {
  await runCli(ares("setup-device"), ["--remove", device.name]).catch(
    () => undefined
  );
  await runCli(ares("setup-device"), [
    "--add",
    device.name,
    "--info",
    `username=${device.username || WEBOS_CONSTANTS.DEFAULT_USERNAME}`,
    "--info",
    `host=${device.ip}`,
    "--info",
    `port=${device.port || WEBOS_CONSTANTS.DEFAULT_PORT}`,
  ]);
}

/** Returns a warning instead of failing: the device is already registered at this point. */
async function storePassphrase(
  name: string,
  passphrase?: string | null
): Promise<string> {
  if (!passphrase) return "";
  try {
    await secureStorage.savePassphrase(name, passphrase);
    return "";
  } catch (error) {
    logger.warn("Could not save passphrase", error);
    return ` (passphrase not saved: ${getErrorMessage(error)})`;
  }
}

/** Fetches the TV's SSH key with the Developer Mode passphrase (answers the interactive prompt). */
function fetchSshKey(deviceName: string, passphrase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawnCli(ares("novacom"), [
      "--getkey",
      "--device",
      deviceName,
    ]);
    let output = "";
    let answered = false;

    const onOutput = (data: Buffer) => {
      output += data.toString();
      if (!answered && /passphrase/i.test(output)) {
        answered = true;
        proc.stdin?.write(`${passphrase}\n`);
      }
    };
    proc.stdout?.on("data", onOutput);
    proc.stderr?.on("data", onOutput);

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("Timed out fetching the SSH key from the TV."));
    }, GETKEY_TIMEOUT_MS);

    proc.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 || /success|generated/i.test(output)) resolve();
      else
        reject(
          new Error(
            `Failed to set up SSH keys: ${output.trim() || `exit code ${code}`}. Check the passphrase and that Key Server is on in the Developer Mode app.`
          )
        );
    });
  });
}

/** Some ares tools exit 0 but report failures on stderr. */
async function runAres(tool: string, args: string[]): Promise<void> {
  const { stderr } = await runCli(ares(tool), args);
  if (/error/i.test(stderr)) throw Object.assign(new Error(stderr), { stderr });
}

const readDeviceInfo = (deviceName: string) =>
  runAres("device-info", ["--device", deviceName]);

async function readAppId(projectPath: string): Promise<string> {
  const appInfoPath = path.join(projectPath, WEBOS_CONSTANTS.CONFIG_FILE);
  const content = await fs.readFile(appInfoPath, "utf-8").catch(() => {
    throw new Error(
      `${WEBOS_CONSTANTS.CONFIG_FILE} not found in ${projectPath}`
    );
  });
  const appId = JSON.parse(content).id;
  if (!appId) throw new Error(`No "id" in ${WEBOS_CONSTANTS.CONFIG_FILE}`);
  return appId;
}

const INSPECTOR_URL =
  /((?:https?|ws):\/\/(?:localhost|127\.0\.0\.1):\d+(?:\/[^\s"'<>]*)?|chrome-devtools:\/\/[^\s"'<>]+)/;

// Noise ares-inspect prints on every run that isn't actionable for the user.
const isInspectNoise = (line: string) =>
  /deprecat|^ares-inspect\s+warn\b|session#forward\(\) failed forwarding client localPort:\s*0/i.test(
    line
  );

/** Runs ares-inspect until it prints an inspector URL. The process stays alive to keep the tunnel open. */
function runInspector(
  args: string[],
  timeoutMs: number,
  log: LogFn
): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawnCli(ares("inspect"), args);
    let output = "";
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (url) replaceDebugSession(proc);
      else proc.kill();
      resolve(url);
    };

    const onOutput = (data: Buffer) => {
      const text = data.toString();
      output += text;
      for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
        if (line && !isInspectNoise(line) && !INSPECTOR_URL.test(line)) {
          log(line);
        }
      }
      const url = output.match(INSPECTOR_URL)?.[1];
      if (url) finish(url);
    };
    proc.stdout?.on("data", onOutput);
    proc.stderr?.on("data", onOutput);
    proc.on("error", (error) => {
      logger.error("ares-inspect failed", error);
      log(`Inspector error: ${error.message}`);
      finish(null);
    });
    proc.on("close", () => finish(output.match(INSPECTOR_URL)?.[1] ?? null));
    const timeout = setTimeout(() => finish(null), timeoutMs);
  });
}

async function startDebugSession(
  deviceName: string,
  appId: string,
  log: LogFn
): Promise<string> {
  const args = ["--device", deviceName, "--app", appId];
  const url =
    (await runInspector(args, DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS, log)) ??
    (log("Inspector URL not detected. Retrying with --open…"),
    await runInspector([...args, "--open"], INSPECT_RETRY_TIMEOUT_MS, log));

  if (!url) {
    log(
      "Could not start the web inspector automatically. Try running: ares-inspect --device <name> --app <id>"
    );
    return "Deployed, but the inspector could not be opened";
  }
  log(`Inspector: ${url}`);
  log("Open the link above in Chrome to debug your app.");
  return "Deployed in debug mode";
}

export const webosAdapter: PlatformAdapter = {
  async listDevices() {
    const { stdout } = await runCli(ares("setup-device"), ["--list"]);
    const withPassphrase = new Set(await secureStorage.getAllDeviceNames());
    return parseDeviceList(stdout).map((device) => ({
      ...device,
      hasPassphrase: withPassphrase.has(device.name),
    }));
  },

  async addDevice(device) {
    await register(device);
    const warning = await storePassphrase(device.name, device.passphrase);
    return `Registered ${device.name}${warning}`;
  },

  async updateDevice(previous, next) {
    await register(next);
    if (previous.name !== next.name) {
      await runCli(ares("setup-device"), ["--remove", previous.name]).catch(
        () => undefined
      );
      const oldPassphrase = await secureStorage.getPassphrase(previous.name);
      await secureStorage.deletePassphrase(previous.name);
      await storePassphrase(next.name, next.passphrase || oldPassphrase);
    } else {
      await storePassphrase(next.name, next.passphrase);
    }
  },

  async removeDevice(device) {
    await runCli(ares("setup-device"), ["--remove", device.name]);
    await secureStorage.deletePassphrase(device.name);
  },

  async testConnection(device) {
    try {
      await readDeviceInfo(device.name);
      return { message: `Connected to ${device.name}` };
    } catch (error) {
      const output = cliOutput(error);

      if (
        /All configured authentication methods failed|ssh exec failure/i.test(
          output
        )
      ) {
        const passphrase = await secureStorage.getPassphrase(device.name);
        if (!passphrase) {
          throw new Error(
            "The TV is reachable but SSH keys aren't set up. Edit the device and add the passphrase shown in the TV's Developer Mode app."
          );
        }
        await fetchSshKey(device.name, passphrase);
        await readDeviceInfo(device.name);
        return { message: `SSH key installed. Connected to ${device.name}` };
      }
      if (/EHOSTUNREACH|ETIMEDOUT|ECONNREFUSED/i.test(output)) {
        throw new Error(unreachableMessage());
      }
      if (/Invalid value/i.test(output)) {
        throw new Error(
          `Device "${device.name}" isn't registered with the webOS CLI.`
        );
      }
      throw new Error(describeCliError(error));
    }
  },

  async build(projectPath) {
    await readAppId(projectPath);
    const outputDir = path.dirname(projectPath);
    try {
      await runCli(ares("package"), [path.basename(projectPath)], {
        cwd: outputDir,
      });
    } catch (error) {
      throw new Error(describeCliError(error));
    }

    const built = await findNewestFile(
      outputDir,
      WEBOS_CONSTANTS.PACKAGE_EXTENSION
    );
    if (!built) throw new Error("ares-package did not produce an .ipk file.");

    const packagePath = path.join(projectPath, path.basename(built));
    await fs.rename(built, packagePath);
    return packagePath;
  },

  async deploy(device, target, mode, log) {
    const packagePath = await resolvePackage(
      target.projectPath,
      target.packagePath,
      WEBOS_CONSTANTS.PACKAGE_EXTENSION
    );
    const appId = await readAppId(target.projectPath);

    log(`Installing ${path.basename(packagePath)} on ${device.name}…`);
    await runAres("install", ["--device", device.name, packagePath]);
    log("Installation complete");

    log(`Launching ${appId}…`);
    await runAres("launch", ["--device", device.name, appId]);

    if (mode === "debug") {
      log("Starting web inspector…");
      return startDebugSession(device.name, appId, log);
    }
    return "Deployed and launched";
  },

  async verifySdk() {
    return [
      await checkTool("aresPath", "ares", ares("package"), ["--version"]),
    ];
  },
};
