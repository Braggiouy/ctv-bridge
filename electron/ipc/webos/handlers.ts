import { ipcMain } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import { store } from "../../store";
import { logger } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";
import { WEBOS_CONSTANTS, DEPLOY_CONSTANTS } from "../../utils/constants";
import { processManager } from "../../utils/process-manager";

const execAsync = promisify(exec);
const INSPECT_RETRY_TIMEOUT_MS = 15000;

// Helper to get ares command with SDK path
function getAresCommand(suffix: string): string {
  const paths = store.getAll();
  return paths.aresPath ? `"${paths.aresPath}${suffix}"` : `ares${suffix}`;
}

// CLI parsing helpers
function parseWebOsDevices(
  stdout: string
): Array<{ name: string; ip: string; port: string; username: string }> {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const devices: Array<{
    name: string;
    ip: string;
    port: string;
    username: string;
  }> = [];

  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("deviceinfo") && lines[i].includes("connection")) {
      startIdx = i + 2;
      break;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s{2,}/);
    if (parts.length < 2) continue;

    const name = parts[0].replace(/ \(default\)/, "").trim();
    const deviceinfo = parts[1];
    const match = deviceinfo.match(/([^@]+)@([\d.]+):(\d+)/);

    if (match) {
      devices.push({ name, ip: match[2], port: match[3], username: match[1] });
    }
  }
  return devices;
}

export function registerWebOsHandlers() {
  // List registered webOS devices
  ipcMain.handle("list-devices", async () => {
    try {
      const { stdout } = await execAsync(
        `${getAresCommand("-setup-device")} --list`
      );
      return { success: true, devices: parseWebOsDevices(stdout) };
    } catch (error) {
      return { success: false, message: getErrorMessage(error) };
    }
  });

  // Add/register a new webOS device
  ipcMain.handle("add-device", async (_event, device) => {
    try {
      if (!device.name || !device.ip || !device.port) {
        return {
          success: false,
          message: "Missing required device connection info.",
        };
      }

      // Always remove any existing device with the same name before adding
      try {
        await execAsync(
          `${getAresCommand("-setup-device")} --remove ${device.name}`
        );
      } catch {
        // Ignore error if device does not exist or remove fails
      }

      const cmd = `${getAresCommand("-setup-device")} -a ${device.name} -i "username=${device.username}" -i "host=${device.ip}" -i "port=${device.port}"`;
      await execAsync(cmd);

      const { stdout: listOut } = await execAsync(
        `${getAresCommand("-setup-device")} --list`
      );
      return {
        success: true,
        message: "Device registered successfully",
        devices: parseWebOsDevices(listOut),
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes("already exists")) {
        const { stdout: listOut } = await execAsync(
          `${getAresCommand("-setup-device")} --list`
        );
        return {
          success: true,
          message: errorMessage,
          devices: parseWebOsDevices(listOut),
        };
      }
      return { success: false, message: errorMessage };
    }
  });

  // Update a webOS device
  ipcMain.handle("update-device", async (_event, device) => {
    try {
      logger.info("Updating device", { name: device.name });
      // Validate device name
      if (!device.name) {
        return { success: false, message: "Device name is required." };
      }
      // Validate IP address
      if (!device.ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(device.ip)) {
        return { success: false, message: "Device IP is invalid or missing." };
      }
      // Validate port
      if (!device.port || isNaN(Number(device.port))) {
        return {
          success: false,
          message: "Device port is invalid or missing.",
        };
      }
      // Remove existing device
      try {
        await execAsync(
          `${getAresCommand("-setup-device")} --remove ${device.name}`
        );
      } catch {
        // Ignore error if device does not exist
        logger.debug(`Device removal (may not exist)`, { name: device.name });
      }
      // Add device with updated info
      const cmd = `${getAresCommand("-setup-device")} -a ${
        device.name
      } -i "username=${device.username}" -i "host=${device.ip}" -i "port=${
        device.port
      }"`;
      const { stdout } = await execAsync(cmd);
      return { success: true, message: stdout };
    } catch (error) {
      return { success: false, message: getErrorMessage(error) };
    }
  });

  // Remove a webOS device
  ipcMain.handle("remove-device", async (_event, name) => {
    try {
      const { stdout } = await execAsync(
        `${getAresCommand("-setup-device")} --remove ${name}`
      );
      return { success: true, message: stdout };
    } catch (error) {
      return { success: false, message: getErrorMessage(error) };
    }
  });
}

