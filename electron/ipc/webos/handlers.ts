import { ipcMain, dialog } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import { store } from "../../store";
import { logger } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";
import { WEBOS_CONSTANTS, DEPLOY_CONSTANTS } from "../../utils/constants";

const execAsync = promisify(exec);

// Helper to get ares command with SDK path
// The user provides a base path like: /Users/name/webOS_TV_SDK/CLI/bin/ares
// We append the specific command suffix like: -setup-device, -package, etc.
function getAresCommand(suffix: string): string {
  const paths = store.getAll();
  if (paths.aresPath) {
    // aresPath is like: /path/to/ares
    // We need to append the suffix like: -setup-device
    return `"${paths.aresPath}${suffix}"`;
  }
  // Fallback to system PATH
  return `ares${suffix}`;
}

export function registerWebOsHandlers() {
  // List registered webOS devices
  ipcMain.handle("list-devices", async () => {
    try {
      const { stdout } = await execAsync(
        `${getAresCommand("-setup-device")} --list`
      );
      // Parse tabular output
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const devices: Array<{
        name: string;
        ip: string;
        port: string;
        username: string;
      }> = [];
      // Find header line and start parsing after it
      let startIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].includes("deviceinfo") &&
          lines[i].includes("connection")
        ) {
          startIdx = i + 2; // skip header and separator
          break;
        }
      }
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Split by two or more spaces
        const parts = line.split(/\s{2,}/);
        if (parts.length < 2) continue;
        // name, deviceinfo, connection, profile
        const name = parts[0].replace(/ \(default\)/, "").trim();
        const deviceinfo = parts[1];
        // deviceinfo format: user@ip:port
        let username = "",
          ip = "",
          port = "";
        const match = deviceinfo.match(/([^@]+)@([\d.]+):(\d+)/);
        if (match) {
          username = match[1];
          ip = match[2];
          port = match[3];
        }
        devices.push({ name, ip, port, username });
      }
      return { success: true, devices };
    } catch (error) {
      return { success: false, message: getErrorMessage(error) };
    }
  });

  // Add/register a new webOS device
  ipcMain.handle("add-device", async (_event, device) => {
    try {
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
      // Always remove any existing device with the same name before adding
      try {
        await execAsync(
          `${getAresCommand("-setup-device")} --remove ${device.name}`
        );
      } catch (err) {
        // Ignore error if device does not exist
      }

      const cmd = `${getAresCommand("-setup-device")} -a ${
        device.name
      } -i "username=${device.username}" -i "host=${device.ip}" -i "port=${
        device.port
      }"`;
      const { stdout } = await execAsync(cmd);
      // After adding, list devices and return updated list
      const { stdout: listOut } = await execAsync(
        `${getAresCommand("-setup-device")} --list`
      );
      // Parse tabular output
      const lines = listOut.split(/\r?\n/).filter(Boolean);
      const devices: Array<{
        name: string;
        ip: string;
        port: string;
        username: string;
      }> = [];
      let startIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (
          lines[i].includes("deviceinfo") &&
          lines[i].includes("connection")
        ) {
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
        let username = "",
          ip = "",
          port = "";
        const match = deviceinfo.match(/([^@]+)@([\d.]+):(\d+)/);
        if (match) {
          username = match[1];
          ip = match[2];
          port = match[3];
        }
        devices.push({ name, ip, port, username });
      }
      return { success: true, message: stdout, devices };
    } catch (error) {
      if (error.message && error.message.includes("already exists")) {
        // Still return updated device list
        const { stdout: listOut } = await execAsync(
          `${getAresCommand("-setup-device")} --list`
        );
        const lines = listOut.split(/\r?\n/).filter(Boolean);
        const devices: Array<{
          name: string;
          ip: string;
          port: string;
          username: string;
        }> = [];
        let startIdx = 0;
        for (let i = 0; i < lines.length; i++) {
          if (
            lines[i].includes("deviceinfo") &&
            lines[i].includes("connection")
          ) {
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
          let username = "",
            ip = "",
            port = "";
          const match = deviceinfo.match(/([^@]+)@([\d.]+):(\d+)/);
          if (match) {
            username = match[1];
            ip = match[2];
            port = match[3];
          }
          devices.push({ name, ip, port, username });
        }
        return { success: true, message: error.message, devices };
      }
      return { success: false, message: getErrorMessage(error) };
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
      } catch (err) {
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
      const cmd = `${getAresCommand("-setup-device")} --remove ${name}`;
      const { stdout } = await execAsync(cmd);
      return { success: true, message: stdout };
    } catch (error) {
      return { success: false, message: getErrorMessage(error) };
    }
  });
}

// Exported platform-specific functions for use by main handler

