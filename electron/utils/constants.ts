export const TIZEN_CONSTANTS = {
  DEFAULT_PORT: 26101,
  CONFIG_FILE: "config.xml",
  PACKAGE_EXTENSION: ".wgt",
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
    // Created next to the .wgt by `tizen install` while it runs.
    "_tempDecompress",
  ],
  TEMP_DIR_PREFIX: "ctv-bridge-build-",
} as const;

export const DEPLOY_CONSTANTS = {
  DEBUG_PORT_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 30000,
  /** For quick TV commands, e.g. reading its DUID. */
  RESPONSE_TIMEOUT_MS: 15000,
  INSTALL_TIMEOUT_MS: 5 * 60_000,
} as const;

export const WINDOW_CONSTANTS = {
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 800,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
} as const;
