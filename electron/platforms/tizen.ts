import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Device, TizenProfile } from "../../shared/ipc";
import { store } from "../store";
import { logger } from "../utils/logger";
import { runCli, spawnCli, cliOutput, describeCliError } from "../utils/cli";
import {
  BUILD_CONSTANTS,
  DEPLOY_CONSTANTS,
  TIZEN_CONSTANTS,
} from "../utils/constants";
import {
  findNewestFile,
  knownDevices,
  mergeWithKnownDevices,
  parseAttachedSerials,
  replaceDebugSession,
  resolvePackage,
  checkTool,
  unreachableMessage,
} from "./common";
import type { LogFn, PlatformAdapter } from "./types";

const sdb = () => store.get("sdbPath") || "sdb";
const tizen = () => store.get("tizenPath") || "tizen";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
// Emulators are listed by name (e.g. emulator-26101) rather than IP.
const serialOf = (ip: string) =>
  IPV4.test(ip) ? `${ip}:${TIZEN_CONSTANTS.DEFAULT_PORT}` : ip;
const ipOf = (serial: string) => serial.replace(/:\d+$/, "");

async function attachedIps(): Promise<string[]> {
  const { stdout } = await runCli(sdb(), ["devices"]);
  return parseAttachedSerials(stdout).map(ipOf);
}

async function connect(ip: string): Promise<void> {
  if ((await attachedIps()).includes(ip)) return;

  let output = "";
  try {
    const { stdout, stderr } = await runCli(sdb(), ["connect", serialOf(ip)], {
      timeout: DEPLOY_CONSTANTS.CONNECTION_TIMEOUT_MS,
    });
    output = stdout + stderr;
  } catch (error) {
    output = cliOutput(error);
  }

  // sdb connect exits 0 even when it fails, so trust the device list instead.
  if (!(await attachedIps()).includes(ip)) {
    if (/refused/i.test(output)) {
      throw new Error(
        "Connection refused. Enable Developer Mode on the TV and set this computer's IP as the Host PC IP."
      );
    }
    if (/no route|unreachable|timed? ?out/i.test(output)) {
      throw new Error(unreachableMessage());
    }
    throw new Error(output.trim() || `Could not connect to ${ip}.`);
  }
}

async function readDuid(ip: string): Promise<string | undefined> {
  try {
    const { stdout } = await runCli(sdb(), [
      "-s",
      serialOf(ip),
      "shell",
      "0",
      "getduid",
    ]);
    const duid = stdout.trim();
    return /^[A-Z0-9]{10,}$/i.test(duid) ? duid : undefined;
  } catch {
    return undefined;
  }
}

async function readAppId(projectPath: string): Promise<string> {
  const configPath = path.join(projectPath, TIZEN_CONSTANTS.CONFIG_FILE);
  const content = await fs.readFile(configPath, "utf-8").catch(() => {
    throw new Error(
      `${TIZEN_CONSTANTS.CONFIG_FILE} not found in ${projectPath}`
    );
  });
  const appId = content.match(TIZEN_CONSTANTS.APP_ID_PATTERN)?.[1];
  if (!appId) {
    throw new Error(
      `Could not find <tizen:application id> in ${TIZEN_CONSTANTS.CONFIG_FILE}`
    );
  }
  if (/^https?:\/\//.test(appId)) {
    throw new Error(
      `Invalid Tizen app ID "${appId}": <tizen:application id> must be an app ID, not a URL.`
    );
  }
  return appId;
}

async function install(
  packagePath: string,
  serial: string,
  appId: string,
  log: LogFn
): Promise<void> {
  const installArgs = ["install", "-n", packagePath, "-s", serial];
  try {
    await runCli(tizen(), installArgs);
  } catch (error) {
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
    await runCli(tizen(), installArgs);
  }
}

