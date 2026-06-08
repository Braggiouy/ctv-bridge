/**
 * Fetches Samsung's Tizen certificate configuration by downloading
 * the official SDK extension, extracting CA certs and parsing Java
 * class files for API endpoints.
 *
 * Results are cached in the store for 7 days.
 */

import AdmZip from "adm-zip";
import * as fs from "node:fs";
import * as path from "node:path";
import { app } from "electron";
import { store } from "../store";
import { logger } from "./logger";
import { getErrorMessage } from "./errors";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TizenCertConfig {
  serviceId: string;
  loginUrl: string;
  distributorUrl: string;
  authorUrl: string;
  timestamp: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = "tizen-cert-config";
const CACHE_EXPIRY_DAYS = 7;
const EXTENSION_XML_URL =
  "https://download.tizen.org/sdk/tizenstudio/official/extension_info.xml";
const FALLBACK_ZIP_URL =
  "https://download.tizen.org/sdk/extensions/tizen-certificate-extension_2.0.74.zip";

const CONFIG_KEYS = [
  "SERVICE_ID",
  "loginUrl",
  "DISTRIBUTOR_URL",
  "AUTHOR_URL",
] as const;

/** CA chain files extracted from the Samsung extension JAR. */
export const CA_CERT_FILES = {
  author: "vd_tizen_dev_author_ca.cer",
  distributor: "vd_tizen_dev_public2.crt",
} as const;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the Tizen certificate config, using a 7-day cache.
 * On first call (or after cache expiry), downloads the Samsung extension
 * ZIP, extracts CA certificates to disk, and parses Java class constants
 * to discover the OAuth endpoints.
 */
export async function getTizenCertConfig(
  forceRefresh = false
): Promise<TizenCertConfig> {
  if (!forceRefresh) {
    const cached = store.getExtra<TizenCertConfig>(CACHE_KEY);
    if (cached?.timestamp) {
      const age =
        (Date.now() - new Date(cached.timestamp).getTime()) /
        (1000 * 60 * 60 * 24);
      if (age < CACHE_EXPIRY_DAYS) {
        logger.info("Using cached Tizen certificate configuration");
        return cached;
      }
    }
  }

  logger.info("Fetching fresh Tizen certificate configuration…");
  const config = await fetchAndParseConfig();
  store.setExtra(CACHE_KEY, config);
  return config;
}

/**
 * Returns the directory where CA certificates are stored.
 */
export function getCaCertDir(): string {
  return path.join(app.getPath("userData"), "certificates", "ca");
}

export function getCaCertPath(type: keyof typeof CA_CERT_FILES): string {
  return path.join(getCaCertDir(), CA_CERT_FILES[type]);
}

export function evictTizenCertConfigCache(): void {
  store.setExtra(CACHE_KEY, undefined);
  logger.info("Tizen certificate configuration cache evicted");
}

// ── Internals ────────────────────────────────────────────────────────────────

async function fetchAndParseConfig(): Promise<TizenCertConfig> {
  const zipUrl = await resolveExtensionZipUrl();

  logger.info(`Downloading extension from ${zipUrl}`);
  const zipResponse = await fetch(zipUrl);
  if (!zipResponse.ok) {
    throw new Error(`Failed to download extension: ${zipResponse.status}`);
  }

  const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
  return extractConfigFromZip(zipBuffer);
}

/** Fetches the extension_info.xml and finds the Samsung Certificate Extension URL. */
async function resolveExtensionZipUrl(): Promise<string> {
  try {
    const res = await fetch(EXTENSION_XML_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    // More resilient regex that ignores attribute order and whitespace
    const match = xml.match(
      /<extension\s+[^>]*name\s*=\s*"Samsung Certificate Extension"\s+[^>]*repository\s*=\s*"([^"]+)"/i
    );

    if (match?.[1]) return match[1].trim();
  } catch (err) {
    logger.warn("Failed to fetch extension_info.xml, using fallback URL", err);
  }
  return FALLBACK_ZIP_URL;
}

