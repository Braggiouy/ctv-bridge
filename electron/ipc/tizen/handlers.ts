import { ipcMain } from "electron";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { store } from "../../store";
import { logger } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";
import {
  TIZEN_CONSTANTS,
  BUILD_CONSTANTS,
  DEPLOY_CONSTANTS,
} from "../../utils/constants";
import { processManager } from "../../utils/process-manager";

const execAsync = promisify(exec);

// Helper for timestamped logging
function getTimeLog(message: string): string {
  return `[${new Date().toLocaleTimeString()}] ${message}`;
}

// CLI parsing helpers
function parseSdbDevices(
  stdout: string
): Array<{ ip: string; status: string }> {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const devices: Array<{ ip: string; status: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("List of devices") || !trimmed) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const deviceInfo = parts[0];
      const status = parts[1];
      const ip = deviceInfo.split(":")[0];

      if (status === "device") {
        devices.push({ ip, status });
      }
    }
  }
  return devices;
}

function parseTizenProfiles(
  stdout: string
): Array<{ name: string; active: boolean }> {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const profiles: Array<{ name: string; active: boolean }> = [];

  const isNoiseLine = (line: string): boolean => {
    const normalized = line.trim();
    if (!normalized) return true;
    if (normalized.includes("------")) return true;
    if (/^security-profiles\s+list/i.test(normalized)) return true;
    if (/^loaded\b/i.test(normalized)) return true;
    if (/^available\s*:?$/i.test(normalized)) return true;
    if (/^\[profile\s+name\]\s+\[active\]/i.test(normalized)) return true;
    if (/^name\s+active/i.test(normalized)) return true;
    return false;
  };

  const parseDataLine = (
    rawLine: string
  ): { name: string; active: boolean } | null => {
    const trimmed = rawLine.trim();
    if (!trimmed) return null;

    // Standard format: "name   X"
    const spacedMatch = trimmed.match(/^(.*\S)\s+([OX])$/i);
    if (spacedMatch) {
      return {
        name: spacedMatch[1].trim(),
        active: spacedMatch[2].toUpperCase() === "O",
      };
    }

    // Some CLI versions append active marker to the end of long names: "nameO"
    const attachedMatch = trimmed.match(/^(.*\S)([OX])$/i);
    if (attachedMatch) {
      return {
        name: attachedMatch[1].trim(),
        active: attachedMatch[2].toUpperCase() === "O",
      };
    }

    return { name: trimmed, active: false };
  };

  let startParsing = false;
  let sawHeader = false;
  for (const line of lines) {
    if (line.includes("Name") && line.includes("Active")) {
      startParsing = true;
      sawHeader = true;
      continue;
    }

    if (startParsing) {
      if (isNoiseLine(line)) continue;
      const parsed = parseDataLine(line);
      if (!parsed) continue;
      if (!parsed.name || parsed.name.endsWith(":")) continue;
      profiles.push(parsed);
    }
  }

  // If header exists but there are no data rows, the profile list is empty.
  if (sawHeader && profiles.length === 0) {
    return [];
  }

  // Fallback if the table format is unexpected
  if (profiles.length === 0) {
    for (const line of lines) {
      if (isNoiseLine(line)) continue;
      const parsed = parseDataLine(line);
      if (!parsed) continue;
      if (!parsed.name || parsed.name.endsWith(":")) continue;
      profiles.push(parsed);
    }
  }
  return profiles;
}

function parseProfilesXml(
  xmlContent: string
): Array<{ name: string; active: boolean }> {
  const activeNameMatch = xmlContent.match(/<profiles[^>]*\sactive="([^"]*)"/i);
  const activeName = activeNameMatch?.[1]?.trim() || "";

  const profiles: Array<{ name: string; active: boolean }> = [];
  const profileMatches = xmlContent.matchAll(/<profile\s+name="([^"]+)"/gi);
  for (const match of profileMatches) {
    const name = match[1]?.trim();
    if (!name) continue;
    profiles.push({ name, active: name === activeName });
  }

  return profiles;
}

async function listTizenProfilesWithCanonicalNames(
  tizenCmd: string
): Promise<Array<{ name: string; active: boolean }>> {
  const { stdout } = await execAsync(`"${tizenCmd}" security-profiles list`);

  const loadedPathMatch = stdout.match(/Loaded in '([^']+)'\./i);
  if (loadedPathMatch?.[1]) {
    try {
      const xmlContent = await fs.readFile(loadedPathMatch[1], "utf-8");
      const profilesFromXml = parseProfilesXml(xmlContent);
      if (profilesFromXml.length > 0) {
        return profilesFromXml;
      }
    } catch (error) {
      logger.warn(
        "Failed to parse profiles.xml, falling back to CLI output",
        error
      );
    }
  }

  return parseTizenProfiles(stdout);
}

