/**
 * Type definitions for the Electron preload bridge.
 *
 * This is the single source of truth for the `window.electron` API.
 * When adding a new IPC handler, update this file AND `electron/preload.ts`.
 */

interface Device {
  name: string;
  ip?: string;
  host?: string;
  port?: string;
  username?: string;
}

interface AndroidDeviceStatus {
  ip: string;
  status: string;
}

interface SdkCheckResult {
  available: boolean;
  error?: string;
  sdbVersion?: string;
  aresVersion?: string;
}

interface ElectronAPI {
  // ── Device management (webOS) ─────────────────────────────────────────────
  listDevices: () => Promise<{
    success: boolean;
    devices: Device[];
    message?: string;
  }>;
  addDevice: (device: Device) => Promise<{ success: boolean; message: string }>;
  updateDevice: (
    device: Device
  ) => Promise<{ success: boolean; message?: string }>;
  removeDevice: (
    name: string
  ) => Promise<{ success: boolean; message: string }>;

  // ── Device management (Tizen) ─────────────────────────────────────────────
  listTizenDevices: () => Promise<{
    success: boolean;
    devices: { ip: string; status: string }[];
    message?: string;
  }>;
  addTizenDevice: (
    ip: string
  ) => Promise<{ success: boolean; message: string }>;
  removeTizenDevice: (
    ip: string
  ) => Promise<{ success: boolean; message: string }>;

  // ── Device management (Android) ───────────────────────────────────────────
  listAndroidDevices: () => Promise<{
    success: boolean;
    devices: AndroidDeviceStatus[];
    message?: string;
  }>;
  addAndroidDevice: (
    ip: string
  ) => Promise<{ success: boolean; message: string }>;
  removeAndroidDevice: (
    ip: string
  ) => Promise<{ success: boolean; message: string }>;

  // ── File operations ───────────────────────────────────────────────────────
  selectDirectory: () => Promise<string | null>;

  // ── SDK checks ────────────────────────────────────────────────────────────
  checkTizenSdk: () => Promise<SdkCheckResult>;
  checkWebOsSdk: () => Promise<SdkCheckResult>;

  // ── SDK operations ────────────────────────────────────────────────────────
  testConnection: (
    platform: string,
    identifier: string,
    passphrase?: string
  ) => Promise<{ success: boolean; message: string }>;
  buildPackage: (
    platform: string,
    projectPath: string,
    profileName?: string
  ) => Promise<{
    success: boolean;
    message: string;
    packagePath?: string;
    packageName?: string;
  }>;
  listTizenProfiles: () => Promise<{
    success: boolean;
    profiles: { name: string; active: boolean }[];
    message?: string;
  }>;
  deleteTizenProfile: (name: string) => Promise<{
    success: boolean;
    message?: string;
  }>;
  deployApp: (
    platform: string,
    tvIp: string,
    projectPath: string,
    mode: "debug" | "run"
  ) => Promise<{ success: boolean; message: string }>;
  onDeployLog: (callback: (log: string) => void) => () => void;

  // ── Auto-updater ──────────────────────────────────────────────────────────
  checkForUpdates: () => Promise<{ version: string } | null>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  getAppVersion: () => Promise<string>;
  onUpdateAvailable: (
    callback: (info: { version: string }) => void
  ) => () => void;
  onUpdateDownloaded: (
    callback: (info: { version: string }) => void
  ) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;

  // ── Secure storage ────────────────────────────────────────────────────────
  savePassphrase: (
    deviceName: string,
    passphrase: string
  ) => Promise<{ success: boolean; message?: string }>;
  getPassphrase: (deviceName: string) => Promise<{
    success: boolean;
    passphrase: string | null;
    message?: string;
  }>;
  deletePassphrase: (
    deviceName: string
  ) => Promise<{ success: boolean; message?: string }>;
  getAllDeviceNames: () => Promise<{
    success: boolean;
    deviceNames: string[];
    message?: string;
  }>;
  isSecureStorageAvailable: () => Promise<{
    success: boolean;
    available: boolean;
  }>;

  // ── Generic invoke ────────────────────────────────────────────────────────
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;

  // ── External links ────────────────────────────────────────────────────────
  openExternal: (url: string) => Promise<{ success: boolean }>;

  // ── SDK paths management ──────────────────────────────────────────────────
  saveSdkPaths: (paths: {
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
    adbPath?: string;
  }) => Promise<{ success: boolean }>;
  getSdkPaths: () => Promise<{
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
    adbPath?: string;
  }>;

  // ── Tizen certificate generation ──────────────────────────────────────────
  loginTizenCertificateSession: () => Promise<{
    success: boolean;
    message?: string;
    cancelled?: boolean;
    email?: string;
  }>;
  cancelTizenCertificateLogin: () => Promise<{
    success: boolean;
    message?: string;
  }>;
  logoutTizenCertificateSession: () => Promise<{
    success: boolean;
    message?: string;
  }>;
  generateTizenCertificates: (params: {
    email: string;
    deviceIds?: string[];
    password?: string;
    privilegeLevel?: "Public" | "Partner" | "Platform";
    developerType?: "Individual" | "Corporation";
    profileName?: string;
  }) => Promise<{ success: boolean; path?: string; message?: string }>;
  onTizenCertLog: (callback: (log: string) => void) => () => void;

  showInFolder: (target: string) => Promise<{ success: boolean }>;
}

interface Window {
  electron: ElectronAPI;
}
