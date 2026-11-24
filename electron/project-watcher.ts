import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BUILD_CONSTANTS } from "./utils/constants";

/** Waits this long after the last change, so a bundler's burst of writes triggers one redeploy. */
const QUIET_PERIOD_MS = 1000;

/**
 * Hidden folders (.git, .sign, …), dependencies, and the packages and
 * signatures our own builds write into the project, which would otherwise
 * trigger a redeploy after every build.
 */
export function isIgnored(relativePath: string): boolean {
  return relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .some(
      (segment) =>
        segment.startsWith(".") ||
        segment === "node_modules" ||
        BUILD_CONSTANTS.EXCLUDE_PATTERNS.some((pattern) =>
          segment.endsWith(pattern)
        )
    );
}

/** Undefined for folders and missing files. */
function hashFile(file: string): string | undefined {
  try {
    return createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return undefined;
  }
}

function hashTree(root: string, dir = "", into = new Map<string, string>()) {
  for (const entry of fs.readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const relative = path.join(dir, entry.name);
    if (isIgnored(relative)) continue;
    if (entry.isDirectory()) hashTree(root, relative, into);
    else if (entry.isFile()) {
      const hash = hashFile(path.join(root, relative));
      if (hash) into.set(relative, hash);
    }
  }
  return into;
}

/**
 * Watches a project folder (or a single file, e.g. an APK) and reports the
 * files whose content changed, once changes settle. Returns a function that
 * stops watching.
 */
export function watchProject(
  target: string,
  onChange: (changed: string[]) => void,
  quietPeriodMs = QUIET_PERIOD_MS
): () => void {
  // A rebuilt file is often replaced rather than rewritten, which ends a
  // watch on the file itself, so watch its folder for that name instead.
  const file = fs.statSync(target).isFile() ? path.basename(target) : null;
  const root = file ? path.dirname(target) : target;
  // Content, not timestamps: ares-package rewrites appinfo.json unchanged on
  // every build, and folders are reported whenever a file in them changes.
  const hashes = file
    ? new Map([[file, hashFile(target) ?? ""]])
    : hashTree(root);
  const changed = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const watcher = fs.watch(root, { recursive: !file }, (_event, filename) => {
    const relative = path.normalize(String(filename ?? ""));
    if (file ? relative !== file : relative === "." || isIgnored(relative)) {
      return;
    }
    const hash = hashFile(path.join(root, relative));
    if (hash === hashes.get(relative)) return;
    if (hash) hashes.set(relative, hash);
    else hashes.delete(relative);

    changed.add(relative);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const files = [...changed];
      changed.clear();
      onChange(files);
    }, quietPeriodMs);
  });

  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}
