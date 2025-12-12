/**
 * Path validation utilities for SDK paths
 */

export function isPathValid(path: string): boolean {
  return path.trim().length > 0;
}

export function validateSdkPaths(
  platform: "tizen" | "webos",
  paths: { sdbPath?: string; tizenPath?: string; aresPath?: string }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (platform === "tizen") {
    if (!isPathValid(paths.sdbPath || "")) {
      errors.push("SDB path is required");
    }
    if (!isPathValid(paths.tizenPath || "")) {
      errors.push("Tizen CLI path is required");
    }
  } else if (platform === "webos") {
    if (!isPathValid(paths.aresPath || "")) {
      errors.push("webOS CLI path is required");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
