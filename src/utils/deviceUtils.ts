/**
 * Device and Platform Utilities
 * Helper functions for device validation and platform-specific operations
 */

import {
  DEVICE_CONFIG,
  PLATFORMS,
  WEBOS_CONFIG,
  TIZEN_CONFIG,
  type Platform,
} from "./config/constants";

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
 */
export const isValidDeviceName = (name: string): boolean => {
  return DEVICE_CONFIG.NAME_REGEX.test(name);
};

/**
 * Validate IP address format
 */
export const isValidIP = (ip: string): boolean => {
  return DEVICE_CONFIG.IP_REGEX.test(ip);
};

// ============================================================================
// Platform Utilities
// ============================================================================

/**
 * Get human-readable platform display name
 */
export const getPlatformDisplayName = (platform: Platform): string => {
  return platform === PLATFORMS.TIZEN ? "Samsung" : "LG";
};

/**
 * Get package file extension for platform
 */
export const getPackageExtension = (platform: Platform): string => {
  return platform === PLATFORMS.TIZEN
    ? TIZEN_CONFIG.PACKAGE_EXTENSION
    : WEBOS_CONFIG.PACKAGE_EXTENSION;
};

/**
 * Get CLI command name for platform
 */
export const getPlatformCLI = (platform: Platform): string => {
  return platform === PLATFORMS.TIZEN ? "tizen" : "ares";
};