export async function testWebOsConnection(
  deviceName: string,
  passphrase?: string
) {
  try {
    // Test connection using ares-device-info
    const { stdout, stderr } = await execAsync(
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
    // Check for SSH authentication failure - try to set up SSH keys automatically
    if (
      error.message.includes("All configured authentication methods failed") ||
      error.message.includes("ssh exec failure")
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
                } catch (retryError) {
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
    if (error.message.includes("command not found")) {
      return {
        success: false,
        message:
          "ares-device-info command not found. Please ensure webOS SDK is installed and in your PATH.",
      };
    }

    if (error.message.includes("Invalid value")) {
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
    logger.info("Building webOS package", { projectPath });

    const path = await import("path");
    const fs = await import("fs/promises");

    // ares-package needs to be run from the parent directory
    // and passed the folder name (not full path)
    const parentDir = path.dirname(projectPath);
    const folderName = path.basename(projectPath);

    // Run ares-package from parent directory
    const { stdout, stderr } = await execAsync(
      `${getAresCommand("-package")} "${folderName}"`,
      {
        cwd: parentDir,
      }
    );

    if (stderr) {
      logger.debug("ares-package stderr", stderr);
    }

    // The IPK file is created in the parent directory
    // Find the most recently created IPK file to avoid picking up old builds
    const files = await fs.readdir(parentDir);
    const ipkFiles = files.filter((f) => f.endsWith(".ipk"));

    if (ipkFiles.length === 0) {
      throw new Error(
        "IPK file not found after build. The build may have failed silently or output to an unexpected location."
      );
    }

    // Get the most recently modified IPK file
    let newestIpk = ipkFiles[0];
    let newestTime = 0;

    for (const ipkFile of ipkFiles) {
      const filePath = path.join(parentDir, ipkFile);
      const stats = await fs.stat(filePath);
      if (stats.mtimeMs > newestTime) {
        newestTime = stats.mtimeMs;
        newestIpk = ipkFile;
      }
    }

    const ipkInParent = path.join(parentDir, newestIpk);
    const ipkInProject = path.join(projectPath, newestIpk);

    logger.info(`Found IPK file: ${newestIpk}`, {
      modifiedTime: new Date(newestTime).toISOString(),
    });
    logger.debug(`Moving IPK from ${ipkInParent} to ${ipkInProject}`);

    // Move the IPK file into the project directory
    await fs.rename(ipkInParent, ipkInProject);

    return {
      success: true,
      message: `IPK package generated successfully: ${newestIpk}`,
      packagePath: ipkInProject,
      packageName: newestIpk,
    };
  } catch (error) {
    logger.error("Build error", error);

    // Check for common errors
    if (error.message.includes("command not found")) {
      return {
        success: false,
        message:
          "ares-package command not found. Please ensure webOS SDK is installed and in your PATH.",
      };
    }

    if (error.message.includes("appinfo.json")) {
      return {
        success: false,
        message:
          "appinfo.json not found. Please ensure your project directory contains the required webOS meta files.",
      };
    }

    return {
      success: false,
      message: getErrorMessage(error) || "Build failed",
    };
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

    sendLog("Connecting to device: " + deviceName + "...");

    // Find the IPK file in the project directory
    const files = await fs.readdir(projectPath);
    const ipkFile = files.find((f) => f.endsWith(".ipk"));

    if (!ipkFile) {
      throw new Error(
        "IPK file not found in project directory. Please build the package first."
      );
    }

    const ipkPath = path.join(projectPath, ipkFile);
    sendLog("Found IPK: " + ipkFile);

    // Install the IPK using ares-install
    sendLog("Installing " + ipkFile + "...");
    const { stdout: installOut, stderr: installErr } = await execAsync(
      `${getAresCommand("-install")} -d ${deviceName} "${ipkPath}"`
    );

    if (installErr && installErr.toLowerCase().includes("error")) {
      throw new Error(installErr);
    }

    sendLog("Installation complete");
    logger.debug("Install output", installOut);

    // Extract app ID from appinfo.json
    const appinfoPath = path.join(projectPath, "appinfo.json");
    const appinfoContent = await fs.readFile(appinfoPath, "utf-8");
    const appinfo = JSON.parse(appinfoContent);
    const appId = appinfo.id;

    if (!appId) {
      throw new Error("Could not find app ID in appinfo.json");
    }

    sendLog("App ID: " + appId);

    // Launch the app using ares-launch
    sendLog("Launching application...");

    if (mode === "debug") {
      // For debug mode, use ares-inspect to launch with inspector
      // ares-inspect is a long-running process, so we spawn it and capture the URL
      const { spawn } = await import("child_process");

      return await new Promise((resolve) => {
        const aresInspect = getAresCommand("-inspect").replace(/"/g, "");
        const proc = spawn(aresInspect, ["-d", deviceName, appId], {
          shell: true,
        });

        let urlFound = false;
        let outputBuffer = "";
        let timeoutHandle: NodeJS.Timeout;

        // Helper function to check for URL in text
        const checkForUrl = (text: string, source: string) => {
          if (urlFound) return;

          // Buffer the output to handle cases where URL is split across chunks
          outputBuffer += text;

          // Look for the inspector URL with multiple possible patterns
          // Pattern 1: http://localhost:PORT/devtools/inspector.html?ws=...
          // Pattern 2: chrome-devtools://devtools/bundled/inspector.html?ws=...
          // Pattern 3: Any URL starting with http://localhost: followed by devtools
          const urlPatterns = [
            /(https?:\/\/localhost:\d+\/[^\s\"'<>]+)/,
            /(chrome-devtools:\/\/[^\s\"'<>]+)/,
            /(ws:\/\/localhost:\d+\/[^\s\"'<>]+)/,
          ];

          for (const pattern of urlPatterns) {
            const urlMatch = outputBuffer.match(pattern);
            if (urlMatch) {
              urlFound = true;
              const inspectorUrl = urlMatch[1];
              logger.debug(`Debug URL found in ${source}: ${inspectorUrl}`);
              sendLog("✓ Inspector URL captured:");
              sendLog(inspectorUrl);
              sendLog("Copy and paste the URL above into Chrome to debug");

              // Clear the timeout since we found the URL
              if (timeoutHandle) {
                clearTimeout(timeoutHandle);
              }

              // Resolve immediately after getting the URL
              // The process will keep running in the background
              resolve({
                success: true,
                message: "Deployment completed successfully",
              });
              return;
            }
          }
        };

        proc.stdout.on("data", (data) => {
          const text = data.toString();
          logger.debug(`ares-inspect stdout: ${text}`);

          // Check for URL in stdout first
          const hasUrl =
            /(https?:\/\/localhost:\d+\/|chrome-devtools:\/\/|ws:\/\/localhost:\d+\/)/.test(
              text
            );

          // Send the raw output to logs only if it doesn't contain a URL
          // (we'll send a custom formatted version when URL is found)
          if (text.trim() && !hasUrl) {
            sendLog(text.trim());
          }

          // Check for URL and send custom formatted message if found
          checkForUrl(text, "stdout");
        });

        proc.stderr.on("data", (data) => {
          const text = data.toString();
          logger.debug(`ares-inspect stderr: ${text}`);

          // Check for URL in stderr first
          const hasUrl =
            /(https?:\/\/localhost:\d+\/|chrome-devtools:\/\/|ws:\/\/localhost:\d+\/)/.test(
              text
            );

          // Also send stderr to logs as it might contain important info
          // But skip if it contains a URL (we'll send custom formatted version)
          if (
            text.trim() &&
            !text.toLowerCase().includes("deprecat") &&
            !hasUrl
          ) {
            sendLog(text.trim());
          }

          // Check for URL in stderr as well (some versions output here)
          checkForUrl(text, "stderr");
        });

        proc.on("error", (err) => {
          logger.error("ares-inspect process error", err);
          sendLog("Error starting inspector: " + err.message);
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          resolve({
            success: false,
            message: "Failed to start inspector: " + err.message,
          });
        });

        // Timeout after 15 seconds if no URL is found (increased from 10s)
        timeoutHandle = setTimeout(() => {
          if (!urlFound) {
            logger.warn("Debug URL timeout: URL not captured within timeout");
            logger.debug("Output buffer content:", outputBuffer);
            sendLog("⚠️ Application launched in debug mode");
            sendLog(
              "Debug URL not captured automatically. This can happen if:"
            );
            sendLog(
              "  • The app launched but ares-inspect didn't output the URL"
            );
            sendLog("  • The URL format changed in your webOS SDK version");
            sendLog("  • Check the logs above for any URLs or error messages");
            resolve({
              success: true,
              message: "Deployment completed (debug URL not captured)",
            });
          }
        }, DEPLOY_CONSTANTS.DEBUG_PORT_TIMEOUT_MS);
      });
    } else {
      // For run mode, just launch normally
      const { stdout: launchOut, stderr: launchErr } = await execAsync(
        `${getAresCommand("-launch")} -d ${deviceName} ${appId}`
      );

      if (launchErr && launchErr.toLowerCase().includes("error")) {
        throw new Error(launchErr);
      }

      logger.debug("Launch output", launchOut);
      sendLog("Application launched successfully");
    }

    return {
      success: true,
      message: "Deployment completed successfully",
    };
  } catch (error) {
    logger.error("Deployment error", error);
    return {
      success: false,
      message: getErrorMessage(error) || "Deployment failed",
    };
  }
}
