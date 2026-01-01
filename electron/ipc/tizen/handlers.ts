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

const execAsync = promisify(exec);

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
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const devices: Array<{ ip: string; status: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes("List of devices") || !line) continue;

        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const deviceInfo = parts[0];
          const status = parts[1];
          const ip = deviceInfo.split(":")[0];

          if (status === "device") {
            devices.push({ ip, status });
          }
        }
      }

      return { success: true, devices };
    } catch (error) {
      logger.error("Error listing Tizen devices", error);
      return {
        success: false,
        message: `Failed to list devices: ${getErrorMessage(
          error
        )}. Ensure Tizen Studio is installed and 'sdb' is in your PATH.`,
        devices: [],
      };
    }
  });

  // Connect to a Tizen device
  ipcMain.handle("add-tizen-device", async (_event, ip: string) => {
    try {
      const sdbCmd = getSdkCommand("sdb");
      const { stdout, stderr } = await execAsync(
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
      const { stdout } = await execAsync(`"${sdbCmd}" disconnect ${ip}`);
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
      const { stdout } = await execAsync(
        `"${tizenCmd}" security-profiles list`
      );

      // Parse the output to find profile names
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const profiles: Array<{ name: string; active: boolean }> = [];

      let startParsing = false;
      for (const line of lines) {
        if (line.includes("Name") && line.includes("Active")) {
          startParsing = true;
          continue;
        }

        if (startParsing) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 1) {
            const name = parts[0];
            if (name === "------") continue;
            const active = parts.length >= 2 && parts[1].toUpperCase() === "X";
            profiles.push({ name, active });
          }
        }
      }

      // Fallback if the table format is unexpected
      if (profiles.length === 0) {
        for (const line of lines) {
          if (
            line.includes("------") ||
            line.includes("Name") ||
            line.includes("Active") ||
            line.includes("security-profiles list")
          )
            continue;
          const name = line.trim().split(/\s+/)[0];
          if (name) profiles.push({ name, active: false });
        }
      }

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

  try {
    const tempDir = path.join(os.tmpdir(), `tizen-build-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const files = await fs.readdir(projectPath);
      const excludePatterns = BUILD_CONSTANTS.EXCLUDE_PATTERNS;

      for (const file of files) {
        if (excludePatterns.some((p) => file.startsWith(p) || file.endsWith(p)))
          continue;

        const srcPath = path.join(projectPath, file);
        const destPath = path.join(tempDir, file);
        const stat = await fs.stat(srcPath);

        if (stat.isDirectory()) {
          await execAsync(`cp -r "${srcPath}" "${destPath}"`);
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
      const wgtFile = tempFiles.find((f) => f.endsWith(".wgt"));

      if (!wgtFile) throw new Error("WGT file not found after build");

      await fs.copyFile(
        path.join(tempDir, wgtFile),
        path.join(projectPath, wgtFile)
      );
      await execAsync(`rm -rf "${tempDir}"`);

      return {
        success: true,
        message: `WGT package generated successfully`,
        packagePath: path.join(projectPath, wgtFile),
        packageName: wgtFile,
      };
    } catch (error) {
      try {
        await execAsync(`rm -rf "${tempDir}"`);
      } catch (cleanupError) {
        logger.warn("Failed to cleanup temp directory", cleanupError);
      }
      throw error;
    }
  } catch (error) {
    logger.error("Error building Tizen package", error);
    return {
      success: false,
      message: `Build failed: ${getErrorMessage(
        error
      )}. Check if 'tizen' CLI is in your PATH and project has valid config.xml.`,
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
    sendLog(
      `[${new Date().toLocaleTimeString()}] Connecting to TV at ${tvIp}...`
    );
    await execAsync(`"${sdbCmd}" connect ${tvIp}`);
    sendLog(`[${new Date().toLocaleTimeString()}] Connected successfully`);

    const files = await fs.readdir(projectPath);
    let wgtFile = files.find((f) => f.endsWith(".wgt"));
    if (!wgtFile)
      throw new Error("WGT file not found. Please build the package first.");

    let wgtPath = path.join(projectPath, wgtFile);
    const wgtFileNoSpaces = wgtFile.replace(/\s+/g, "");
    if (wgtFile !== wgtFileNoSpaces) {
      const newWgtPath = path.join(projectPath, wgtFileNoSpaces);
      sendLog(
        `[${new Date().toLocaleTimeString()}] Renaming WGT file from "${wgtFile}" to "${wgtFileNoSpaces}"`
      );
      await fs.rename(wgtPath, newWgtPath);
      wgtFile = wgtFileNoSpaces;
      wgtPath = newWgtPath;
    }

    sendLog(`[${new Date().toLocaleTimeString()}] Installing ${wgtFile}...`);
    const deviceSerial = `${tvIp}:26101`;
    await execAsync(`"${tizenCmd}" install -n "${wgtPath}" -s ${deviceSerial}`);
    sendLog(`[${new Date().toLocaleTimeString()}] Installation complete`);

    const configPath = path.join(projectPath, TIZEN_CONSTANTS.CONFIG_FILE);
    const configContent = await fs.readFile(configPath, "utf-8");
    const appIdMatch = configContent.match(TIZEN_CONSTANTS.APP_ID_PATTERN);
    if (!appIdMatch)
      throw new Error(
        `Could not find tizen:application id in ${TIZEN_CONSTANTS.CONFIG_FILE}`
      );

    const appId = appIdMatch[1];
    if (/^https?:\/\//.test(appId)) {
      throw new Error(
        `Invalid Tizen app ID extracted from config.xml: ${appId}.\\nThe <tizen:application id> must be a valid Tizen app ID, not a URL.`
      );
    }

    // Add device as Tizen target if not already added
    try {
      const targetName = tvIp.replace(/\./g, "-");
      await execAsync(
        `"${tizenCmd}" add remote-device -n ${targetName} -t TV -i ${tvIp}`
      );
      sendLog(
        `[${new Date().toLocaleTimeString()}] Registered TV as target: ${targetName}`
      );
    } catch (error) {
      // Target may already exist, which is fine - this step is optional
      // Silently continue without logging errors
    }

    if (mode === "debug") {
      sendLog(
        `[${new Date().toLocaleTimeString()}] Starting app in debug mode...`
      );

      // Tizen debugging uses sdb shell debug command which outputs a dynamic port
      const { spawn } = await import("child_process");

      return await new Promise((resolve) => {
        const debugProcess = spawn(
          sdbCmd,
          ["-s", deviceSerial, "shell", "0", "debug", appId],
          { shell: true }
        );

        let urlFound = false;
        let outputBuffer = "";

        const checkForDebugPort = (text: string) => {
          if (urlFound) return;

          outputBuffer += text;

          // Tizen outputs debug port in format like:
          // "... port: 7011" or "debug port is 7011" or just the port number
          const portMatch = outputBuffer.match(
            /(?:port[:\s]+|:)(\d{4,5})|^(\d{4,5})$/m
          );

          if (portMatch) {
            const debugPort = portMatch[1] || portMatch[2];
            urlFound = true;

            sendLog(
              `[${new Date().toLocaleTimeString()}] Debug port detected: ${debugPort}`
            );

            // Forward the port
            execAsync(
              `"${sdbCmd}" -s ${deviceSerial} forward tcp:${debugPort} tcp:${debugPort}`
            )
              .then(() => {
                const inspectorUrl = `chrome://inspect/#devices`;
                const localUrl = `localhost:${debugPort}`;

                sendLog(
                  `[${new Date().toLocaleTimeString()}] ✓ Port forwarded successfully`
                );
                sendLog(
                  `[${new Date().toLocaleTimeString()}] ✓ Inspector URL:`
                );
                sendLog(`  1. Open Chrome and navigate to: ${inspectorUrl}`);
                sendLog(`  2. Click "Configure..." and add: ${localUrl}`);
                sendLog(
                  `  3. Your app should appear - click "inspect" to debug`
                );
                sendLog(
                  `[${new Date().toLocaleTimeString()}] 🔍 Chrome DevTools connection ready!`
                );

                if (timeoutHandle) {
                  clearTimeout(timeoutHandle);
                }

                resolve({
                  success: true,
                  message: "Deployment completed successfully",
                });
              })
              .catch((err) => {
                sendLog(
                  `[${new Date().toLocaleTimeString()}] Warning: Port forwarding failed: ${
                    err.message
                  }`
                );
                sendLog(
                  `[${new Date().toLocaleTimeString()}] You may need to manually run: sdb forward tcp:${debugPort} tcp:${debugPort}`
                );

                if (timeoutHandle) {
                  clearTimeout(timeoutHandle);
                }

                resolve({
                  success: true,
                  message:
                    "Deployment completed (manual port forwarding needed)",
                });
              });
          }
        };

        debugProcess.stdout.on("data", (data) => {
          const text = data.toString();
          logger.debug(`sdb debug stdout: ${text}`);

          // Send raw output to logs
          if (text.trim()) {
            sendLog(`[${new Date().toLocaleTimeString()}] ${text.trim()}`);
          }

          checkForDebugPort(text);
        });

        debugProcess.stderr.on("data", (data) => {
          const text = data.toString();
          logger.debug(`sdb debug stderr: ${text}`);

          if (text.trim()) {
            sendLog(`[${new Date().toLocaleTimeString()}] ${text.trim()}`);
          }

          checkForDebugPort(text);
        });

        debugProcess.on("error", (err) => {
          logger.error("sdb debug process error", err);
          sendLog(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);

          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }

          resolve({
            success: false,
            message: "Failed to start debug session: " + err.message,
          });
        });

        // Timeout after 15 seconds if no port is found
        const timeoutHandle = setTimeout(() => {
          if (!urlFound) {
            logger.warn(
              "Debug port timeout: Port not detected within 15 seconds"
            );
            logger.debug("Output buffer:", outputBuffer);
            sendLog(
              `[${new Date().toLocaleTimeString()}] ⚠️ Application launched in debug mode`
            );
            sendLog(
              `[${new Date().toLocaleTimeString()}] Debug port not detected automatically.`
            );
            sendLog(
              `[${new Date().toLocaleTimeString()}] Check the logs above for port information.`
            );

            resolve({
              success: true,
              message: "Deployment completed (debug port not detected)",
            });
          }
        }, DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS);
      });
    } else {
      sendLog(`[${new Date().toLocaleTimeString()}] Launching application...`);
      await execAsync(`"${tizenCmd}" run -p ${appId} -s ${deviceSerial}`);
      sendLog(
        `[${new Date().toLocaleTimeString()}] Application launched successfully`
      );
    }

    return { success: true, message: "Deployment completed successfully" };
  } catch (error) {
    logger.error("Error deploying Tizen app", error);
    const message = getErrorMessage(error) || "Deployment failed";

    // Capture detailed CLI output if available
    const execError = error as { stdout?: string; stderr?: string };
    if (execError.stdout) {
      sendLog(
        `[${new Date().toLocaleTimeString()}] CLI Output: ${execError.stdout.trim()}`
      );
    }
    if (execError.stderr) {
      sendLog(
        `[${new Date().toLocaleTimeString()}] CLI Error Details: ${execError.stderr.trim()}`
      );
    }

    sendLog(`[${new Date().toLocaleTimeString()}] Error: ${message}`);

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
