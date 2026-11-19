import fs from "node:fs/promises";
import path from "node:path";
import { store } from "../store";
import { runCli, cliOutput, describeCliError } from "../utils/cli";
import { ANDROID_CONSTANTS, DEPLOY_CONSTANTS } from "../utils/constants";
import {
  knownDevices,
  mergeWithKnownDevices,
  checkTool,
  addDebugForward,
  unreachableMessage,
  assertReachable,
} from "./common";
import { attachInspector } from "./inspector";
import {
  findWebViewSocket,
  parseAttachedSerials,
  parseBadging,
  parsePid,
} from "./parsers";
import type { DeployOutcome, LogFn, PlatformAdapter } from "./types";

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
  await assertReachable(
    ip,
    ANDROID_CONSTANTS.DEFAULT_PORT,
    "Turn on network (ADB) debugging on the TV"
  );

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
  const { packageName, activity } = parseBadging(stdout);
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

const WEBVIEW_ATTEMPTS = 10;
const WEBVIEW_RETRY_DELAY_MS = 1000;

/** Forwards the app's WebView DevTools socket to a free local port, once the WebView exists. */
async function forwardWebView(
  serial: string,
  packageName: string
): Promise<number | undefined> {
  const shell = (...args: string[]) =>
    runCli(adb(), ["-s", serial, "shell", ...args]).then(
      ({ stdout }) => stdout,
      () => ""
    );

  for (let attempt = 1; attempt <= WEBVIEW_ATTEMPTS; attempt++) {
    const pid = parsePid(await shell("pidof", packageName));
    const socket =
      pid &&
      findWebViewSocket(await shell("cat", "/proc/net/unix"), pid, packageName);
    if (socket) {
      const { stdout } = await runCli(adb(), [
        "-s",
        serial,
        "forward",
        "tcp:0",
        `localabstract:${socket}`,
      ]);
      const port = Number(stdout.trim()) || undefined;
      if (port) addDebugForward(adb(), serial, port);
      return port;
    }
    await new Promise((resolve) => setTimeout(resolve, WEBVIEW_RETRY_DELAY_MS));
  }
  return undefined;
}

async function startDebugSession(
  serial: string,
  packageName: string | null,
  log: LogFn
): Promise<DeployOutcome> {
  const androidStudioHint = `Attach the Android Studio debugger to ${packageName ?? "your app's process"}.`;
  if (!packageName) {
    log(androidStudioHint);
    return { message: "Deployed" };
  }

  log("Looking for a debuggable WebView…");
  const port = await forwardWebView(serial, packageName).catch((error) => {
    log(`WebView port forwarding failed: ${describeCliError(error)}`);
    return undefined;
  });
  if (!port) {
    log(
      "No debuggable WebView found. Web apps need WebView.setWebContentsDebuggingEnabled(true)."
    );
    log(androidStudioHint);
    return { message: "Deployed" };
  }
  return attachInspector(port, undefined, log);
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
      return startDebugSession(device.ip, packageName, log);
    }
    return { message: "Deployed" };
  },

  async verifySdk() {
    return [await checkTool("adbPath", "adb", adb(), ["version"])];
  },
};
