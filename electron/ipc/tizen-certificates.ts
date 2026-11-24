/**
 * Tizen certificate generation (author + distributor PKCS12).
 *
 * Flow: Samsung config → OAuth → OpenSSL CSR → Samsung signing → PKCS12
 * → optional `tizen security-profiles add`.
 */

import { shell, app } from "electron";
import * as path from "node:path";
import { store } from "../store";
import { runCli } from "../utils/cli";
import {
  getTizenCertConfig,
  evictTizenCertConfigCache,
  getCaCertPath,
} from "../utils/tizen-cert-config";
import {
  startOAuthServer,
  OAuthCredentials,
  OAuthSession,
} from "../utils/tizen-oauth-server";
import { resolveOpenssl, runOpenssl } from "../utils/tizen-openssl";
import {
  buildAuthUrl,
  certificateDir,
  generateCertificates,
  getRegisteredRedirectUri,
  StaleConfigError,
} from "../utils/tizen-cert-generator";
import { getErrorMessage } from "../utils/errors";
import { handle, replyLog } from "./handle";

const DEFAULT_P12_PASSWORD = "tizencert";
const OAUTH_SESSION_TTL_MS = 10 * 60 * 1000;

let cachedOAuthCredentials: {
  credentials: OAuthCredentials;
  expiresAt: number;
} | null = null;

// Set for the whole login, so it can be cancelled while the config is still downloading.
interface Login {
  cancelled: boolean;
  session?: OAuthSession;
}
let inFlightLogin: Login | null = null;

const LOG_CHANNEL = "tizen-cert:log" as const;

export function registerTizenCertHandlers() {
  handle("tizen-cert:login", async (event) => {
    if (inFlightLogin) {
      throw new Error("Samsung login is already in progress.");
    }
    const sendLog = replyLog(event, LOG_CHANNEL);
    const login: Login = { cancelled: false };
    inFlightLogin = login;
    let oauthSession: OAuthSession | null = null;

    try {
      sendLog(
        "Fetching Samsung certificate configuration (this can take a minute)…"
      );
      const config = await getTizenCertConfig();
      if (login.cancelled) throw new Error("Samsung login cancelled by user");
      sendLog("Configuration ready.");

      oauthSession = await startOAuthServer({
        redirectUri: getRegisteredRedirectUri(config.loginUrl),
      });
      login.session = oauthSession;

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
      return { email: credentials.email };
    } catch (error) {
      const message = getErrorMessage(error);
      if (/cancelled/i.test(message)) {
        sendLog("Samsung login cancelled. You can retry now.");
        return { success: false, cancelled: true, message };
      }
      sendLog(`Error: ${message}`);
      throw error;
    } finally {
      if (inFlightLogin === login) inFlightLogin = null;
      oauthSession?.close("Samsung login session closed");
    }
  });

  handle("tizen-cert:cancel-login", async (event) => {
    if (!inFlightLogin) {
      throw new Error("No Samsung login is currently in progress.");
    }
    inFlightLogin.cancelled = true;
    inFlightLogin.session?.close("Samsung login cancelled by user");
    inFlightLogin = null;
    replyLog(event, LOG_CHANNEL)("Cancelling Samsung login…");
  });

  handle("tizen-cert:logout", async () => {
    if (inFlightLogin) inFlightLogin.cancelled = true;
    inFlightLogin?.session?.close("Samsung login cancelled by user");
    inFlightLogin = null;
    cachedOAuthCredentials = null;
  });

  handle("tizen-cert:generate", async (event, params) => {
    const sendLog = replyLog(event, LOG_CHANNEL);
    const credentials = getCachedOAuthCredentials();
    if (!credentials) {
      throw new Error(
        "Samsung login required. Please click 'Sign in with Samsung' first."
      );
    }

    try {
      sendLog("Checking OpenSSL…");
      const opensslBin = await resolveOpenssl();

      sendLog("Fetching Samsung certificate configuration…");
      const config = await getTizenCertConfig();
      sendLog("Configuration ready.");
      sendLog("Using active Samsung login session.");

      const certDir = certificateDir(app.getPath("home"), params);
      const exportPassword = params.password?.trim() || DEFAULT_P12_PASSWORD;

      await generateCertificates({
        dir: certDir,
        email: params.email.trim(),
        deviceIds: params.deviceIds ?? [],
        password: exportPassword,
        privilegeLevel: params.privilegeLevel ?? "Public",
        developerType: params.developerType ?? "Individual",
        credentials,
        config,
        caCerts: {
          author: getCaCertPath("author"),
          distributor: getCaCertPath("distributor"),
        },
        openssl: (args, stdin) => runOpenssl(opensslBin, args, certDir, stdin),
        log: sendLog,
      });

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
      return { path: certDir };
    } catch (error) {
      if (error instanceof StaleConfigError) evictTizenCertConfigCache();
      sendLog(`Error: ${getErrorMessage(error)}`);
      throw error;
    }
  });
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

async function registerSecurityProfile(
  certDir: string,
  profileName: string,
  password: string
) {
  const tizenCmd = store.get("tizenPath") || "tizen";
  await runCli(tizenCmd, [
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