// Helper to get command with SDK path
function getSdkCommand(command: "sdb" | "tizen"): string {
  const paths = store.getAll();
  if (command === "sdb" && paths.sdbPath) {
    return paths.sdbPath;
  }
  if (command === "tizen" && paths.tizenPath) {
    return paths.tizenPath;
  }
  // Fallback to system PATH
  return command;
}

export function registerTizenHandlers() {
  // List connected Tizen devices
  ipcMain.handle("list-tizen-devices", async () => {
    try {
      const sdbCmd = getSdkCommand("sdb");
      const { stdout } = await execAsync(`"${sdbCmd}" devices`);
      const devices = parseSdbDevices(stdout);
      return { success: true, devices };
    } catch (error) {
      logger.error("Error listing Tizen devices", error);
      return {
        success: false,
        message: `Failed to list devices: ${getErrorMessage(
          error
        )}. Ensure Tizen Studio is installed and 'sdb' path is correct.`,
        devices: [],
      };
    }
  });

  // Connect to a Tizen device
  ipcMain.handle("add-tizen-device", async (_event, ip: string) => {
    try {
      const sdbCmd = getSdkCommand("sdb");
      const { stderr } = await execAsync(
        `"${sdbCmd}" connect ${ip}:${TIZEN_CONSTANTS.DEFAULT_PORT}`
      );

      if (stderr && stderr.toLowerCase().includes("error")) {
        throw new Error(stderr);
      }

      const { stdout: devicesOutput } = await execAsync(`"${sdbCmd}" devices`);

      if (devicesOutput.includes(ip)) {
        return {
          success: true,
          message: `Successfully connected to Tizen TV at ${ip}`,
        };
      } else {
        throw new Error(
          "Connection command executed but device not found in device list"
        );
      }
    } catch (error) {
      logger.error(`Error connecting to Tizen device ${ip}`, error);
      let message = getErrorMessage(error) || "Failed to connect to device";

      if (message.includes("Connection refused")) {
        message =
          "Connection refused. Ensure Developer Mode is enabled on the TV and it is connected to the network.";
      } else if (message.includes("No route to host")) {
        message =
          "Device unreachable. Check if TV is on and connected to the same network.";
      }

      return {
        success: false,
        message,
      };
    }
  });

  // Disconnect from a Tizen device
  ipcMain.handle("remove-tizen-device", async (_event, ip: string) => {
    try {
      const sdbCmd = getSdkCommand("sdb");
      await execAsync(`"${sdbCmd}" disconnect ${ip}`);
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

  // List available Tizen security profiles
  ipcMain.handle("list-tizen-profiles", async () => {
    try {
      const tizenCmd = getSdkCommand("tizen");
      const profiles = await listTizenProfilesWithCanonicalNames(tizenCmd);
      return { success: true, profiles };
    } catch (error) {
      logger.error("Error listing Tizen profiles", error);
      return {
        success: false,
        message: `Failed to list profiles: ${getErrorMessage(error)}`,
        profiles: [],
      };
    }
  });

  ipcMain.handle(
    "delete-tizen-profile",
    async (_event, profileName: string) => {
      try {
        if (!profileName?.trim()) {
          return { success: false, message: "Profile name is required" };
        }

        const tizenCmd = getSdkCommand("tizen");
        const normalizedName = profileName.trim();
        const profiles = await listTizenProfilesWithCanonicalNames(tizenCmd);

        // Recover from legacy parser bug that could append active marker (O/X) to profile names.
        let resolvedName = normalizedName;
        if (!profiles.some((p) => p.name === resolvedName)) {
          const withoutStatusSuffix = resolvedName.replace(/[OX]$/i, "");
          if (profiles.some((p) => p.name === withoutStatusSuffix)) {
            resolvedName = withoutStatusSuffix;
          }
        }

        const escapedName = resolvedName.replace(/"/g, '\\"');

        const targetProfile = profiles.find((p) => p.name === resolvedName);
        if (!targetProfile) {
          return {
            success: false,
            message: `Profile "${normalizedName}" was not found in Tizen security profiles.`,
          };
        }

        // Some Tizen CLI builds refuse deleting the currently active profile.
        // If possible, switch active profile first, then remove the target.
        if (targetProfile.active) {
          const replacement = profiles.find((p) => p.name !== resolvedName);
          if (replacement) {
            const escapedReplacement = replacement.name.replace(/"/g, '\\"');
            await execAsync(
              `"${tizenCmd}" security-profiles set-active -n "${escapedReplacement}"`
            );
          } else {
            return {
              success: false,
              message:
                "Cannot delete the active profile because it is the only profile. Create another profile first, set it active, then retry.",
            };
          }
        }

        await execAsync(
          `"${tizenCmd}" security-profiles remove -n "${escapedName}"`
        );

        return { success: true };
      } catch (error) {
        logger.error(`Error deleting Tizen profile ${profileName}`, error);
        return {
          success: false,
          message: `Failed to delete profile: ${getErrorMessage(error)}`,
        };
      }
    }
  );
}

// Internal Deployment Helpers

async function getAppIdFromConfig(projectPath: string): Promise<string> {
  const configPath = path.join(projectPath, TIZEN_CONSTANTS.CONFIG_FILE);
  const configContent = await fs.readFile(configPath, "utf-8");
  const appIdMatch = configContent.match(TIZEN_CONSTANTS.APP_ID_PATTERN);

  if (!appIdMatch) {
    throw new Error(
      `Could not find tizen:application id in ${TIZEN_CONSTANTS.CONFIG_FILE}`
    );
  }

  const appId = appIdMatch[1];
  if (/^https?:\/\//.test(appId)) {
    throw new Error(
      `Invalid Tizen app ID extracted from config.xml: ${appId}.\nThe <tizen:application id> must be a valid Tizen app ID, not a URL.`
    );
  }
  return appId;
}

async function renameWgtIfNeeded(
  projectPath: string,
  wgtFile: string,
  sendLog: (msg: string) => void
): Promise<string> {
  const wgtFileNoSpaces = wgtFile.replace(/\s+/g, "");
  if (wgtFile !== wgtFileNoSpaces) {
    const oldPath = path.join(projectPath, wgtFile);
    const newPath = path.join(projectPath, wgtFileNoSpaces);
    sendLog(
      getTimeLog(`Renaming WGT file from "${wgtFile}" to "${wgtFileNoSpaces}"`)
    );
    await fs.rename(oldPath, newPath);
    return wgtFileNoSpaces;
  }
  return wgtFile;
}

async function registerRemoteDevice(
  tizenCmd: string,
  tvIp: string,
  sendLog: (msg: string) => void
) {
  try {
    const targetName = tvIp.replace(/\./g, "-");
    await execAsync(
      `"${tizenCmd}" add remote-device -n ${targetName} -t TV -i ${tvIp}`
    );
    sendLog(getTimeLog(`Registered TV as target: ${targetName}`));
  } catch {
    // Target may already exist, which is fine
  }
}

// Exported platform-specific functions for use by main handler

export async function testTizenConnection(tvIp: string) {
  try {
    const sdbCmd = getSdkCommand("sdb");
    await execAsync(`"${sdbCmd}" disconnect`);
    const { stderr } = await execAsync(`"${sdbCmd}" connect ${tvIp}`);
    if (stderr && stderr.includes("error")) throw new Error(stderr);

    try {
      await execAsync(`"${sdbCmd}" -s ${tvIp}:26101 shell ls /`);
    } catch {
      throw new Error(
        "Device did not respond to shell command. TV may be off or unreachable."
      );
    }

    return {
      success: true,
      message: `Successfully connected to Tizen TV at ${tvIp}`,
    };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error) || "Connection failed",
    };
  }
}

export async function buildTizenPackage(
  projectPath: string,
  profileName?: string
) {
  const os = await import("os");
  const tempDir = path.join(
    os.tmpdir(),
    `${BUILD_CONSTANTS.TEMP_DIR_PREFIX}${Date.now()}`
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });

    const files = await fs.readdir(projectPath);
    const excludePatterns = BUILD_CONSTANTS.EXCLUDE_PATTERNS;

    for (const file of files) {
      if (excludePatterns.some((p) => file.startsWith(p) || file.endsWith(p)))
        continue;

      const srcPath = path.join(projectPath, file);
      const destPath = path.join(tempDir, file);
      const stat = await fs.stat(srcPath);

      if (stat.isDirectory()) {
        // Simple recursive copy using fs
        await fs.mkdir(destPath, { recursive: true });
        const copyDir = async (src: string, dest: string) => {
          const entries = await fs.readdir(src, { withFileTypes: true });
          for (const entry of entries) {
            const sPath = path.join(src, entry.name);
            const dPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              await fs.mkdir(dPath, { recursive: true });
              await copyDir(sPath, dPath);
            } else {
              await fs.copyFile(sPath, dPath);
            }
          }
        };
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }

    const tizenCmd = getSdkCommand("tizen");
    let packageCmd = `"${tizenCmd}" package -t wgt`;
    if (profileName) {
      packageCmd += ` -p "${profileName}"`;
    }

    await execAsync(packageCmd, { cwd: tempDir });
    const tempFiles = await fs.readdir(tempDir);
    const wgtFile = tempFiles.find((f) =>
      f.endsWith(TIZEN_CONSTANTS.PACKAGE_EXTENSION)
    );

    if (!wgtFile) throw new Error("WGT file not found after build");

    await fs.copyFile(
      path.join(tempDir, wgtFile),
      path.join(projectPath, wgtFile)
    );

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      success: true,
      message: `WGT package generated successfully`,
      packagePath: path.join(projectPath, wgtFile),
      packageName: wgtFile,
    };
  } catch (error) {
    logger.error("Error building Tizen package", error);

    // Attempt cleanup on failure
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      logger.warn("Failed to cleanup temp directory", cleanupError);
    }

    return {
      success: false,
      message: `Build failed: ${getErrorMessage(
        error
      )}. Check if 'tizen' CLI path is correct and project has valid config.xml.`,
    };
  }
}

