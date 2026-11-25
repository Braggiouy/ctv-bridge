import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TizenProfile } from "../../shared/ipc";
import { store } from "../store";
import { logger } from "../utils/logger";
import {
  runCli,
  spawnCli,
  cliOutput,
  describeCliError,
  waitForOutput,
} from "../utils/cli";
import { getErrorMessage } from "../utils/errors";
import {
  BUILD_CONSTANTS,
  DEPLOY_CONSTANTS,
  TIZEN_CONSTANTS,
} from "../utils/constants";
import {
  findNewestFile,
  addDebugForward,
  addDebugProcess,
  resolvePackage,
  checkTool,
  localIpFor,
} from "./common";
import { createBridge } from "./bridge";
import {
  findDebugPort,
  findProfilesXmlPath,
  parseDuid,
  parseProfilesTable,
  parseProfilesXml,
  parseTizenAppId,
} from "./parsers";
import { attachInspector } from "./inspector";
import type { DeployOutcome, LogFn, PlatformAdapter } from "./types";

const sdb = () => store.get("sdbPath") || "sdb";
const tizen = () => store.get("tizenPath") || "tizen";

const timedOut = (error: unknown) =>
  (error as { killed?: boolean } | null)?.killed === true;

// A wedged sdb server accepts connections but never answers, until it's restarted.
async function restartSdbAfterTimeout(what: string): Promise<never> {
  await runCli(sdb(), ["kill-server"]).catch(() => undefined);
  throw new Error(
    `${what}, so CTV Bridge restarted sdb. Try again; if it happens again, restart the TV.`
  );
}

async function readDuid(serial: string): Promise<string | undefined> {
  try {
    const { stdout } = await runCli(
      sdb(),
      ["-s", serial, "shell", "0", "getduid"],
      { timeout: DEPLOY_CONSTANTS.RESPONSE_TIMEOUT_MS }
    );
    return parseDuid(stdout);
  } catch (error) {
    if (timedOut(error)) await restartSdbAfterTimeout("The TV didn't respond");
    return undefined;
  }
}

const { serialOf, connect, devices } = createBridge({
  platform: "tizen",
  cli: sdb,
  port: TIZEN_CONSTANTS.DEFAULT_PORT,
  portFix: "Turn on Developer Mode with this computer's IP as the Host PC IP",
  connectError: (output, ip) => {
    if (/refused/i.test(output)) {
      return "Connection refused. Enable Developer Mode on the TV and set this computer's IP as the Host PC IP.";
    }
    // The port answered (see assertReachable), so the TV is on but won't talk to this computer.
    if (/failed to connect/i.test(output)) {
      const hostIp = localIpFor(ip) ?? "this computer's IP";
      return `The TV is on but refused sdb. In the TV's Developer Mode, set the Host PC IP to ${hostIp}, then restart the TV.`;
    }
  },
  readDuid,
});

async function readAppId(projectPath: string): Promise<string> {
  const configPath = path.join(projectPath, TIZEN_CONSTANTS.CONFIG_FILE);
  const content = await fs.readFile(configPath, "utf-8").catch(() => {
    throw new Error(
      `${TIZEN_CONSTANTS.CONFIG_FILE} not found in ${projectPath}`
    );
  });
  return parseTizenAppId(content);
}

async function install(
  packagePath: string,
  serial: string,
  appId: string,
  log: LogFn
): Promise<void> {
  const installArgs = ["install", "-n", packagePath, "-s", serial];
  const options = { timeout: DEPLOY_CONSTANTS.INSTALL_TIMEOUT_MS };
  try {
    await runCli(tizen(), installArgs, options);
  } catch (error) {
    if (timedOut(error))
      await restartSdbAfterTimeout("Installing took over 5 minutes");
    const output = cliOutput(error);
    const authorMismatch =
      /author certificate not match|install failed\[118,\s*-11\]/i.test(output);
    if (!authorMismatch) {
      throw new Error(
        `Installation failed: ${describeCliError(error)}. Common causes: storage, Developer Mode, or a certificate without this TV's DUID.`
      );
    }

    log(
      "Installed app was signed with a different author certificate. Reinstalling…"
    );
    await runCli(tizen(), ["uninstall", "-p", appId, "-s", serial]).catch(
      (uninstallError) =>
        logger.warn("Uninstall before reinstall failed", uninstallError)
    );
    await runCli(tizen(), installArgs, options);
  }
}

/** Launches the app in debug mode and forwards its inspector port. */
async function startDebugSession(
  serial: string,
  appId: string,
  log: LogFn
): Promise<DeployOutcome> {
  const proc = spawnCli(sdb(), ["-s", serial, "shell", "0", "debug", appId]);
  addDebugProcess(proc);

  let port: string | undefined;
  try {
    port = await waitForOutput(
      proc,
      findDebugPort,
      DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS,
      log
    );
  } catch (error) {
    log(`Failed to start debug session: ${getErrorMessage(error)}`);
    return { message: "Deployed, but the debug session failed to start" };
  }
  if (!port) {
    log(
      `Debug port not detected within ${DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS / 1000}s. If a port appears above, run: sdb -s ${serial} forward tcp:<PORT> tcp:<PORT>`
    );
    return { message: "Deployed in debug mode (debug port not detected)" };
  }

  try {
    await runCli(sdb(), [
      "-s",
      serial,
      "forward",
      `tcp:${port}`,
      `tcp:${port}`,
    ]);
    addDebugForward(sdb(), serial, port);
  } catch (error) {
    log(
      `Port forwarding failed (${describeCliError(error)}). Run: sdb -s ${serial} forward tcp:${port} tcp:${port}`
    );
    return {
      message: "Deployed in debug mode (manual port forwarding needed)",
    };
  }
  // Page URLs contain the package ID (the part before the dot), not the app ID.
  return attachInspector(Number(port), appId.split(".")[0], log);
}

