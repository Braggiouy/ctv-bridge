/**
 * Live reload serves the app's own files from the project folder through the
 * debug connection (CDP Fetch), so a reload shows local changes without a
 * reinstall and the app keeps its origin and platform APIs. Free of Electron
 * imports so it can be tested.
 */
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".txt": "text/plain",
};

export const contentType = (file: string) =>
  CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/** Changing these needs a reinstall: they're read when the app is installed. */
const MANIFESTS = ["appinfo.json", "config.xml"];

export const needsReinstall = (changed: string[]) =>
  changed.some((file) => MANIFESTS.includes(file.replace(/\\/g, "/")));

/** The folder the app's page is served from, e.g. "file:///…/com.example.app/". */
export const baseUrlOf = (pageUrl: string) =>
  pageUrl.split(/[?#]/)[0].replace(/[^/]*$/, "");

/** The project file a request under `baseUrl` stands for, or undefined if it's outside the project. */
export function projectFileFor(
  requestUrl: string,
  baseUrl: string,
  projectPath: string
): string | undefined {
  const url = requestUrl.split(/[?#]/)[0];
  if (!url.startsWith(baseUrl)) return undefined;
  let relative: string;
  try {
    relative = decodeURIComponent(url.slice(baseUrl.length)) || "index.html";
  } catch {
    return undefined;
  }
  const file = path.resolve(projectPath, relative);
  const inside = path.relative(projectPath, file);
  return inside && !inside.startsWith("..") && !path.isAbsolute(inside)
    ? file
    : undefined;
}
