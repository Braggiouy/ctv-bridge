/**
 * Parsers for vendor CLI output. Kept free of Electron imports so they can be
 * unit tested; these are what break when Samsung, LG or Google change a tool.
 */
import type { TizenProfile } from "../../shared/ipc";

/** Parses `sdb devices` / `adb devices` output into attached serials. */
export function parseAttachedSerials(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === "device")
    .map(([serial]) => serial);
}

// ── Tizen ────────────────────────────────────────────────────────────────────

const TIZEN_APP_ID = /<tizen:application[^>]*id="([^"]+)"/;

/** The app ID from a Tizen config.xml; throws a user-facing error when unusable. */
export function parseTizenAppId(configXml: string): string {
  const appId = configXml.match(TIZEN_APP_ID)?.[1];
  if (!appId) {
    throw new Error("Could not find <tizen:application id> in config.xml");
  }
  if (/^https?:\/\//.test(appId)) {
    throw new Error(
      `Invalid Tizen app ID "${appId}": <tizen:application id> must be an app ID, not a URL.`
    );
  }
  return appId;
}

/** The output of `sdb shell 0 getduid`, if it looks like a DUID. */
export function parseDuid(stdout: string): string | undefined {
  const duid = stdout.trim();
  return /^[A-Z0-9]{10,}$/i.test(duid) ? duid : undefined;
}

/** The inspector port from `sdb shell 0 debug` output, e.g. "port: 7011". */
export function findDebugPort(output: string): string | undefined {
  return output.match(
    /(?:\b(?:port|debug)\b\s*[:=]?\s*|localhost:|127\.0\.0\.1:)(\d{4,5})\b/i
  )?.[1];
}

/** Where `tizen security-profiles list` says it loaded profiles.xml from. */
export function findProfilesXmlPath(stdout: string): string | undefined {
  return stdout.match(/Loaded in '([^']+)'\./i)?.[1];
}

export function parseProfilesXml(xml: string): TizenProfile[] {
  const activeName =
    xml.match(/<profiles[^>]*\sactive="([^"]*)"/i)?.[1]?.trim() ?? "";
  return [...xml.matchAll(/<profile\s+name="([^"]+)"/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .map((name) => ({ name, active: name === activeName }));
}

export function parseProfilesTable(stdout: string): TizenProfile[] {
  const isNoise = (line: string) =>
    !line ||
    line.includes("------") ||
    /^(security-profiles\s+list|loaded\b|available\s*:?$|\[profile\s+name\]|name\s+active)/i.test(
      line
    );

  const lines = stdout.split(/\r?\n/).map((line) => line.trim());
  const headerIndex = lines.findIndex(
    (line) => line.includes("Name") && line.includes("Active")
  );
  const rows = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;

  return rows
    .filter((line) => !isNoise(line))
    .map((line) => {
      // "name   O", or "nameO" when some CLI versions glue the marker to long names
      const match = line.match(/^(.*\S)\s*([OX])$/i);
      return match
        ? { name: match[1].trim(), active: match[2].toUpperCase() === "O" }
        : { name: line, active: false };
    })
    .filter(({ name }) => name && !name.endsWith(":"));
}

// ── webOS ────────────────────────────────────────────────────────────────────

const INSPECTOR_URL =
  /((?:https?|ws):\/\/(?:localhost|127\.0\.0\.1):\d+(?:\/[^\s"'<>]*)?|chrome-devtools:\/\/[^\s"'<>]+)/;

/** The inspector URL printed by `ares-inspect`. */
export function findInspectorUrl(output: string): string | undefined {
  return output.match(INSPECTOR_URL)?.[1];
}

/** ares-inspect lines worth showing: not deprecation noise and not the URL itself. */
export function isInspectLogLine(line: string): boolean {
  return (
    !!line &&
    !INSPECTOR_URL.test(line) &&
    !/deprecat|^ares-inspect\s+warn\b|session#forward\(\) failed forwarding client localPort:\s*0/i.test(
      line
    )
  );
}

// ── Android ──────────────────────────────────────────────────────────────────

/** Package name and launch activity from `aapt dump badging`. */
export function parseBadging(stdout: string): {
  packageName?: string;
  activity?: string;
} {
  return {
    packageName: stdout.match(/package:\s+name='([^']+)'/)?.[1],
    activity: stdout.match(/launchable-activity:\s+name='([^']+)'/)?.[1],
  };
}
