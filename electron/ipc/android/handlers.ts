import { ipcMain } from "electron";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { store } from "../../store";
import { logger } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";
import { ANDROID_CONSTANTS } from "../../utils/constants";

const execAsync = promisify(exec);

// Helper for timestamped logging
function getTimeLog(message: string): string {
  return `[${new Date().toLocaleTimeString()}] ${message}`;
}

// Helper to get adb command
function getAdbCommand(): string {
  const paths = store.getAll();
  return paths.adbPath || "adb";
}

export function registerAndroidHandlers() {
  // List connected Android devices
  ipcMain.handle("list-android-devices", async () => {
    try {
      const adbCmd = getAdbCommand();
      const { stdout } = await execAsync(`"${adbCmd}" devices`);

      const devices = stdout
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.startsWith("List of devices"))
        .map((line) => {
          const [ip, status] = line.trim().split(/\s+/);
          return { ip, status };
        })
        .filter((device) => device.ip && device.status === "device");

      return { success: true, devices };
    } catch (error) {
      logger.error("Error listing Android devices", error);
      return {
        success: false,
        message: `Failed to list devices: ${getErrorMessage(error)}. Ensure ADB is installed and path is correct.`,
        devices: [],
      };
    }
  });

  // Connect to an Android device
  ipcMain.handle("add-android-device", async (_event, ip: string) => {
    try {
      const adbCmd = getAdbCommand();
      // Try to disconnect first to ensure clean state
      try {
        await execAsync(`"${adbCmd}" disconnect ${ip}`);
      } catch (e) {
        // Ignore disconnect errors
      }

      const { stdout } = await execAsync(
        `"${adbCmd}" connect ${ip}:${ANDROID_CONSTANTS.DEFAULT_PORT}`
      );

      if (stdout.includes("connected to")) {
        return {
          success: true,
          message: `Successfully connected to Android TV at ${ip}`,
        };
      } else {
        throw new Error(stdout.trim());
      }
    } catch (error) {
      logger.error(`Error connecting to Android device ${ip}`, error);
      return {
        success: false,
        message: getErrorMessage(error) || "Failed to connect to device",
      };
    }
  });

  // Disconnect from an Android device
  ipcMain.handle("remove-android-device", async (_event, ip: string) => {
    try {
      const adbCmd = getAdbCommand();
      await execAsync(`"${adbCmd}" disconnect ${ip}`);
      return {
        success: true,
        message: `Disconnected from ${ip}`,
      };
    } catch (error) {
      return {
        success: false,
        message: getErrorMessage(error) || "Failed to disconnect from device",
      };
    }
  });
}

// Exported platform-specific functions for use by main handler

export async function testAndroidConnection(tvIp: string) {
  try {
    const adbCmd = getAdbCommand();
    try {
      await execAsync(`"${adbCmd}" connect ${tvIp}`);
    } catch (e) {
      // might already be connected
    }

    // Check if listed in devices
    const { stdout } = await execAsync(`"${adbCmd}" devices`);
    if (stdout.includes(tvIp)) {
      return {
        success: true,
        message: `Successfully connected to Android TV at ${tvIp}`,
      };
    }

    throw new Error("Device not found in list after connect attempt");
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error) || "Connection failed",
    };
  }
}