// Internal Deployment Helpers

async function getAppIdFromInfo(projectPath: string): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const appinfoPath = path.join(projectPath, WEBOS_CONSTANTS.CONFIG_FILE);
  const content = await fs.readFile(appinfoPath, "utf-8");
  const appinfo = JSON.parse(content);
  if (!appinfo.id) throw new Error("Could not find app ID in appinfo.json");
  return appinfo.id;
}

// Exported platform-specific functions for use by main handler

export async function testWebOsConnection(
  deviceName: string,
  passphrase?: string
) {
  try {
    // Test connection using ares-device-info
    const { stderr } = await execAsync(
      `${getAresCommand("-device-info")} -d ${deviceName}`
    );

    if (stderr && stderr.toLowerCase().includes("error")) {
      throw new Error(stderr);
    }

    // If we get here, the device is reachable and SSH keys are set up
    return {
      success: true,
      message: `Successfully connected to webOS device: ${deviceName}`,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    // Check for SSH authentication failure - try to set up SSH keys automatically
    if (
      errorMessage.includes("All configured authentication methods failed") ||
      errorMessage.includes("ssh exec failure")
    ) {
      // If we have a passphrase, try to set up SSH keys automatically
      if (passphrase) {
        try {
          logger.info(
            `SSH authentication failed, attempting to set up SSH keys`,
            { deviceName }
          );

          // Run ares-novacom --getkey with the passphrase
          // We need to use spawn to handle the interactive passphrase prompt
          const { spawn } = await import("child_process");

          return await new Promise((resolve) => {
            const aresNovacom = getAresCommand("-novacom").replace(/"/g, "");
            const proc = spawn(aresNovacom, ["--getkey", "-d", deviceName], {
              shell: true,
            });
            processManager.track(proc);

            let output = "";
            let errorOutput = "";
            let passphraseEntered = false;

            proc.stdout.on("data", (data) => {
              const text = data.toString();
              output += text;
              logger.debug(`ares-novacom stdout: ${text}`);

              // Check if it's asking for passphrase
              if (
                (text.includes("passphrase") || text.includes("Passphrase")) &&
                !passphraseEntered
              ) {
                logger.debug("Sending passphrase to ares-novacom");
                proc.stdin.write(`${passphrase}\n`);
                passphraseEntered = true;
              }
            });

            proc.stderr.on("data", (data) => {
              const text = data.toString();
              errorOutput += text;
              logger.debug(`ares-novacom stderr: ${text}`);
            });

            proc.on("close", async (code) => {
              logger.debug(`ares-novacom exited with code ${code}`);

              if (
                code === 0 ||
                output.includes("success") ||
                output.includes("generated")
              ) {
                // SSH keys set up successfully, test connection again
                try {
                  await execAsync(
                    `${getAresCommand("-device-info")} -d ${deviceName}`
                  );
                  resolve({
                    success: true,
                    message: `SSH keys configured successfully. Connected to webOS device: ${deviceName}`,
                  });
                } catch {
                  resolve({
                    success: true,
                    message: `SSH keys configured. Device is reachable at ${deviceName}. You can proceed to build and deploy.`,
                  });
                }
              } else {
                resolve({
                  success: false,
                  message: `Failed to set up SSH keys. Error: ${
                    errorOutput || "Unknown error"
                  }. Please check the passphrase and ensure Developer Mode Key Server is enabled on the TV.`,
                });
              }
            });

            proc.on("error", (err) => {
              resolve({
                success: false,
                message: `Failed to run ares-novacom: ${err.message}`,
              });
            });
          });
        } catch (setupError) {
          return {
            success: false,
            message: `Failed to set up SSH keys: ${getErrorMessage(
              setupError
            )}`,
          };
        }
      } else {
        // No passphrase provided
        return {
          success: false,
          message: `Device is reachable but SSH keys are not set up. Please provide the passphrase from your TV's Developer Mode app when registering the device.`,
        };
      }
    }

    // Check for common error messages
    if (errorMessage.includes("command not found")) {
      return {
        success: false,
        message:
          "ares-device-info command not found. Please ensure webOS SDK is installed and in your PATH.",
      };
    }

    if (errorMessage.includes("Invalid value")) {
      return {
        success: false,
        message: `Device "${deviceName}" not found. Please register the device first using Device Management.`,
      };
    }

    return {
      success: false,
      message: getErrorMessage(error) || "Connection failed",
    };
  }
}

export async function buildWebOsPackage(projectPath: string) {
  try {
    const path = await import("path");
    const fs = await import("fs/promises");

    logger.info("Building webOS package", { projectPath });

    const parentDir = path.dirname(projectPath);
    const folderName = path.basename(projectPath);

    // Run ares-package
    await execAsync(`${getAresCommand("-package")} "${folderName}"`, {
      cwd: parentDir,
    });

    const files = await fs.readdir(parentDir);
    const ipkFiles = files.filter((f) =>
      f.endsWith(WEBOS_CONSTANTS.PACKAGE_EXTENSION)
    );

    if (ipkFiles.length === 0) {
      throw new Error("IPK file not found after build.");
    }

    // Get newest IPK
    let newestIpk = ipkFiles[0];
    let newestTime = 0;

    for (const ipkFile of ipkFiles) {
      const stats = await fs.stat(path.join(parentDir, ipkFile));
      if (stats.mtimeMs > newestTime) {
        newestTime = stats.mtimeMs;
        newestIpk = ipkFile;
      }
    }

    const ipkInProject = path.join(projectPath, newestIpk);
    await fs.rename(path.join(parentDir, newestIpk), ipkInProject);

    return {
      success: true,
      message: `IPK package generated successfully: ${newestIpk}`,
      packagePath: ipkInProject,
      packageName: newestIpk,
    };
  } catch (error) {
    logger.error("Build error", error);
    const message = getErrorMessage(error) || "Build failed";

    if (message.includes("appinfo.json")) {
      return {
        success: false,
        message: "appinfo.json not found in project directory.",
      };
    }
    return { success: false, message };
  }
}

export async function deployWebOsApp(
  deviceName: string,
  projectPath: string,
  mode: "debug" | "run",
  sendLog: (message: string) => void
) {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    sendLog(logger.getTimeLog(`Connecting to device: ${deviceName}...`));

    // Find IPK
    const files = await fs.readdir(projectPath);
    const ipkFile = files.find((f) =>
      f.endsWith(WEBOS_CONSTANTS.PACKAGE_EXTENSION)
    );
    if (!ipkFile)
      throw new Error("IPK file not found. Please build the package first.");

    const ipkPath = path.join(projectPath, ipkFile);
    sendLog(logger.getTimeLog(`Found IPK: ${ipkFile}`));

    // Install
    sendLog(logger.getTimeLog(`Installing ${ipkFile}...`));
    const { stderr: installErr } = await execAsync(
      `${getAresCommand("-install")} -d ${deviceName} "${ipkPath}"`
    );
    if (installErr && installErr.toLowerCase().includes("error"))
      throw new Error(installErr);
    sendLog(logger.getTimeLog("Installation complete"));

    const appId = await getAppIdFromInfo(projectPath);
    sendLog(logger.getTimeLog(`App ID: ${appId}`));

    if (mode === "debug") {
      sendLog(logger.getTimeLog("Launching application in debug mode..."));
      const { stderr: debugLaunchErr } = await execAsync(
        `${getAresCommand("-launch")} -d ${deviceName} ${appId}`
      );
      if (debugLaunchErr && debugLaunchErr.toLowerCase().includes("error")) {
        throw new Error(debugLaunchErr);
      }
      sendLog(logger.getTimeLog("App launched. Starting webOS inspector..."));
      return await startWebOsDebugSession(deviceName, appId, sendLog);
    } else {
      sendLog(logger.getTimeLog("Launching application..."));
      const { stderr: launchErr } = await execAsync(
        `${getAresCommand("-launch")} -d ${deviceName} ${appId}`
      );
      if (launchErr && launchErr.toLowerCase().includes("error"))
        throw new Error(launchErr);
      sendLog(logger.getTimeLog("Application launched successfully"));
    }

    return { success: true, message: "Deployment completed successfully" };
  } catch (error) {
    logger.error("Deployment error", error);
    const message = getErrorMessage(error) || "Deployment failed";
    const execError = error as { stdout?: string; stderr?: string };
    if (execError.stdout)
      sendLog(logger.getTimeLog(`CLI Output: ${execError.stdout.trim()}`));
    if (execError.stderr)
      sendLog(
        logger.getTimeLog(`CLI Error Details: ${execError.stderr.trim()}`)
      );
    return { success: false, message };
  }
}

async function startWebOsDebugSession(
  deviceName: string,
  appId: string,
  sendLog: (msg: string) => void
): Promise<{ success: boolean; message: string }> {
  const { spawn } = await import("child_process");

  const inspectBinary = getAresCommand("-inspect").replace(/"/g, "");
  const urlPatterns = [
    /(https?:\/\/localhost:\d+\/[^\s"'<>]+)/,
    /(https?:\/\/localhost:\d+\b)/,
    /(https?:\/\/127\.0\.0\.1:\d+\/[^\s"'<>]+)/,
    /(https?:\/\/127\.0\.0\.1:\d+\b)/,
    /(chrome-devtools:\/\/[^\s"'<>]+)/,
    /(ws:\/\/localhost:\d+\/[^\s"'<>]+)/,
    /(ws:\/\/127\.0\.0\.1:\d+\/[^\s"'<>]+)/,
  ];
  const nonFatalForwardPattern =
    /session#forward\(\) failed forwarding client localPort:\s*0(?:\s*\([^)]*\))?\s*=>\s*devicePort:\s*\d+/i;
  const nonActionableInspectWarnPattern = /^ares-inspect\s+warn\b/i;

  const findInspectorUrl = (text: string): string | null => {
    for (const pattern of urlPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
    return null;
  };

  const shouldLogInspectLine = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (trimmed.toLowerCase().includes("deprecat")) return false;
    if (trimmed.includes("http")) return false;
    if (nonFatalForwardPattern.test(trimmed)) return false;
    if (nonActionableInspectWarnPattern.test(trimmed)) return false;
    return true;
  };

  const runInspectAttempt = (
    args: string[],
    timeoutMs: number
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      const proc = spawn(inspectBinary, args, { shell: true });
      processManager.track(proc);

      let settled = false;
      let outputBuffer = "";

      const finalize = (url: string | null) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        resolve(url);
      };

      const checkForUrl = (text: string) => {
        outputBuffer += text;
        const capturedUrl = findInspectorUrl(outputBuffer);
        if (capturedUrl) {
          finalize(capturedUrl);
        }
      };

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        if (shouldLogInspectLine(text)) {
          sendLog(logger.getTimeLog(text.trim()));
        }
        checkForUrl(text);
      });

      proc.stderr.on("data", (data) => {
        const text = data.toString();
        if (shouldLogInspectLine(text)) {
          sendLog(logger.getTimeLog(text.trim()));
        }
        checkForUrl(text);
      });

      proc.on("error", (err) => {
        logger.error("ares-inspect process error", err);
        sendLog(logger.getTimeLog(`Inspector error: ${err.message}`));
        finalize(null);
      });

      const timeoutHandle = setTimeout(() => {
        if (!settled) {
          // First attempt failed to provide a URL; stop this process before retry.
          proc.kill();
          finalize(null);
        }
      }, timeoutMs);

      proc.on("close", () => {
        if (!settled) {
          finalize(findInspectorUrl(outputBuffer));
        }
      });
    });
  };

  const initialUrl = await runInspectAttempt(
    ["--device", deviceName, "--app", appId],
    DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS
  );

  if (initialUrl) {
    sendLog(logger.getTimeLog(`✓ Inspector URL captured: ${initialUrl}`));
    sendLog("Debug link ready. Open it in Chrome to inspect your app.");
    return { success: true, message: "Deployment completed successfully" };
  }

  sendLog(
    logger.getTimeLog(
      "Inspector URL not detected. Retrying automatically with browser-open mode..."
    )
  );

  const retryUrl = await runInspectAttempt(
    ["--device", deviceName, "--app", appId, "--open"],
    INSPECT_RETRY_TIMEOUT_MS
  );

  if (retryUrl) {
    sendLog(logger.getTimeLog(`✓ Inspector URL captured: ${retryUrl}`));
    sendLog("Inspector opened. If no browser appeared, open the URL above.");
    return { success: true, message: "Deployment completed successfully" };
  }

  sendLog(
    logger.getTimeLog(
      "⚠️ Debug inspector could not be opened automatically on this setup."
    )
  );
  sendLog(
    "Please ask a developer to verify local webOS CLI/Chrome compatibility for this machine."
  );
  return { success: true, message: "Deployment completed" };
}