function startDebugSession(
  serial: string,
  appId: string,
  log: LogFn
): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawnCli(sdb(), ["-s", serial, "shell", "0", "debug", appId]);
    replaceDebugSession(proc);

    let output = "";
    let settled = false;
    const settle = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(message);
    };

    const showInspectorSteps = (port: string) => {
      log(`Debug port: ${port}`);
      log(`1. Open chrome://inspect/#devices in Chrome`);
      log(`2. Click "Configure…" and add localhost:${port}`);
      log(`3. Click "inspect" under your app`);
    };

    const onOutput = async (data: Buffer) => {
      const text = data.toString();
      if (text.trim()) log(text.trim());
      if (settled) return;
      output += text;

      // e.g. "port: 7011", "debug 7011", "ws://127.0.0.1:7011/devtools/…"
      const port = output.match(
        /(?:\b(?:port|debug)\b\s*[:=]?\s*|localhost:|127\.0\.0\.1:)(\d{4,5})\b/i
      )?.[1];
      if (!port) return;
      settled = true;
      clearTimeout(timeout);

      try {
        await runCli(sdb(), [
          "-s",
          serial,
          "forward",
          `tcp:${port}`,
          `tcp:${port}`,
        ]);
        showInspectorSteps(port);
        resolve("Deployed in debug mode");
      } catch (error) {
        showInspectorSteps(port);
        log(
          `Port forwarding failed (${describeCliError(error)}). Run: sdb -s ${serial} forward tcp:${port} tcp:${port}`
        );
        resolve("Deployed in debug mode (manual port forwarding needed)");
      }
    };

    proc.stdout?.on("data", onOutput);
    proc.stderr?.on("data", onOutput);
    proc.on("error", (error) => {
      log(`Failed to start debug session: ${error.message}`);
      settle("Deployed, but the debug session failed to start");
    });

    const timeout = setTimeout(() => {
      log(
        `Debug port not detected within ${DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS / 1000}s. If a port appears above, run: sdb -s ${serial} forward tcp:<PORT> tcp:<PORT>`
      );
      settle("Deployed in debug mode (debug port not detected)");
    }, DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS);
  });
}

export const tizenAdapter: PlatformAdapter = {
  async listDevices() {
    return mergeWithKnownDevices("tizen", await attachedIps());
  },

  async addDevice(device) {
    await connect(device.ip);
    knownDevices.remember("tizen", device.ip, {
      name: device.name,
      duid: await readDuid(device.ip),
    });
    return `Connected to ${device.name || device.ip}`;
  },

  async updateDevice(previous, next) {
    if (previous.ip !== next.ip) {
      await connect(next.ip);
      await runCli(sdb(), ["disconnect", serialOf(previous.ip)]).catch(
        () => undefined
      );
      knownDevices.forget("tizen", previous.ip);
    }
    knownDevices.remember("tizen", next.ip, { name: next.name });
  },

  async removeDevice(device) {
    await runCli(sdb(), ["disconnect", serialOf(device.ip)]).catch(
      () => undefined
    );
    knownDevices.forget("tizen", device.ip);
  },

  async testConnection(device: Device) {
    await connect(device.ip);
    const duid = await readDuid(device.ip);
    knownDevices.remember("tizen", device.ip, { name: device.name, duid });
    return { message: `Connected to ${device.name || device.ip}`, duid };
  },

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
    return "Deployed and launched";
  },

  async verifySdk() {
    return Promise.all([
      checkTool("sdbPath", "sdb", sdb(), ["version"]),
      checkTool("tizenPath", "tizen", tizen(), ["version"]),
    ]);
  },
};

// ── Security profiles ────────────────────────────────────────────────────────

function parseProfilesXml(xml: string): TizenProfile[] {
  const activeName =
    xml.match(/<profiles[^>]*\sactive="([^"]*)"/i)?.[1]?.trim() ?? "";
  return [...xml.matchAll(/<profile\s+name="([^"]+)"/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .map((name) => ({ name, active: name === activeName }));
}

function parseProfilesTable(stdout: string): TizenProfile[] {
  const isNoise = (line: string) =>
    !line ||
    line.includes("------") ||
    /^(security-profiles\s+list|loaded\b|available\s*:?$|\[profile\s+name\]|name\s+active)/i.test(
      line
    );

  const lines = stdout.split(/\r?\n/).map((line) => line.trim());
  const headerIndex = lines.findIndex(
    (line) => line.includes("Name") && line.includes("Active")
  );
  const rows = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;

  return rows
    .filter((line) => !isNoise(line))
    .map((line) => {
      // "name   O", or "nameO" when some CLI versions glue the marker to long names
      const match = line.match(/^(.*\S)\s*([OX])$/i);
      return match
        ? { name: match[1].trim(), active: match[2].toUpperCase() === "O" }
        : { name: line, active: false };
    })
    .filter(({ name }) => name && !name.endsWith(":"));
}

export async function listTizenProfiles(): Promise<TizenProfile[]> {
  const { stdout } = await runCli(tizen(), ["security-profiles", "list"]);

  const xmlPath = stdout.match(/Loaded in '([^']+)'\./i)?.[1];
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
