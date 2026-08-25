/**
 * Tizen certificate generation (author + distributor PKCS12).
 *
 * Flow: Samsung config → OAuth → OpenSSL CSR → Samsung signing → PKCS12
 * → optional `tizen security-profiles add`.
 */

import { ipcMain, shell, app, BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { store } from "../../store";
import {
  getTizenCertConfig,
  evictTizenCertConfigCache,
  getCaCertPath,
  TizenCertConfig,
} from "../../utils/tizen-cert-config";
import {
  startOAuthServer,
  OAuthCredentials,
  OAuthSession,
} from "../../utils/tizen-oauth-server";
import { resolveOpenssl, runOpenssl } from "../../utils/tizen-openssl";
import { logger } from "../../utils/logger";
import { getErrorMessage } from "../../utils/errors";

const execFileAsync = promisify(execFile);

const DEFAULT_P12_PASSWORD = "tizencert";
const INTERMEDIATE_SUFFIXES = [".csr", ".crt", ".key.pem", "-chain.crt"];
const OAUTH_SESSION_TTL_MS = 10 * 60 * 1000;

let cachedOAuthCredentials: {
  credentials: OAuthCredentials;
  expiresAt: number;
} | null = null;

let inFlightLoginSession: OAuthSession | null = null;

export function registerTizenCertHandlers() {
  ipcMain.handle("tizen-cert-login", async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const sendLog = (message: string) =>
      mainWindow?.webContents.send("tizen-cert-log", message);

    let oauthSession: OAuthSession | null = null;

    try {
      if (inFlightLoginSession) {
        return {
          success: false,
          message: "Samsung login is already in progress.",
        };
      }

      sendLog("Fetching Samsung certificate configuration…");
      const config = await getTizenCertConfig();
      sendLog("Configuration ready.");

      const registeredRedirectUri = getRegisteredRedirectUri(config.loginUrl);
      oauthSession = await startOAuthServer({
        redirectUri: registeredRedirectUri,
      });
      inFlightLoginSession = oauthSession;

      const authUrl = buildAuthUrl(
        config,
        oauthSession.redirectUri,
        oauthSession.state
      );
      sendLog("Opening Samsung login in your browser (5 minute timeout)…");
      await shell.openExternal(authUrl);

      const credentials = await oauthSession.credentials;
      cachedOAuthCredentials = {
        credentials,
        expiresAt: Date.now() + OAUTH_SESSION_TTL_MS,
      };

      sendLog("Samsung login successful. Continue with certificate details.");
      return { success: true, email: credentials.email };
    } catch (error) {
      const message = getErrorMessage(error);
      const cancelled = /cancelled/i.test(message);
      logger.error("Samsung login failed", error);
      if (cancelled) {
        sendLog("Samsung login cancelled. You can retry now.");
      } else {
        sendLog(`Error: ${message}`);
      }
      return { success: false, message, cancelled };
    } finally {
      if (oauthSession === inFlightLoginSession) {
        inFlightLoginSession = null;
      }
      oauthSession?.close("Samsung login session closed");
    }
  });

  ipcMain.handle("tizen-cert-cancel-login", async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const sendLog = (message: string) =>
      mainWindow?.webContents.send("tizen-cert-log", message);

    if (!inFlightLoginSession) {
      return {
        success: false,
        message: "No Samsung login is currently in progress.",
      };
    }

    inFlightLoginSession.close("Samsung login cancelled by user");
    inFlightLoginSession = null;
    sendLog("Cancelling Samsung login…");

    return { success: true };
  });

  ipcMain.handle("tizen-cert-logout", async () => {
    if (inFlightLoginSession) {
      inFlightLoginSession.close("Samsung login cancelled by user");
      inFlightLoginSession = null;
    }

    cachedOAuthCredentials = null;
    return { success: true };
  });

  ipcMain.handle(
    "tizen-generate-certificates",
    async (_event, params: CertificateParams) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const sendLog = (message: string) =>
        mainWindow?.webContents.send("tizen-cert-log", message);

      try {
        const credentials = getCachedOAuthCredentials();
        if (!credentials) {
          return {
            success: false,
            message:
              "Samsung login required. Please click 'Sign in with Samsung' first.",
          };
        }

        sendLog("Checking OpenSSL…");
        const opensslBin = await resolveOpenssl();

        sendLog("Fetching Samsung certificate configuration…");
        const config = await getTizenCertConfig();
        sendLog("Configuration ready.");
        sendLog("Using active Samsung login session.");

        const certDir = resolveSamsungCertificateDir(params);
        await fs.mkdir(certDir, { recursive: true });

        const exportPassword = params.password?.trim() || DEFAULT_P12_PASSWORD;

        sendLog("Generating author certificate…");
        await generateAuthorCert(
          opensslBin,
          certDir,
          params.email.trim(),
          credentials,
          config
        );

        sendLog("Generating distributor certificate…");
        await generateDistributorCert(
          opensslBin,
          certDir,
          params.email.trim(),
          params.deviceIds ?? [],
          credentials,
          config,
          {
            privilegeLevel: params.privilegeLevel ?? "Public",
            developerType: params.developerType ?? "Individual",
          }
        );

        sendLog("Exporting PKCS12 files (author.p12, distributor.p12)…");
        await exportPkcs12(opensslBin, certDir, "author", exportPassword);
        await exportPkcs12(opensslBin, certDir, "distributor", exportPassword);

        await cleanupIntermediateFiles(certDir);

        const profileName = params.profileName?.trim();
        if (profileName) {
          sendLog(`Registering Tizen security profile "${profileName}"…`);
          try {
            await registerSecurityProfile(certDir, profileName, exportPassword);
            sendLog(`Profile "${profileName}" is ready for tizen package.`);
          } catch (err) {
            sendLog(
              `Warning: profile registration failed — ${getErrorMessage(err)}. You can add it manually with tizen security-profiles add.`
            );
          }
        }

        sendLog("Done! author.p12 and distributor.p12 are ready.");
        return { success: true, path: certDir };
      } catch (error) {
        const message = getErrorMessage(error);
        logger.error("Certificate generation failed", error);
        sendLog(`Error: ${message}`);
        return { success: false, message };
      }
    }
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface CertificateParams {
  email: string;
  deviceIds?: string[];
  password?: string;
  privilegeLevel?: "Public" | "Partner" | "Platform";
  developerType?: "Individual" | "Corporation";
  profileName?: string;
}

