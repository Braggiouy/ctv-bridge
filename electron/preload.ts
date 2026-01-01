import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  // Device management (webOS)
  listDevices: () => ipcRenderer.invoke("list-devices"),
  addDevice: (device: {
    name: string;
    ip: string;
    port: string;
    username: string;
  }) => ipcRenderer.invoke("add-device", device),
  updateDevice: (device: {
    name: string;
    ip: string;
    port: string;
    username: string;
  }) => ipcRenderer.invoke("update-device", device),
  removeDevice: (name: string) => ipcRenderer.invoke("remove-device", name),

  // Device management (Tizen)
  listTizenDevices: () => ipcRenderer.invoke("list-tizen-devices"),
  addTizenDevice: (ip: string) => ipcRenderer.invoke("add-tizen-device", ip),
  removeTizenDevice: (ip: string) =>
    ipcRenderer.invoke("remove-tizen-device", ip),
  // File operations
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  // SDK check
  checkTizenSdk: () => ipcRenderer.invoke("check-tizen-sdk"),
  checkWebOsSdk: () => ipcRenderer.invoke("check-webos-sdk"),

  // SDK operations
  testConnection: (platform: string, identifier: string, passphrase?: string) =>
    ipcRenderer.invoke("test-connection", platform, identifier, passphrase),

  buildPackage: (platform: string, projectPath: string) =>
    ipcRenderer.invoke("build-package", platform, projectPath),

  deployApp: (
    platform: string,
    tvIp: string,
    projectPath: string,
    mode: "debug" | "run"
  ) => ipcRenderer.invoke("deploy-app", platform, tvIp, projectPath, mode),

  // Log streaming
  onDeployLog: (callback: (log: string) => void) => {
    const subscription = (_event: unknown, log: string) => callback(log);
    ipcRenderer.on("deploy-log", subscription);
    return () => {
      ipcRenderer.removeListener("deploy-log", subscription);
    };
  },

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    const subscription = (_event: unknown, info: { version: string }) =>
      callback(info);
    ipcRenderer.on("update-available", subscription);
    return () => {
      ipcRenderer.removeListener("update-available", subscription);
    };
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const subscription = (_event: unknown, info: { version: string }) =>
      callback(info);
    ipcRenderer.on("update-downloaded", subscription);
    return () => {
      ipcRenderer.removeListener("update-downloaded", subscription);
    };
  },
  onUpdateError: (callback: (error: string) => void) => {
    const subscription = (_event: unknown, error: string) => callback(error);
    ipcRenderer.on("update-error", subscription);
    return () => {
      ipcRenderer.removeListener("update-error", subscription);
    };
  },

  // Secure storage
  savePassphrase: (deviceName: string, passphrase: string) =>
    ipcRenderer.invoke("save-passphrase", deviceName, passphrase),
  getPassphrase: (deviceName: string) =>
    ipcRenderer.invoke("get-passphrase", deviceName),
  deletePassphrase: (deviceName: string) =>
    ipcRenderer.invoke("delete-passphrase", deviceName),
  getAllDeviceNames: () => ipcRenderer.invoke("get-all-device-names"),
  isSecureStorageAvailable: () =>
    ipcRenderer.invoke("is-secure-storage-available"),

  // Generic invoke method
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args),

  // SDK paths management
  saveSdkPaths: (paths: {
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
  }) => ipcRenderer.invoke("save-sdk-paths", paths),
  getSdkPaths: () => ipcRenderer.invoke("get-sdk-paths"),
});
