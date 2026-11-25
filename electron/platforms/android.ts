import fs from "node:fs/promises";
import path from "node:path";
import { store } from "../store";
import { runCli, describeCliError } from "../utils/cli";
import { ANDROID_CONSTANTS } from "../utils/constants";
import { checkTool, addDebugForward, unreachableMessage } from "./common";
import { createBridge } from "./bridge";
import { attachInspector } from "./inspector";
import { findWebViewSocket, parseBadging, parsePid } from "./parsers";
import type { DeployOutcome, LogFn, PlatformAdapter } from "./types";

const adb = () => store.get("adbPath") || "adb";

const { connect, devices } = createBridge({
  platform: "android",
  cli: adb,
  port: ANDROID_CONSTANTS.DEFAULT_PORT,
  portFix: "Turn on network (ADB) debugging on the TV",
  connectError: (output) => {
    if (/unauthorized/i.test(output))
      return "Accept the debugging prompt on the TV, then try again.";
    if (/refused/i.test(output)) return unreachableMessage();
  },
});

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

/** The APK's package name and launch activity; null when aapt isn't installed. */
async function readBadging(apkPath: string) {
  const aapt = await findAapt();
  if (!aapt) return null;
  const { stdout } = await runCli(aapt, ["dump", "badging", apkPath]);
  return parseBadging(stdout);
}

async function launch(serial: string, apkPath: string, log: LogFn) {
  const badging = await readBadging(apkPath);
  if (!badging) {
    log(
      "aapt not found, so the app can't be launched automatically. Open it on the TV."
    );
    return null;
  }

  const { packageName, activity } = badging;
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
  ...devices,

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

  async appAction(device, target, action) {
    const apkPath = target.packagePath || target.projectPath;
    await connect(device.ip);
    const badging = await readBadging(apkPath);
    if (!badging) {
      throw new Error(
        "aapt not found, so the APK's package name can't be read. Install the Android SDK build-tools."
      );
    }
    const { packageName } = badging;
    if (!packageName) throw new Error("Could not read the APK's package name.");

    if (action === "uninstall") {
      await runCli(adb(), ["-s", device.ip, "uninstall", packageName]);
      return `Uninstalled ${packageName}`;
    }
    await runCli(adb(), [
      "-s",
      device.ip,
      "shell",
      "am",
      "force-stop",
      packageName,
    ]);
    if (action === "stop") return `Stopped ${packageName}`;
    await launch(device.ip, apkPath, () => undefined);
    return `Restarted ${packageName}`;
  },

  async verifySdk() {
    return [await checkTool("adbPath", "adb", adb(), ["version"])];
  },
};
