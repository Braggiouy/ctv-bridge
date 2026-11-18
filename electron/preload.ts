import { contextBridge, ipcRenderer } from "electron";
import type { ElectronApi } from "../shared/ipc";

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args);

const subscribe =
  <T>(channel: string) =>
  (callback: (payload: T) => void) => {
    const listener = (_event: unknown, payload: T) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };

const api: ElectronApi = {
  devices: {
    list: invoke("devices:list"),
    add: invoke("devices:add"),
    update: invoke("devices:update"),
    remove: invoke("devices:remove"),
    test: invoke("devices:test"),
  },
  sdk: {
    getPaths: invoke("sdk:get-paths"),
    savePaths: invoke("sdk:save-paths"),
    verify: invoke("sdk:verify"),
  },
  build: invoke("package:build"),
  deploy: invoke("package:deploy"),
  onDeployLog: subscribe("deploy-log"),
  tizen: {
    listProfiles: invoke("tizen:list-profiles"),
    deleteProfile: invoke("tizen:delete-profile"),
    login: invoke("tizen-cert:login"),
    cancelLogin: invoke("tizen-cert:cancel-login"),
    logout: invoke("tizen-cert:logout"),
    generateCertificates: invoke("tizen-cert:generate"),
    onCertificateLog: subscribe("tizen-cert:log"),
  },
  updater: {
    check: invoke("updater:check"),
    download: invoke("updater:download"),
    install: invoke("updater:install"),
    getVersion: invoke("updater:get-version"),
    onAvailable: subscribe("update-available"),
    onError: subscribe("update-error"),
  },
  selectDirectory: invoke("dialog:select-directory"),
  selectFile: invoke("dialog:select-file"),
  openExternal: invoke("shell:open-external"),
  showInFolder: invoke("shell:show-in-folder"),
};

contextBridge.exposeInMainWorld("electron", api);