interface DistributorOptions {
  privilegeLevel: string;
  developerType: string;
}

function sanitizeFolderSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveSamsungCertificateDir(params: CertificateParams): string {
  const homeDir = app.getPath("home");
  const emailPrefix = params.email.split("@")[0] || "default";
  const preferredName = params.profileName?.trim() || emailPrefix;
  const folderName = sanitizeFolderSegment(preferredName) || "default";
  return path.join(homeDir, "SamsungCertificate", folderName);
}

// ── OAuth ────────────────────────────────────────────────────────────────────

function buildAuthUrl(
  config: TizenCertConfig,
  redirectUri: string,
  state: string
): string {
  const url = new URL(config.loginUrl);
  url.searchParams.set("serviceID", config.serviceId);
  url.searchParams.set("actionID", "StartOAuth2");
  url.searchParams.set("accessToken", "Y");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

function getRegisteredRedirectUri(loginUrl: string): string | undefined {
  try {
    const url = new URL(loginUrl);
    const redirectUri = url.searchParams.get("redirect_uri");
    return redirectUri?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function getCachedOAuthCredentials(): OAuthCredentials | null {
  if (!cachedOAuthCredentials) {
    return null;
  }

  if (Date.now() >= cachedOAuthCredentials.expiresAt) {
    cachedOAuthCredentials = null;
    return null;
  }

  return cachedOAuthCredentials.credentials;
}

// ── Certificate generation ─────────────────────────────────────────────────────

async function generateAuthorCert(
  opensslBin: string,
  workDir: string,
  email: string,
  credentials: OAuthCredentials,
  config: TizenCertConfig
) {
  await runOpenssl(
    opensslBin,
    ["genrsa", "-out", "author.key.pem", "2048"],
    workDir
  );
  await runOpenssl(
    opensslBin,
    [
      "req",
      "-new",
      "-key",
      "author.key.pem",
      "-out",
      "author.csr",
      "-subj",
      `/CN=${email}`,
    ],
    workDir
  );

  const csrPath = path.join(workDir, "author.csr");
  const crtPath = path.join(workDir, "author.crt");
  await submitCsr(csrPath, crtPath, config.authorUrl, credentials);

  await combineCerts(
    crtPath,
    getCaCertPath("author"),
    path.join(workDir, "author-chain.crt")
  );
}

async function generateDistributorCert(
  opensslBin: string,
  workDir: string,
  email: string,
  deviceIds: string[],
  credentials: OAuthCredentials,
  config: TizenCertConfig,
  options: DistributorOptions
) {
  const deviceURIs = deviceIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `URI:URN:tizen:deviceid=${id}`);

  await runOpenssl(
    opensslBin,
    ["genrsa", "-out", "distributor.key.pem", "2048"],
    workDir
  );

  const reqArgs = [
    "req",
    "-new",
    "-key",
    "distributor.key.pem",
    "-out",
    "distributor.csr",
    "-subj",
    `/CN=TizenSDK/emailAddress=${email}`,
  ];
  if (deviceURIs.length > 0) {
    reqArgs.push("-addext", `subjectAltName=${deviceURIs.join(",")}`);
  }
  await runOpenssl(opensslBin, reqArgs, workDir);

  const csrPath = path.join(workDir, "distributor.csr");
  const crtPath = path.join(workDir, "distributor.crt");
  await submitCsr(csrPath, crtPath, config.distributorUrl, credentials, {
    privilege_level: options.privilegeLevel,
    developer_type: options.developerType,
  });

  await combineCerts(
    crtPath,
    getCaCertPath("distributor"),
    path.join(workDir, "distributor-chain.crt")
  );
}

async function exportPkcs12(
  opensslBin: string,
  workDir: string,
  type: "author" | "distributor",
  password: string
) {
  const passoutStdin = `${password}\n`;
  const baseArgs = [
    "pkcs12",
    "-export",
    "-out",
    `${type}.p12`,
    "-inkey",
    `${type}.key.pem`,
    "-in",
    `${type}-chain.crt`,
    "-name",
    "usercertificate",
    "-passout",
    "stdin",
  ];
  const runExport = (args: string[]) =>
    runOpenssl(opensslBin, args, workDir, passoutStdin);

  try {
    await runExport([...baseArgs, "-legacy"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unknown option\s+'?-legacy'?/i.test(message)) {
      await runExport(baseArgs);
    } else {
      throw error;
    }
  }
}

// ── Samsung API ──────────────────────────────────────────────────────────────

async function submitCsr(
  csrPath: string,
  outputPath: string,
  apiUrl: string,
  credentials: OAuthCredentials,
  extraFields?: Record<string, string>
) {
  const csrContent = await fs.readFile(csrPath);
  const form = new FormData();
  form.append("access_token", credentials.accessToken);
  form.append("user_id", credentials.userId);
  form.append("platform", "VD");
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      form.append(key, value);
    }
  }
  form.append("csr", new Blob([csrContent]), path.basename(csrPath));

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
    body: form,
  });

  if (res.status === 404 || res.status === 410) {
    evictTizenCertConfigCache();
    throw new Error(
      `Samsung endpoint returned ${res.status}. Config cache cleared — please retry.`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Samsung API ${res.status} for ${path.basename(csrPath)}: ${body}`
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (!isValidCertificate(buf)) {
    evictTizenCertConfigCache();
    const preview = buf
      .toString("utf-8", 0, Math.min(200, buf.length))
      .replace(/\s+/g, " ")
      .trim();
    throw new Error(
      `Samsung returned a non-certificate response: ${preview}. Cache cleared — please retry.`
    );
  }

  await fs.writeFile(outputPath, buf);
}

function isValidCertificate(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const head = buf.toString("utf-8", 0, Math.min(200, buf.length));
  if (head.includes("-----BEGIN CERTIFICATE-----")) return true;
  return buf[0] === 0x30;
}

async function registerSecurityProfile(
  certDir: string,
  profileName: string,
  password: string
) {
  const tizenCmd = store.get("tizenPath") || "tizen";
  await execFileAsync(tizenCmd, [
    "security-profiles",
    "add",
    "-n",
    profileName,
    "-a",
    path.join(certDir, "author.p12"),
    "-p",
    password,
    "-d",
    path.join(certDir, "distributor.p12"),
    "-dp",
    password,
  ]);
}

async function combineCerts(
  certPath: string,
  caCertPath: string,
  outputPath: string
) {
  const cert = await fs.readFile(certPath);
  const ca = await fs.readFile(caCertPath);
  await fs.writeFile(outputPath, Buffer.concat([cert, Buffer.from("\n"), ca]));
}

async function cleanupIntermediateFiles(dir: string) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    if (INTERMEDIATE_SUFFIXES.some((suffix) => file.endsWith(suffix))) {
      await fs.unlink(path.join(dir, file)).catch((err) => {
        logger.warn(`Failed to delete ${file}`, err);
      });
    }
  }
}