export const tizenAdapter: PlatformAdapter = {
  ...devices,

  async build(projectPath, profileName) {
    await readAppId(projectPath);

    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), BUILD_CONSTANTS.TEMP_DIR_PREFIX)
    );
    try {
      // Package from a clean copy so stale signatures and packages aren't bundled.
      await fs.cp(projectPath, tempDir, {
        recursive: true,
        filter: (source) => {
          const relative = path.relative(projectPath, source);
          if (!relative || relative.includes(path.sep)) return true;
          return !BUILD_CONSTANTS.EXCLUDE_PATTERNS.some(
            (pattern) =>
              relative.startsWith(pattern) || relative.endsWith(pattern)
          );
        },
      });

      const args = ["package", "-t", "wgt"];
      if (profileName) args.push("-p", profileName);
      try {
        await runCli(tizen(), args, { cwd: tempDir });
      } catch (error) {
        throw new Error(describeCliError(error));
      }

      const built = await findNewestFile(
        tempDir,
        TIZEN_CONSTANTS.PACKAGE_EXTENSION
      );
      if (!built) throw new Error("tizen package did not produce a .wgt file.");

      // tizen install can't handle spaces in the path, and app names often contain them.
      const packagePath = path.join(
        projectPath,
        path.basename(built).replace(/\s+/g, "")
      );
      await fs.copyFile(built, packagePath);
      return packagePath;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  },

  async deploy(device, target, mode, log) {
    const serial = serialOf(device.ip);
    log(`Connecting to ${device.name || device.ip}…`);
    await connect(device.ip);

    const packagePath = await resolvePackage(
      target.projectPath,
      target.packagePath,
      TIZEN_CONSTANTS.PACKAGE_EXTENSION
    );
    const appId = await readAppId(target.projectPath);

    log(`Installing ${path.basename(packagePath)}…`);
    await install(packagePath, serial, appId, log);
    log("Installation complete");

    if (mode === "debug") {
      log("Starting app in debug mode…");
      return startDebugSession(serial, appId, log);
    }

    log("Launching application…");
    await runCli(tizen(), ["run", "-p", appId, "-s", serial]);
    return { message: "Deployed and launched" };
  },

  async appAction(device, target, action) {
    const serial = serialOf(device.ip);
    await connect(device.ip);
    const appId = await readAppId(target.projectPath);

    if (action === "uninstall") {
      // Exits 0 even when there's nothing to uninstall.
      const { stdout, stderr } = await runCli(tizen(), [
        "uninstall",
        "-p",
        appId,
        "-s",
        serial,
      ]);
      if (/not valid|not installed/i.test(stdout + stderr)) {
        throw new Error("The app isn't installed on the TV.");
      }
      return `Uninstalled ${appId}`;
    }
    // Takes the package ID (the part before the dot); does nothing if the app isn't running.
    await runCli(sdb(), [
      "-s",
      serial,
      "shell",
      "0",
      "was_kill",
      appId.split(".")[0],
    ]);
    if (action === "stop") return `Stopped ${appId}`;
    await runCli(tizen(), ["run", "-p", appId, "-s", serial]).catch((error) => {
      throw new Error(
        /not available/i.test(cliOutput(error))
          ? "The app isn't installed on the TV. Use Run to install it."
          : describeCliError(error)
      );
    });
    return `Restarted ${appId}`;
  },

  async verifySdk() {
    return Promise.all([
      checkTool("sdbPath", "sdb", sdb(), ["version"]),
      checkTool("tizenPath", "tizen", tizen(), ["version"]),
    ]);
  },
};

// ── Security profiles ────────────────────────────────────────────────────────

export async function listTizenProfiles(): Promise<TizenProfile[]> {
  const { stdout } = await runCli(tizen(), ["security-profiles", "list"]);

  const xmlPath = findProfilesXmlPath(stdout);
  if (xmlPath) {
    try {
      const profiles = parseProfilesXml(await fs.readFile(xmlPath, "utf-8"));
      if (profiles.length > 0) return profiles;
    } catch (error) {
      logger.warn("Failed to read profiles.xml, using CLI output", error);
    }
  }
  return parseProfilesTable(stdout);
}

export async function deleteTizenProfile(name: string): Promise<void> {
  const profiles = await listTizenProfiles();
  const target = profiles.find((profile) => profile.name === name.trim());
  if (!target) throw new Error(`Profile "${name}" was not found.`);

  // Some Tizen CLI builds refuse to delete the active profile.
  if (target.active) {
    const replacement = profiles.find((profile) => profile !== target);
    if (!replacement) {
      throw new Error(
        "Cannot delete the only (active) profile. Create another profile first."
      );
    }
    await runCli(tizen(), [
      "security-profiles",
      "set-active",
      "-n",
      replacement.name,
    ]);
  }
  await runCli(tizen(), ["security-profiles", "remove", "-n", target.name]);
}
