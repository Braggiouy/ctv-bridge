interface Device {
  name: string;
  ip: string;
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
  // webOS device management
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

  // Tizen device management
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

  // Android device management
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

  // Other methods
  selectDirectory: () => Promise<string | null>;
  checkTizenSdk: () => Promise<SdkCheckResult>;
  checkWebOsSdk: () => Promise<SdkCheckResult>;
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
  deployApp: (
    platform: string,
    tvIp: string,
    projectPath: string,
    mode: "debug" | "run"
  ) => Promise<{ success: boolean; message: string }>;
  onDeployLog: (callback: (log: string) => void) => () => void;

  // Secure storage
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
  // Generic invoke method for any IPC handler
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  listTizenProfiles: () => Promise<{
    success: boolean;
    profiles: { name: string; active: boolean }[];
    message?: string;
  }>;

  // Auto-updater
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

  openExternal: (url: string) => Promise<{ success: boolean }>;
  // SDK paths management
  saveSdkPaths: (paths: {
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
  }) => Promise<{ success: boolean }>;
  getSdkPaths: () => Promise<{
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
    adbPath?: string;
  }>;
}

interface Window {
  electron: ElectronAPI;
}
