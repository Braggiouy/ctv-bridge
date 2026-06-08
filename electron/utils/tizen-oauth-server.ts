/**
 * Ephemeral HTTP server for the Samsung OAuth callback.
 *
 * Samsung redirects the browser to localhost with a `code` query param
 * containing a JSON string with `access_token` and `userId`.
 */

import http from "node:http";
import { randomBytes } from "node:crypto";
import { logger } from "./logger";

export interface OAuthCredentials {
  accessToken: string;
  userId: string;
  email?: string;
}

export interface OAuthSession {
  port: number;
  redirectUri: string;
  state: string;
  credentials: Promise<OAuthCredentials>;
  close: (reason?: string) => void;
}

interface OAuthServerOptions {
  redirectUri?: string;
}

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Starts a loopback-only server. If Samsung provides a registered
 * redirect_uri, we bind to its exact port/path to avoid OAuth mismatch.
 */
export function startOAuthServer(
  options: OAuthServerOptions = {}
): Promise<OAuthSession> {
  return new Promise((resolveSession, rejectSession) => {
    const state = randomBytes(16).toString("hex");

    const requestedRedirect = parseRedirectUri(options.redirectUri);
    const callbackPath = requestedRedirect?.pathname ?? "/auth/callback";
    const callbackPathNormalized = normalizePath(callbackPath);
    const listenPort = requestedRedirect?.port
      ? Number(requestedRedirect.port)
      : 0;
    const listenHost = requestedRedirect?.hostname ?? "127.0.0.1";

    let resolveCredentials!: (value: OAuthCredentials) => void;
    let rejectCredentials!: (reason: Error) => void;

    const credentials = new Promise<OAuthCredentials>((resolve, reject) => {
      resolveCredentials = resolve;
      rejectCredentials = reject;
    });

    let settled = false;
    const settleResolve = (value: OAuthCredentials) => {
      if (settled) return;
      settled = true;
      resolveCredentials(value);
    };
    const settleReject = (reason: Error) => {
      if (settled) return;
      settled = true;
      rejectCredentials(reason);
    };

    const timeoutId = setTimeout(() => {
      settleReject(
        new Error(
          `Samsung login was not completed within ${CALLBACK_TIMEOUT_MS / 60000} minutes`
        )
      );
    }, CALLBACK_TIMEOUT_MS);

    credentials.catch(() => {}).finally(() => clearTimeout(timeoutId));

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || "/", `http://${listenHost}`);

      if (
        (req.method !== "GET" && req.method !== "POST") ||
        normalizePath(reqUrl.pathname) !== callbackPathNormalized
      ) {
        res.writeHead(404);
        res.end();
        return;
      }

      const finalizeWithParams = (params: URLSearchParams) => {
        try {
          const errorParam = params.get("error");
          if (errorParam) {
            const desc = params.get("error_description") || errorParam;
            throw new Error(`Samsung returned an error: ${desc}`);
          }

          if (params.get("state") !== state) {
            throw new Error(
              "OAuth state mismatch — refusing callback (possible CSRF)"
            );
          }

          const code = params.get("code");
          if (!code) {
            throw new Error("Missing `code` in Samsung callback");
          }

          const tokenData = JSON.parse(code) as {
            access_token?: string;
            userId?: string;
            inputEmailID?: string;
            inputEmailId?: string;
            email?: string;
          };
          const { access_token: accessToken, userId } = tokenData;

          if (!accessToken || !userId) {
            throw new Error(
              "Missing access_token or userId in Samsung response"
            );
          }

          const email =
            tokenData.inputEmailID || tokenData.inputEmailId || tokenData.email;

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(SUCCESS_HTML);
          settleResolve({ accessToken, userId, email });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("Samsung OAuth callback failed", err);
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end(`Authentication failed: ${message}`);
          settleReject(err instanceof Error ? err : new Error(message));
        }
      };

      if (req.method === "GET") {
        finalizeWithParams(reqUrl.searchParams);
        return;
      }

      // Some Samsung flows POST form-urlencoded fields to redirect_uri.
      const bodyChunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => bodyChunks.push(chunk));
      req.on("end", () => {
        const rawBody = Buffer.concat(bodyChunks).toString("utf-8");
        finalizeWithParams(new URLSearchParams(rawBody));
      });
      req.on("error", (err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Samsung OAuth callback body read failed", err);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end(`Authentication failed: ${message}`);
        settleReject(err instanceof Error ? err : new Error(message));
      });
    });

    server.on("error", (err) => {
      rejectSession(err);
      settleReject(err);
    });

    server.listen(listenPort, listenHost, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        const err = new Error("Failed to determine OAuth callback port");
        rejectSession(err);
        rejectCredentials(err);
        return;
      }

      const redirectUri = requestedRedirect
        ? `${requestedRedirect.protocol}//${requestedRedirect.hostname}:${addr.port}${callbackPath}`
        : `http://127.0.0.1:${addr.port}${callbackPath}`;

      logger.info(
        `OAuth callback server listening on ${listenHost}:${addr.port}${callbackPath}`
      );
      resolveSession({
        port: addr.port,
        redirectUri,
        state,
        credentials,
        close: (reason?: string) => {
          clearTimeout(timeoutId);
          server.close();
          settleReject(new Error(reason || "Samsung login cancelled"));
        },
      });
    });
  });
}

function normalizePath(input: string): string {
  if (!input || input === "/") return "/";
  return input.replace(/\/+$/, "") || "/";
}

function parseRedirectUri(redirectUri?: string): URL | null {
  if (!redirectUri) return null;

  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error(`Invalid redirect URI in Samsung config: ${redirectUri}`);
  }

  if (parsed.protocol !== "http:") {
    throw new Error(`Unsupported redirect URI protocol: ${parsed.protocol}`);
  }

  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error(`Unsupported redirect URI host: ${parsed.hostname}`);
  }

  if (!parsed.port) {
    throw new Error("Samsung redirect URI is missing a TCP port");
  }

  return parsed;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>CTV Bridge</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fafafa">
  <div style="text-align:center">
    <h1>Login successful</h1>
    <p>You can close this window and return to CTV Bridge.</p>
  </div>
</body>
</html>`;
