import fs from "node:fs/promises";
import path from "node:path";
import type { Device } from "../../shared/ipc";
import { store } from "../store";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/errors";
import {
  runCli,
  spawnCli,
  cliOutput,
  describeCliError,
  killTree,
  waitForOutput,
} from "../utils/cli";
import { DEPLOY_CONSTANTS, WEBOS_CONSTANTS } from "../utils/constants";
import {
  findNewestFile,
  addDebugProcess,
  resolvePackage,
  checkTool,
  unreachableMessage,
  assertReachable,
} from "./common";
import { findInspectorUrl, isInspectLogLine } from "./parsers";
import { discoverInspector } from "./inspector";
import type { DeployOutcome, LogFn, PlatformAdapter } from "./types";

const GETKEY_TIMEOUT_MS = 30000;
const INSPECT_RETRY_TIMEOUT_MS = 15000;

/** `aresPath` points at the `ares` binary; the other tools sit next to it as `ares-<tool>`. */
const ares = (tool: string) => {
  const aresPath = store.get("aresPath");
  return aresPath ? `${aresPath}-${tool}` : `ares-${tool}`;
};

interface AresDevice {
  name: string;
  deviceinfo?: { ip?: string; port?: string; user?: string };
  details?: { privatekey?: string; passphrase?: string };
}

/** Devices as the webOS CLI stores them, including SSH key details. */
async function listAresDevices(): Promise<AresDevice[]> {
  const { stdout } = await runCli(ares("setup-device"), ["--listfull"]);
  return JSON.parse(stdout) as AresDevice[];
}

const findAresDevice = async (name: string) =>
  (await listAresDevices()).find((device) => device.name === name);

/**
 * The webOS CLI keeps each device's SSH key and passphrase in its own config,
 * so we update entries in place (`--modify`) rather than recreating them,
 * which would throw that away and force a new key fetch.
 */
async function register(device: Device, existing?: AresDevice): Promise<void> {
  const info: Record<string, string | undefined> = {
    username: device.username || WEBOS_CONSTANTS.DEFAULT_USERNAME,
    host: device.ip,
    port: device.port || WEBOS_CONSTANTS.DEFAULT_PORT,
    // Carried over on rename; replaced when the user enters a new passphrase.
    privatekey: existing?.details?.privatekey,
    passphrase: device.passphrase || existing?.details?.passphrase,
  };
  const infoArgs = Object.entries(info)
    .filter(([, value]) => value)
    .flatMap(([key, value]) => ["--info", `${key}=${value}`]);

  const modify = existing?.name === device.name;
  await runCli(ares("setup-device"), [
    modify ? "--modify" : "--add",
    device.name,
    ...infoArgs,
  ]);
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
      killTree(proc);
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

// ares-device-info is deprecated in CLI 3.x and errors out; older CLIs lack ares-device.
const readDeviceInfo = (deviceName: string) =>
  runAres("device", ["--system-info", "--device", deviceName]).catch(
    (error: NodeJS.ErrnoException) =>
      error.code === "ENOENT"
        ? runAres("device-info", ["--device", deviceName])
        : Promise.reject(error)
  );

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

/** Runs ares-inspect until it prints an inspector URL. The process stays alive to keep the tunnel open. */
async function runInspector(
  args: string[],
  timeoutMs: number,
  log: LogFn
): Promise<string | undefined> {
  const proc = spawnCli(ares("inspect"), args);
  const url = await waitForOutput(proc, findInspectorUrl, timeoutMs, (line) => {
    if (isInspectLogLine(line)) log(line);
  }).catch((error: Error) => {
    logger.error("ares-inspect failed", error);
    log(`Inspector error: ${error.message}`);
    return undefined;
  });
  if (url) addDebugProcess(proc);
  else killTree(proc);
  return url;
}

async function startDebugSession(
  deviceName: string,
  appId: string,
  log: LogFn
): Promise<DeployOutcome> {
  const args = ["--device", deviceName, "--app", appId];
  const url =
    (await runInspector(args, DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS, log)) ??
    (log("Inspector URL not detected. Retrying with --open…"),
    await runInspector([...args, "--open"], INSPECT_RETRY_TIMEOUT_MS, log));

  if (!url) {
    log(
      "Could not start the web inspector automatically. Try running: ares-inspect --device <name> --app <id>"
    );
    return { message: "Deployed, but the inspector could not be opened" };
  }

  const port = Number(new URL(url).port);
  const inspectorUrl = port ? await discoverInspector(port, appId) : undefined;
  if (inspectorUrl) return { message: "Deployed in debug mode", inspectorUrl };

  log(`Inspector: ${url}`);
  log("Open the link above in Chrome to debug your app.");
  return { message: "Deployed in debug mode" };
}

/** Fetches the SSH key when a passphrase is known; reports instead of failing. */
async function trySetUpSshKey(device: Device): Promise<string> {
  if (!device.passphrase) return "";
  try {
    await fetchSshKey(device.name, device.passphrase);
    return ". SSH key installed";
  } catch (error) {
    logger.warn("SSH key fetch failed", error);
    return `. The SSH key will be fetched when you connect (${getErrorMessage(error)})`;
  }
}

export const webosAdapter: PlatformAdapter = {
  async listDevices() {
    return (await listAresDevices()).map((device) => ({
      name: device.name,
      ip: device.deviceinfo?.ip ?? "",
      port: device.deviceinfo?.port,
      username: device.deviceinfo?.user,
      hasPassphrase: !!device.details?.passphrase,
    }));
  },

  async addDevice(device) {
    if (await findAresDevice(device.name)) {
      throw new Error(`A TV named "${device.name}" already exists.`);
    }
    await register(device);
    return `Registered ${device.name}${await trySetUpSshKey(device)}`;
  },

  async updateDevice(previous, next) {
    const existing = await findAresDevice(previous.name);
    await register(next, existing);
    if (previous.name !== next.name) {
      await runCli(ares("setup-device"), ["--remove", previous.name]);
    }
    await trySetUpSshKey(next);
  },

  async removeDevice(device) {
    await runCli(ares("setup-device"), ["--remove", device.name]);
  },

  async testConnection(device) {
    await assertReachable(
      device.ip,
      device.port || WEBOS_CONSTANTS.DEFAULT_PORT,
      "Open the Developer Mode app on the TV and turn Dev Mode on"
    );
    try {
      await readDeviceInfo(device.name);
      return { message: `Connected to ${device.name}` };
    } catch (error) {
      const output = cliOutput(error);

      if (
        /All configured authentication methods failed|ssh exec failure|private ?key/i.test(
          output
        )
      ) {
        const passphrase = (await findAresDevice(device.name))?.details
          ?.passphrase;
        if (!passphrase) {
          throw new Error(
            "The TV is reachable but its SSH key isn't set up. Edit the TV and enter the passphrase shown in the Developer Mode app."
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
    return { message: "Deployed and launched" };
  },

  async appAction(device, target, action) {
    const appId = await readAppId(target.projectPath);
    if (action === "uninstall") {
      await runAres("install", ["--device", device.name, "--remove", appId]);
      return `Uninstalled ${appId}`;
    }
    const close = runAres("launch", [
      "--device",
      device.name,
      "--close",
      appId,
    ]);
    if (action === "stop") {
      await close;
      return `Stopped ${appId}`;
    }
    // Closing fails when the app isn't running, which is fine before a launch.
    await close.catch(() => undefined);
    await runAres("launch", ["--device", device.name, appId]);
    return `Restarted ${appId}`;
  },

  async verifySdk() {
    return [
      await checkTool("aresPath", "ares", ares("package"), ["--version"]),
    ];
  },
};
