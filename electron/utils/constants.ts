export const TIZEN_CONSTANTS = {
  DEFAULT_PORT: 26101,
  CONFIG_FILE: "config.xml",
  PACKAGE_EXTENSION: ".wgt",
  APP_ID_PATTERN: /<tizen:application[^>]*id="([^"]+)"/,
} as const;

export const WEBOS_CONSTANTS = {
  DEFAULT_PORT: "9922",
  DEFAULT_USERNAME: "prisoner",
  CONFIG_FILE: "appinfo.json",
  PACKAGE_EXTENSION: ".ipk",
} as const;

export const ANDROID_CONSTANTS = {
  DEFAULT_PORT: 5555,
  PACKAGE_EXTENSION: ".apk",
} as const;

export const BUILD_CONSTANTS = {
  // Top-level project entries left out of the Tizen package.
  EXCLUDE_PATTERNS: [
    ".project",
    ".settings",
    ".sign",
    ".tproject",
    ".buildResult",
    ".wgt",
    ".ipk",
    ".manifest.tmp",
    "author-signature.xml",
    "signature1.xml",
  ],
  TEMP_DIR_PREFIX: "ctv-bridge-build-",
} as const;

export const DEPLOY_CONSTANTS = {
  DEBUG_PORT_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 30000,
  UPDATE_CHECK_DELAY_MS: 3000,
} as const;

export const WINDOW_CONSTANTS = {
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 800,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
} as const;