/** Walks the nested ZIPs (extension → platform zip → JAR) and extracts config + CA files. */
function extractConfigFromZip(zipBuffer: Buffer): TizenCertConfig {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (err) {
    throw new Error(
      `Failed to parse Samsung extension ZIP: ${getErrorMessage(err)}`
    );
  }

  const variables: Record<string, string> = {};
  const caDir = getCaCertDir();
  fs.mkdirSync(caDir, { recursive: true });

  for (const entry of zip.getEntries()) {
    if (
      !entry.entryName.includes("cert-add-on") ||
      !entry.entryName.endsWith(".zip")
    ) {
      continue;
    }

    let innerZip: AdmZip;
    try {
      innerZip = new AdmZip(entry.getData());
    } catch (err) {
      logger.warn(`Failed to parse inner platform ZIP ${entry.entryName}`, err);
      continue;
    }

    for (const innerEntry of innerZip.getEntries()) {
      if (
        !innerEntry.entryName.includes("org.tizen.common.cert") ||
        !innerEntry.entryName.endsWith(".jar")
      ) {
        continue;
      }

      let jarZip: AdmZip;
      try {
        jarZip = new AdmZip(innerEntry.getData());
      } catch (err) {
        logger.warn(
          `Failed to parse certificate JAR ${innerEntry.entryName}`,
          err
        );
        continue;
      }

      for (const jarEntry of jarZip.getEntries()) {
        const name = jarEntry.entryName;

        // Extract CA certificates
        if (name.endsWith(".cer") || name.endsWith(".crt")) {
          const fileName = path.basename(name);
          fs.writeFileSync(path.join(caDir, fileName), jarEntry.getData());
          logger.info(`Extracted CA certificate: ${fileName}`);
        }

        // Parse Java class constants for API config
        if (
          name.endsWith("SigninDialog.class") ||
          name.endsWith("CertConstant.class")
        ) {
          try {
            const constants = parseJavaClassConstants(jarEntry.getData());
            mapConfigConstants(constants, variables);
          } catch (err) {
            logger.error(`Failed to parse Java class ${name}`, err);
          }
        }
      }
    }
  }

  for (const key of CONFIG_KEYS) {
    if (!variables[key]) {
      throw new Error(
        `Failed to extract '${key}' from Samsung extension. The SDK extension format may have changed or the download was incomplete.`
      );
    }
  }

  if (
    !variables.loginUrl.startsWith("https://") ||
    !variables.AUTHOR_URL.startsWith("https://") ||
    !variables.DISTRIBUTOR_URL.startsWith("https://")
  ) {
    throw new Error(
      "Parsed Samsung config has invalid URLs — the extension format may have changed."
    );
  }

  for (const file of Object.values(CA_CERT_FILES)) {
    if (!fs.existsSync(path.join(caDir, file))) {
      throw new Error(
        `Expected CA certificate '${file}' was not extracted from the Samsung extension.`
      );
    }
  }

  return {
    serviceId: variables.SERVICE_ID,
    loginUrl: variables.loginUrl,
    distributorUrl: variables.DISTRIBUTOR_URL,
    authorUrl: variables.AUTHOR_URL,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Iterates over extracted Java constants and maps them to config.
 * The Java class files store field names and values as adjacent
 * string constants in the constant pool, so if constants[i] is
 * "SERVICE_ID", then constants[i+1] is its value.
 */
function mapConfigConstants(
  constants: string[],
  variables: Record<string, string>
) {
  for (let i = 0; i < constants.length - 1; i++) {
    if (CONFIG_KEYS.includes(constants[i] as (typeof CONFIG_KEYS)[number])) {
      variables[constants[i]] = constants[i + 1];
    }
  }
}

// ── Java Class File Parser ───────────────────────────────────────────────────

/**
 * Parses a Java .class file's constant pool and returns all
 * UTF-8 string constants. Uses the JVM spec's constant pool format.
 *
 * We only extract tag=1 (Utf8) entries because the Python reference
 * implementation does the same — other tag types (Class, Method, etc.)
 * are structural and don't contain the config values we need.
 */
function parseJavaClassConstants(buffer: Buffer): string[] {
  const strings: string[] = [];
  let offset = 8; // Skip magic (4) + version (4)

  const poolCount = buffer.readUInt16BE(offset) - 1;
  offset += 2;

  let i = 0;
  while (i < poolCount) {
    const tag = buffer.readUInt8(offset);
    offset += 1;

    switch (tag) {
      case 1: {
        // CONSTANT_Utf8
        const len = buffer.readUInt16BE(offset);
        offset += 2;
        strings.push(buffer.toString("utf-8", offset, offset + len));
        offset += len;
        break;
      }
      case 3: // Integer
      case 4: // Float
        offset += 4;
        break;
      case 5: // Long
      case 6: // Double — occupies two pool slots
        offset += 8;
        i++;
        break;
      case 7: // Class
      case 8: // String
      case 16: // MethodType
      case 19: // Module
      case 20: // Package
        offset += 2;
        break;
      case 17: // Dynamic
      case 9: // Fieldref
      case 10: // Methodref
      case 11: // InterfaceMethodref
      case 12: // NameAndType
      case 18: // InvokeDynamic
        offset += 4;
        break;
      case 15: // MethodHandle
        offset += 3;
        break;
      default:
        throw new Error(
          `Unknown JVM constant pool tag ${tag} — Samsung class file format may have changed.`
        );
    }
    i++;
  }

  return strings;
}