export async function deployTizenApp(
  tvIp: string,
  projectPath: string,
  mode: "debug" | "run",
  sendLog: (message: string) => void
) {
  try {
    const sdbCmd = getSdkCommand("sdb");
    const tizenCmd = getSdkCommand("tizen");
    const deviceSerial = `${tvIp}${TIZEN_CONSTANTS.DEVICE_SERIAL_SUFFIX}`;

    sendLog(getTimeLog(`Connecting to TV at ${tvIp}...`));
    await execAsync(`"${sdbCmd}" connect ${tvIp}`);
    sendLog(getTimeLog(`Connected successfully`));

    // Find and prepare WGT file
    const files = await fs.readdir(projectPath);
    let wgtFile = files.find((f) =>
      f.endsWith(TIZEN_CONSTANTS.PACKAGE_EXTENSION)
    );
    if (!wgtFile) {
      throw new Error("WGT file not found. Please build the package first.");
    }

    wgtFile = await renameWgtIfNeeded(projectPath, wgtFile, sendLog);
    const wgtPath = path.join(projectPath, wgtFile);
    const appId = await getAppIdFromConfig(projectPath);

    sendLog(getTimeLog(`Installing ${wgtFile}...`));
    const installCommand = `"${tizenCmd}" install -n "${wgtPath}" -s ${deviceSerial}`;

    try {
      await execAsync(installCommand);
    } catch (installError) {
      const installMessage = getErrorMessage(installError);
      const installStdout = (installError as { stdout?: string }).stdout ?? "";
      const isAuthorMismatch =
        /author certificate not match/i.test(installMessage) ||
        /author certificate not match/i.test(installStdout) ||
        /install failed\[118,\s*-11\]/i.test(installStdout);

      if (!isAuthorMismatch) {
        throw installError;
      }

      sendLog(
        getTimeLog(
          "Existing app was signed with a different author certificate. Uninstalling old app and retrying installation..."
        )
      );

      try {
        await execAsync(
          `"${tizenCmd}" uninstall -p ${appId} -s ${deviceSerial}`
        );
      } catch (uninstallError) {
        logger.warn(
          "Failed to uninstall existing app before reinstall",
          uninstallError
        );
      }

      await execAsync(installCommand);
    }
    sendLog(getTimeLog(`Installation complete`));

    // Optional: Register as target for easier CLI usage
    await registerRemoteDevice(tizenCmd, tvIp, sendLog);

    if (mode === "debug") {
      sendLog(getTimeLog(`Starting app in debug mode...`));
      return await startTizenDebugSession(sdbCmd, deviceSerial, appId, sendLog);
    } else {
      sendLog(getTimeLog(`Launching application...`));
      await execAsync(`"${tizenCmd}" run -p ${appId} -s ${deviceSerial}`);
      sendLog(getTimeLog(`Application launched successfully`));
    }

    return { success: true, message: "Deployment completed successfully" };
  } catch (error) {
    logger.error("Error deploying Tizen app", error);
    const message = getErrorMessage(error) || "Deployment failed";

    const execError = error as { stdout?: string; stderr?: string };
    if (execError.stdout)
      sendLog(getTimeLog(`CLI Output: ${execError.stdout.trim()}`));
    if (execError.stderr)
      sendLog(getTimeLog(`CLI Error Details: ${execError.stderr.trim()}`));

    sendLog(getTimeLog(`Error: ${message}`));

    let userMessage = message;
    if (message.includes("install failed")) {
      userMessage = `Installation failed: ${message}. Check global logs for details (Tizen error codes). Common issues include storage, Developer Mode, or invalid certificates.`;
    } else if (message.includes("closed")) {
      userMessage =
        "Connection lost during deployment. Please check network connection.";
    }

    return { success: false, message: userMessage };
  }
}

