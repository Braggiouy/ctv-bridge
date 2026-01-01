/// <reference types="vite/client" />

interface Device {
  name: string;
  ip?: string;
  host?: string;
  port?: string;
  username?: string;
}

interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  checkTizenSdk: () => Promise<{ success: boolean; message: string }>;
  checkWebOsSdk: () => Promise<{ success: boolean; message: string }>;
  testConnection: (
    platform: string,
    identifier: string,
    passphrase?: string
  ) => Promise<{ success: boolean; message: string }>;
  buildPackage: (
    platform: string,
    projectPath: string
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
  listDevices: () => Promise<{
    success: boolean;
    devices: Device[];
    message?: string;
  }>;
  addDevice: (device: Device) => Promise<{ success: boolean; message: string }>;
  removeDevice: (
    name: string
  ) => Promise<{ success: boolean; message: string }>;

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
}

interface Window {
  electron: ElectronAPI;
}
