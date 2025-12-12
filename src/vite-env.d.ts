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
  checkTizenSdk: () => Promise<any>;
  checkWebOsSdk: () => Promise<any>;
  testConnection: (
    platform: string,
    identifier: string,
    passphrase?: string
  ) => Promise<any>;
  buildPackage: (platform: string, projectPath: string) => Promise<any>;
  deployApp: (
    platform: string,
    tvIp: string,
    projectPath: string,
    mode: "debug" | "run"
  ) => Promise<any>;
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
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  getAppVersion: () => Promise<string>;
  onUpdateAvailable: (callback: (info: any) => void) => () => void;
  onUpdateDownloaded: (callback: (info: any) => void) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;
}

interface Window {
  electron: ElectronAPI;
}
