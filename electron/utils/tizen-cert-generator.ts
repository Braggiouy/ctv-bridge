/**
 * Samsung author + distributor certificates: OpenSSL keys and CSRs, signed by
 * Samsung's API, exported as PKCS12. No Electron imports, so it can be tested.
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { TizenCertificateParams } from "../../shared/ipc";
import type { TizenCertConfig } from "./tizen-cert-config";
import type { OAuthCredentials } from "./tizen-oauth-server";
import { logger } from "./logger";

/** Runs OpenSSL in the certificate folder; `stdin` feeds `-passout stdin`. */
export type OpensslRunner = (args: string[], stdin?: string) => Promise<void>;

export interface CertificateRequest {
  dir: string;
  email: string;
  deviceIds: string[];
  password: string;
  privilegeLevel: string;
  developerType: string;
  credentials: OAuthCredentials;
  config: TizenCertConfig;
  /** Samsung's CA certificates, appended to each signed certificate. */
  caCerts: { author: string; distributor: string };
  openssl: OpensslRunner;
  log: (line: string) => void;
}

/** Samsung's endpoints have moved; the cached config should be fetched again. */
export class StaleConfigError extends Error {}

const INTERMEDIATE_SUFFIXES = [".csr", ".crt", ".key.pem", "-chain.crt"];

/** Writes author.p12 and distributor.p12 into `request.dir`. */
export async function generateCertificates(request: CertificateRequest) {
  const { dir, openssl, log } = request;
  await fs.mkdir(dir, { recursive: true });

  log("Generating author certificate…");
  await generateAuthorCert(request);

  log("Generating distributor certificate…");
  await generateDistributorCert(request);

  log("Exporting PKCS12 files (author.p12, distributor.p12)…");
  await exportPkcs12(openssl, "author", request.password);
  await exportPkcs12(openssl, "distributor", request.password);

  await cleanupIntermediateFiles(dir);
}

/** ~/SamsungCertificate/<profile name, or the email's local part>. */
export function certificateDir(
  homeDir: string,
  params: Pick<TizenCertificateParams, "email" | "profileName">
): string {
  const emailPrefix = params.email.split("@")[0] || "default";
  const preferredName = params.profileName?.trim() || emailPrefix;
  const folderName = sanitizeFolderSegment(preferredName) || "default";
  return path.join(homeDir, "SamsungCertificate", folderName);
}

function sanitizeFolderSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildAuthUrl(
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

/** The redirect URI Samsung has registered, taken from its login URL. */
export function getRegisteredRedirectUri(loginUrl: string): string | undefined {
  try {
    const redirectUri = new URL(loginUrl).searchParams.get("redirect_uri");
    return redirectUri?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** PEM, or DER (which starts with an ASN.1 SEQUENCE byte). */
export function isValidCertificate(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const head = buf.toString("utf-8", 0, Math.min(200, buf.length));
  if (head.includes("-----BEGIN CERTIFICATE-----")) return true;
  return buf[0] === 0x30;
}

async function generateAuthorCert(request: CertificateRequest) {
  const { dir, openssl } = request;
  await openssl(["genrsa", "-out", "author.key.pem", "2048"]);
  await openssl([
    "req",
    "-new",
    "-key",
    "author.key.pem",
    "-out",
    "author.csr",
    "-subj",
    `/CN=${request.email}`,
  ]);

  await submitCsr(
    request,
    "author.csr",
    "author.crt",
    request.config.authorUrl
  );
  await combineCerts(
    path.join(dir, "author.crt"),
    request.caCerts.author,
    path.join(dir, "author-chain.crt")
  );
}

async function generateDistributorCert(request: CertificateRequest) {
  const { dir, openssl } = request;
  const deviceURIs = request.deviceIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `URI:URN:tizen:deviceid=${id}`);

  await openssl(["genrsa", "-out", "distributor.key.pem", "2048"]);
  const reqArgs = [
    "req",
    "-new",
    "-key",
    "distributor.key.pem",
    "-out",
    "distributor.csr",
    "-subj",
    `/CN=TizenSDK/emailAddress=${request.email}`,
  ];
  if (deviceURIs.length > 0) {
    reqArgs.push("-addext", `subjectAltName=${deviceURIs.join(",")}`);
  }
  await openssl(reqArgs);

  await submitCsr(
    request,
    "distributor.csr",
    "distributor.crt",
    request.config.distributorUrl,
    {
      privilege_level: request.privilegeLevel,
      developer_type: request.developerType,
    }
  );
  await combineCerts(
    path.join(dir, "distributor.crt"),
    request.caCerts.distributor,
    path.join(dir, "distributor-chain.crt")
  );
}

async function exportPkcs12(
  openssl: OpensslRunner,
  type: "author" | "distributor",
  password: string
) {
  const args = [
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
  try {
    // OpenSSL 3 needs -legacy for the encryption Tizen's signer can read.
    await openssl([...args, "-legacy"], `${password}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/unknown option\s+'?-legacy'?/i.test(message)) throw error;
    await openssl(args, `${password}\n`);
  }
}

async function submitCsr(
  { dir, credentials }: CertificateRequest,
  csrFile: string,
  crtFile: string,
  apiUrl: string,
  extraFields?: Record<string, string>
) {
  const csrContent = await fs.readFile(path.join(dir, csrFile));
  const form = new FormData();
  form.append("access_token", credentials.accessToken);
  form.append("user_id", credentials.userId);
  form.append("platform", "VD");
  for (const [key, value] of Object.entries(extraFields ?? {})) {
    form.append(key, value);
  }
  form.append("csr", new Blob([csrContent]), csrFile);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
    body: form,
  });

  if (res.status === 404 || res.status === 410) {
    throw new StaleConfigError(
      `Samsung endpoint returned ${res.status}. Config cache cleared — please retry.`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Samsung API ${res.status} for ${csrFile}: ${body}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (!isValidCertificate(buf)) {
    const preview = buf
      .toString("utf-8", 0, Math.min(200, buf.length))
      .replace(/\s+/g, " ")
      .trim();
    throw new StaleConfigError(
      `Samsung returned a non-certificate response: ${preview}. Cache cleared — please retry.`
    );
  }

  await fs.writeFile(path.join(dir, crtFile), buf);
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
