/**
 * Device and Platform Utilities
 * Helper functions for device validation and platform-specific operations
 */

import {
  DEVICE_CONFIG,
  PLATFORMS,
  WEBOS_CONFIG,
  TIZEN_CONFIG,
  ANDROID_CONFIG,
  type Platform,
} from "./config/constants";

// ============================================================================
// Platform Utilities
// ============================================================================

/**
 * Checks if the current operating system is Windows
 */
export const isWindows = (): boolean => {
  return window.navigator.platform.toLowerCase().includes("win");
};

/**
 * Get human-readable platform display name
 */
export const getPlatformDisplayName = (platform: Platform): string => {
  return platform === PLATFORMS.TIZEN
    ? "Samsung"
    : platform === PLATFORMS.WEBOS
      ? "LG"
      : "Android TV";
};

/**
 * Get package file extension for platform
 */
export const getPackageExtension = (platform: Platform): string => {
  return platform === PLATFORMS.TIZEN
    ? TIZEN_CONFIG.PACKAGE_EXTENSION
    : platform === PLATFORMS.WEBOS
      ? WEBOS_CONFIG.PACKAGE_EXTENSION
      : ANDROID_CONFIG.PACKAGE_EXTENSION;
};

/**
 * Get CLI command name for platform
 */
export const getPlatformCLI = (platform: Platform): string => {
  return platform === PLATFORMS.TIZEN
    ? "tizen"
    : platform === PLATFORMS.WEBOS
      ? "ares"
      : "adb";
};

// ============================================================================
// Device Validation
// ============================================================================

/**
 * Check if an IP address is the emulator/localhost
 */
export const isEmulatorIP = (ip: string): boolean => {
  return ip === DEVICE_CONFIG.EMULATOR_IP;
};

/**
 * Validate device name format
 * Only letters, numbers, dashes, and underscores allowed
 */
export const isValidDeviceName = (name: string): boolean => {
  if (!name) return false;
  return DEVICE_CONFIG.NAME_REGEX.test(name);
};

/**
 * Validate IP address format and range
 */
export const isValidIP = (ip: string): boolean => {
  if (!ip) return false;
  if (!DEVICE_CONFIG.IP_REGEX.test(ip)) return false;

  // Validate each octet is 0-255
  const octets = ip.split(".");
  return octets.every((octet) => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
};

/**
 * Validate port number
 */
export const isValidPort = (port: string | number): boolean => {
  const portNum = typeof port === "string" ? parseInt(port, 10) : port;
  return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
};

/**
 * Validate device form data
 */
export interface DeviceValidationErrors {
  name?: string;
  ip?: string;
  port?: string;
  username?: string;
}

export function validateDeviceForm(
  data: {
    name?: string;
    ip?: string;
    port?: string;
    username?: string;
  },
  platform: Platform
): DeviceValidationErrors {
  const errors: DeviceValidationErrors = {};

  // Name validation (required for webOS)
  if (platform === PLATFORMS.WEBOS) {
    if (!data.name) {
      errors.name = "Device name is required";
    } else if (!isValidDeviceName(data.name)) {
      errors.name = "Only letters, numbers, dashes, and underscores allowed";
    }
  }

  // IP validation (required for both)
  if (!data.ip) {
    errors.ip = "IP address is required";
  } else if (!isValidIP(data.ip)) {
    errors.ip = "Invalid IP address format";
  }

  // Port validation (webOS only)
  if (platform === PLATFORMS.WEBOS && data.port) {
    if (!isValidPort(data.port)) {
      errors.port = "Port must be between 1 and 65535";
    }
  }

  return errors;
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Checks if a path string is valid (not empty)
 */
export const isValidPath = (path: string): boolean => {
  return path.trim().length > 0;
};

/**
 * Validate SDK paths for various platforms
 */
export function validateSdkPaths(
  platform: Platform,
  paths: {
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
    adbPath?: string;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (platform === PLATFORMS.TIZEN) {
    if (!isValidPath(paths.sdbPath || "")) {
      errors.push("SDB path is required");
    }
    if (!isValidPath(paths.tizenPath || "")) {
      errors.push("Tizen CLI path is required");
    }
  } else if (platform === PLATFORMS.WEBOS) {
    if (!isValidPath(paths.aresPath || "")) {
      errors.push("webOS CLI path is required");
    }
  } else if (platform === PLATFORMS.ANDROID) {
    // ADB path is optional if it's already in the system PATH.
    // We treat empty "adbPath" as valid.
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