// Helper to find aapt command
async function getAaptCommand(): Promise<string | null> {
  // 1. Try generic 'aapt' in path
  try {
    await execAsync("aapt version");
    return "aapt";
  } catch (e) {
    // 2. Try to find relative to ADB path
    const adbPath = getAdbCommand();
    if (adbPath && adbPath !== "adb") {
      // Expect adb at .../platform-tools/adb
      // aapt is usually at .../build-tools/<version>/aapt
      const sdkRoot = path.resolve(path.dirname(adbPath), "..");
      const buildToolsDir = path.join(sdkRoot, "build-tools");

      try {
        const dirs = await fs.readdir(buildToolsDir);
        // Sort to get latest version
        const sortedDirs = dirs.sort().reverse();

        for (const dir of sortedDirs) {
          const aaptPath = path.join(buildToolsDir, dir, "aapt");
          try {
            await fs.access(aaptPath);
            return `"${aaptPath}"`;
          } catch {
            continue;
          }
        }
      } catch (e) {
        // build-tools dir not found or access error
      }
    }

    // 3. Try ANDROID_HOME environment variable
    const androidHome =
      process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (androidHome) {
      const buildToolsDir = path.join(androidHome, "build-tools");
      try {
        const dirs = await fs.readdir(buildToolsDir);
        const sortedDirs = dirs.sort().reverse();
        for (const dir of sortedDirs) {
          const aaptPath = path.join(buildToolsDir, dir, "aapt");
          try {
            await fs.access(aaptPath);
            return `"${aaptPath}"`;
          } catch {
            continue;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

// Helper to extract package name and activity from APK using aapt
async function extractPackageInfo(
  apkPath: string,
  sendLog?: (msg: string) => void
): Promise<{ packageName: string | null; activityName: string | null }> {
  const result = {
    packageName: null as string | null,
    activityName: null as string | null,
  };
  const aaptCmd = await getAaptCommand();

  if (!aaptCmd) {
    if (sendLog)
      sendLog(
        getTimeLog(
          "Warning: 'aapt' tool not found. Cannot extract package info for auto-launch."
        )
      );
    return result;
  }

  try {
    const { stdout } = await execAsync(`${aaptCmd} dump badging "${apkPath}"`);

    // Extract package name
    // Output format: package: name='com.example.app' ...
    const pkgMatch = stdout.match(/package:\s+name='([^']+)'/);
    if (pkgMatch && pkgMatch[1]) {
      result.packageName = pkgMatch[1];
    }

    // Extract launchable activity
    // Output format: launchable-activity: name='com.example.app.MainActivity' ...
    const actMatch = stdout.match(/launchable-activity:\s+name='([^']+)'/);
    if (actMatch && actMatch[1]) {
      result.activityName = actMatch[1];
    }
  } catch (error) {
    logger.error("Error extracting package info", error);
    if (sendLog)
      sendLog(
        getTimeLog(
          `Warning: Failed to extract package info: ${getErrorMessage(error)}`
        )
      );
  }

  return result;
}

export async function deployAndroidApp(
  tvIp: string,
  apkPath: string, // This will be passed as projectPath in the main handler
  mode: "debug" | "run",
  sendLog: (message: string) => void
) {
  try {
    const adbCmd = getAdbCommand();

    sendLog(getTimeLog(`Connecting to TV at ${tvIp}...`));
    await execAsync(`"${adbCmd}" connect ${tvIp}`);

    // Ensure file exists
    try {
      await fs.access(apkPath);
    } catch {
      // If apkPath is actually a directory (the project path), looking for APKs
      const stats = await fs.stat(apkPath);
      if (stats.isDirectory()) {
        const files = await fs.readdir(apkPath);
        const apkFile = files.find((f) => f.endsWith(".apk"));
        if (!apkFile)
          throw new Error("No APK file found in the selected directory.");
        apkPath = path.join(apkPath, apkFile);
      }
    }

    sendLog(getTimeLog(`Installing ${path.basename(apkPath)}...`));

    // -r: replace existing
    // -t: allow test packages
    const { stdout, stderr } = await execAsync(
      `"${adbCmd}" -s ${tvIp} install -r -t "${apkPath}"`
    );

    if (stdout.includes("Success")) {
      sendLog(getTimeLog(`Installation complete`));
    } else {
      throw new Error(`Installation failed: ${stdout} ${stderr}`);
    }

    // Attempt auto-launch
    sendLog(getTimeLog("Attempting to launch app..."));
    const { packageName, activityName } = await extractPackageInfo(
      apkPath,
      sendLog
    );

    if (packageName) {
      try {
        if (activityName) {
          // Use proper am start command
          await execAsync(
            `"${adbCmd}" -s ${tvIp} shell am start -n ${packageName}/${activityName}`
          );
          sendLog(getTimeLog(`App launched (${packageName})`));
        } else {
          // Fallback to monkey if activity not found, but log warning
          sendLog(
            getTimeLog(
              "Warning: Main activity not found in APK. Trying fallback launch..."
            )
          );
          await execAsync(
            `"${adbCmd}" -s ${tvIp} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
          );
          sendLog(getTimeLog(`App launched (${packageName})`));
        }
      } catch (error) {
        sendLog(
          getTimeLog(`Warning: Failed to launch app: ${getErrorMessage(error)}`)
        );
        sendLog(getTimeLog("Please launch the app manually on the TV."));
      }
    } else {
      sendLog(
        getTimeLog(
          "Could not determine package name. Please launch the app manually on the TV."
        )
      );
    }

    if (mode === "debug") {
      // Only log instruction for now as "debug" implies attaching a debugger which is complex via adb shell am start -D
      sendLog(
        getTimeLog(
          `For debugging, attach your Android Studio debugger to process: ${packageName || "<unknown>"}`
        )
      );
    }

    return { success: true, message: "Deployment completed successfully" };
  } catch (error) {
    logger.error("Error deploying Android app", error);
    const message = getErrorMessage(error) || "Deployment failed";
    sendLog(getTimeLog(`Error: ${message}`));
    return { success: false, message };
  }
}
