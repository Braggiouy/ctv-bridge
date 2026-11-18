import fs from "node:fs/promises";
import path from "node:path";
import { store } from "../store";
import { runCli, cliOutput, describeCliError } from "../utils/cli";
import { ANDROID_CONSTANTS, DEPLOY_CONSTANTS } from "../utils/constants";
import {
  knownDevices,
  mergeWithKnownDevices,
  parseAttachedSerials,
  checkTool,
  unreachableMessage,
} from "./common";
import type { LogFn, PlatformAdapter } from "./types";

const adb = () => store.get("adbPath") || "adb";

// adb lists network devices as ip:5555; USB devices keep their serial.
const ipOf = (serial: string) =>
  serial.replace(new RegExp(`:${ANDROID_CONSTANTS.DEFAULT_PORT}$`), "");

async function attachedIps(): Promise<string[]> {
  const { stdout } = await runCli(adb(), ["devices"]);
  return parseAttachedSerials(stdout).map(ipOf);
}

async function connect(ip: string): Promise<void> {
  if ((await attachedIps()).includes(ip)) return;

  let output = "";
  try {
    const { stdout } = await runCli(
      adb(),
      ["connect", `${ip}:${ANDROID_CONSTANTS.DEFAULT_PORT}`],
      { timeout: DEPLOY_CONSTANTS.CONNECTION_TIMEOUT_MS }
    );
    output = stdout;
  } catch (error) {
    output = cliOutput(error);
  }

  if (!(await attachedIps()).includes(ip)) {
    if (/unauthorized/i.test(output)) {
      throw new Error("Accept the debugging prompt on the TV, then try again.");
    }
    if (/refused|unreachable|no route|timed? ?out/i.test(output)) {
      throw new Error(unreachableMessage());
    }
    throw new Error(output.trim() || `Could not connect to ${ip}.`);
  }
}

async function findAapt(): Promise<string | null> {
  try {
    await runCli("aapt", ["version"]);
    return "aapt";
  } catch {
    // Look in the SDK's build-tools instead.
  }

  const adbPath = store.get("adbPath");
  const sdkRoots = [
    adbPath && path.resolve(path.dirname(adbPath), ".."),
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
  ].filter(Boolean) as string[];
  const binary = process.platform === "win32" ? "aapt.exe" : "aapt";

  for (const root of sdkRoots) {
    const buildTools = path.join(root, "build-tools");
    const versions = await fs.readdir(buildTools).catch(() => [] as string[]);
    for (const version of versions.sort().reverse()) {
      const candidate = path.join(buildTools, version, binary);
      if (
        await fs.access(candidate).then(
          () => true,
          () => false
        )
      ) {
        return candidate;
      }
    }
  }
  return null;
}

async function launch(serial: string, apkPath: string, log: LogFn) {
  const aapt = await findAapt();
  if (!aapt) {
    log(
      "aapt not found, so the app can't be launched automatically. Open it on the TV."
    );
    return null;
  }

  const { stdout } = await runCli(aapt, ["dump", "badging", apkPath]);
  const packageName = stdout.match(/package:\s+name='([^']+)'/)?.[1];
  const activity = stdout.match(/launchable-activity:\s+name='([^']+)'/)?.[1];
  if (!packageName) {
    log("Could not read the package name. Open the app on the TV.");
    return null;
  }

  const shellArgs = activity
    ? ["am", "start", "-n", `${packageName}/${activity}`]
    : [
        "monkey",
        "-p",
        packageName,
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
      ];
  await runCli(adb(), ["-s", serial, "shell", ...shellArgs]);
  log(`Launched ${packageName}`);
  return packageName;
}

export const androidAdapter: PlatformAdapter = {
  async listDevices() {
    return mergeWithKnownDevices("android", await attachedIps());
  },

  async addDevice(device) {
    await connect(device.ip);
    knownDevices.remember("android", device.ip, { name: device.name });
    return `Connected to ${device.name || device.ip}`;
  },

  async updateDevice(previous, next) {
    if (previous.ip !== next.ip) {
      await connect(next.ip);
      await runCli(adb(), ["disconnect", previous.ip]).catch(() => undefined);
      knownDevices.forget("android", previous.ip);
    }
    knownDevices.remember("android", next.ip, { name: next.name });
  },

  async removeDevice(device) {
    await runCli(adb(), ["disconnect", device.ip]).catch(() => undefined);
    knownDevices.forget("android", device.ip);
  },

  async testConnection(device) {
    await connect(device.ip);
    knownDevices.remember("android", device.ip, { name: device.name });
    return { message: `Connected to ${device.name || device.ip}` };
  },

  async build(apkPath) {
    // Android apps are built with Gradle/Android Studio; here we only validate the APK.
    const stat = await fs.stat(apkPath);
    if (
      !stat.isFile() ||
      !apkPath.endsWith(ANDROID_CONSTANTS.PACKAGE_EXTENSION)
    ) {
      throw new Error("Select an .apk file.");
    }
    return apkPath;
  },

  async deploy(device, target, mode, log) {
    const apkPath = target.packagePath || target.projectPath;
    log(`Connecting to ${device.name || device.ip}…`);
    await connect(device.ip);

    log(`Installing ${path.basename(apkPath)}…`);
    try {
      const { stdout } = await runCli(adb(), [
        "-s",
        device.ip,
        "install",
        "-r",
        "-t",
        apkPath,
      ]);
      if (!stdout.includes("Success")) throw new Error(stdout);
    } catch (error) {
      throw new Error(`Installation failed: ${describeCliError(error)}`);
    }
    log("Installation complete");

    const packageName = await launch(device.ip, apkPath, log).catch((error) => {
      log(
        `Could not launch the app (${describeCliError(error)}). Open it on the TV.`
      );
      return null;
    });

    if (mode === "debug") {
      log(
        `Attach the Android Studio debugger to ${packageName ?? "your app's process"}.`
      );
    }
    return "Deployed";
  },

  async verifySdk() {
    return [await checkTool("adbPath", "adb", adb(), ["version"])];
  },
};
