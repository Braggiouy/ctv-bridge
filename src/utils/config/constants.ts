/**
 * Application Configuration
 * Centralized configuration file for all constants and config values
 */

// ============================================================================
// UI Configuration
// ============================================================================

export const UI_CONFIG = {
  /** Toast notification duration in milliseconds */
  TOAST_DURATION: 2000,
} as const;

// ============================================================================
// WebOS Configuration
// ============================================================================

export const WEBOS_CONFIG = {
  /** Default SSH port for webOS devices */
  DEFAULT_PORT: "9922",

  /** Default SSH username for webOS devices */
  DEFAULT_USERNAME: "prisoner",

  /** Package file extension */
  PACKAGE_EXTENSION: "ipk",

  /** CLI command for device setup */
  CLI_SETUP_COMMAND: "ares-setup-device",

  /** CLI command for building packages */
  CLI_BUILD_COMMAND: "ares-package",

  /** CLI command for installing packages */
  CLI_INSTALL_COMMAND: "ares-install",

  /** CLI command for launching apps */
  CLI_LAUNCH_COMMAND: "ares-launch",

  /** CLI command for debugging */
  CLI_DEBUG_COMMAND: "ares-inspect",

  /** Build tip message */
  BUILD_TIP:
    "Ensure your project directory contains the necessary meta files (e.g., appinfo.json, services.json) to avoid build errors.",
} as const;

// ============================================================================
// Tizen Configuration
// ============================================================================

export const TIZEN_CONFIG = {
  /** Default SDB port for Tizen devices */
  DEFAULT_PORT: "26101",

  /** Package file extension */
  PACKAGE_EXTENSION: "wgt",

  /** CLI command for device connection */
  CLI_CONNECT_COMMAND: "sdb connect",

  /** CLI command for device disconnection */
  CLI_DISCONNECT_COMMAND: "sdb disconnect",

  /** CLI command for listing devices */
  CLI_LIST_COMMAND: "sdb devices",

  /** CLI command for building packages */
  CLI_BUILD_COMMAND: "tizen package",

  /** CLI command for installing packages */
  CLI_INSTALL_COMMAND: "tizen install",

  /** CLI command for running apps */
  CLI_RUN_COMMAND: "tizen run",

  /** CLI command for debugging */
  CLI_DEBUG_COMMAND: "sdb shell 0 debug",

  /** Build tip message */
  BUILD_TIP:
    "Ensure your project directory contains the necessary meta files (e.g., config.xml, icon.png) to avoid build errors.",
} as const;

// ============================================================================
// Device Configuration
// ============================================================================

export const DEVICE_CONFIG = {
  /** Emulator/localhost IP address */
  EMULATOR_IP: "127.0.0.1",

  /** Device name validation regex */
  NAME_REGEX: /^[a-zA-Z0-9_-]+$/,

  /** IP address validation regex */
  IP_REGEX: /^(\d{1,3}\.){3}\d{1,3}$/,
} as const;

// ============================================================================
// LocalStorage Keys
// ============================================================================

export const STORAGE_KEYS = {
  /** Selected platform (tizen or webos) */
  PLATFORM: "platform",

  /** TV IP address */
  TV_IP: "tvIp",

  /** WebOS device name */
  DEVICE_NAME: "deviceName",

  /** WebOS device passphrases (JSON object) */
  WEBOS_PASSPHRASES: "webos-passphrases",

  /** Tizen device names (JSON object) */
  TIZEN_DEVICE_NAMES: "tizen-device-names",

  /** Saved build paths (per platform) */
  SAVED_BUILD_PATHS: (platform: string) => `${platform}_savedBuildPaths`,

  /** Project path (per platform) */
  PROJECT_PATH: (platform: string) => `${platform}_projectPath`,
} as const;

// ============================================================================
// Platform Types
// ============================================================================
// Android Configuration
// ============================================================================

export const ANDROID_CONFIG = {
  /** Default ADB port for Android devices (usually 5555 for TCP/IP) */
  DEFAULT_PORT: "5555",

  /** Package file extension */
  PACKAGE_EXTENSION: "apk",

  /** CLI command for device connection */
  CLI_CONNECT_COMMAND: "adb connect",

  /** CLI command for device disconnection */
  CLI_DISCONNECT_COMMAND: "adb disconnect",

  /** CLI command for listing devices */
  CLI_LIST_COMMAND: "adb devices",

  /** CLI command for installing packages */
  CLI_INSTALL_COMMAND: "adb install",

  /** Build tip message */
  BUILD_TIP:
    "Ensure your APK is signed and debuggable if necessary for your testing device.",
} as const;

// ============================================================================

export const PLATFORMS = {
  TIZEN: "tizen",
  WEBOS: "webos",
  ANDROID: "android",
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULTS = {
  /** Default platform */
  PLATFORM: PLATFORMS.TIZEN,

  /** Default webOS device configuration */
  WEBOS_DEVICE: {
    name: "",
    ip: "",
    port: WEBOS_CONFIG.DEFAULT_PORT,
    username: WEBOS_CONFIG.DEFAULT_USERNAME,
    passphrase: "",
  },

  /** Default Tizen device configuration */
  TIZEN_DEVICE: {
    name: "",
    ip: "",
  },
} as const;