async function startTizenDebugSession(
  sdbCmd: string,
  deviceSerial: string,
  appId: string,
  sendLog: (msg: string) => void
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const debugProcess = spawn(
      sdbCmd,
      ["-s", deviceSerial, "shell", "0", "debug", appId],
      {
        shell: true,
      }
    );
    processManager.track(debugProcess);

    let completed = false;
    let portDetected = false;
    let outputBuffer = "";

    const settle = (result: { success: boolean; message: string }) => {
      if (completed) return;
      completed = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(result);
    };

    const sendChromeInspectorSteps = (debugPort: string) => {
      sendLog(getTimeLog(`Debug port detected: ${debugPort}`));
      sendLog(getTimeLog(`Inspector URL:`));
      sendLog(`  1. Open Chrome and navigate to: chrome://inspect/#devices`);
      sendLog(`  2. Click "Configure..." and add: localhost:${debugPort}`);
      sendLog(`  3. Your app should appear - click "inspect" to debug`);
      sendLog(getTimeLog(`Chrome DevTools connection ready`));
    };

    const checkForDebugPort = (text: string) => {
      if (completed || portDetected) return;
      outputBuffer += text;

      // Capture common sdb debug outputs such as:
      // "port: 7011", "debug 7011", "ws://127.0.0.1:7011/devtools/..."
      const portMatch = outputBuffer.match(
        /(?:\b(?:port|debug)\b\s*[:=]?\s*|localhost:|127\.0\.0\.1:)(\d{4,5})\b/i
      );

      if (portMatch) {
        const debugPort = portMatch[1];
        portDetected = true;

        execAsync(
          `"${sdbCmd}" -s ${deviceSerial} forward tcp:${debugPort} tcp:${debugPort}`
        )
          .then(() => {
            sendLog(getTimeLog(`Port forwarded successfully`));
            sendChromeInspectorSteps(debugPort);
            settle({
              success: true,
              message: "Deployment completed successfully",
            });
          })
          .catch((err) => {
            sendLog(
              getTimeLog(`Warning: Port forwarding failed: ${err.message}`)
            );
            sendChromeInspectorSteps(debugPort);
            sendLog(
              getTimeLog(
                `You may need to manually run: sdb forward tcp:${debugPort} tcp:${debugPort}`
              )
            );
            settle({
              success: true,
              message: "Deployment completed (manual port forwarding needed)",
            });
          });
      }
    };

    debugProcess.stdout.on("data", (data) => {
      const text = data.toString();
      if (text.trim()) sendLog(getTimeLog(text.trim()));
      checkForDebugPort(text);
    });

    debugProcess.stderr.on("data", (data) => {
      const text = data.toString();
      if (text.trim()) sendLog(getTimeLog(text.trim()));
      checkForDebugPort(text);
    });

    debugProcess.on("error", (err) => {
      if (completed) return;
      logger.error("sdb debug process error", err);
      sendLog(getTimeLog(`Error: ${err.message}`));
      settle({
        success: false,
        message: "Failed to start debug session: " + err.message,
      });
    });

    const timeoutHandle = setTimeout(() => {
      if (!portDetected) {
        logger.warn(
          `Debug port timeout: Port not detected within ${DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS / 1000} seconds`
        );
        sendLog(getTimeLog(`Application launched in debug mode`));
        sendLog(
          getTimeLog(
            `Debug port not detected automatically. Check the logs above for port information.`
          )
        );
        sendLog(
          getTimeLog(
            `If a port appears, run: sdb -s ${deviceSerial} forward tcp:<PORT> tcp:<PORT>`
          )
        );
        sendLog(
          getTimeLog(
            `Then open Chrome: chrome://inspect/#devices and add localhost:<PORT>`
          )
        );
        settle({
          success: true,
          message: "Deployment completed (debug port not detected)",
        });
      }
    }, DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS);
  });
}
