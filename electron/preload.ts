import { contextBridge, ipcRenderer } from "electron";
import type {
  ElectronApi,
  EventChannel,
  IpcEventChannels,
  IpcInvokeChannels,
  InvokeChannel,
} from "../shared/ipc";

const invoke = <C extends InvokeChannel>(channel: C) =>
  ((...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)) as IpcInvokeChannels[C];

const subscribe =
  <C extends EventChannel>(channel: C) =>
  (callback: (payload: IpcEventChannels[C]) => void) => {
    const listener = (_event: unknown, payload: IpcEventChannels[C]) =>
      callback(payload);
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
    discover: invoke("devices:discover"),
  },
  sdk: {
    getPaths: invoke("sdk:get-paths"),
    savePaths: invoke("sdk:save-paths"),
    verify: invoke("sdk:verify"),
  },
  build: invoke("package:build"),
  deploy: invoke("package:deploy"),
  openInspector: invoke("inspector:open"),
  projectWatch: {
    start: invoke("project-watch:start"),
    stop: invoke("project-watch:stop"),
    onChange: subscribe("project-watch:changed"),
  },
  onDeployLog: subscribe("deploy-log"),
  appConsole: {
    stop: invoke("app-console:stop"),
    onEntries: subscribe("app-console:entries"),
    onState: subscribe("app-console:state"),
  },
  remote: {
    press: invoke("remote:press"),
    screenshot: invoke("remote:screenshot"),
  },
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
    onAvailable: subscribe("updater:available"),
    onProgress: subscribe("updater:progress"),
    onReady: subscribe("updater:ready"),
  },
  selectDirectory: invoke("dialog:select-directory"),
  selectFile: invoke("dialog:select-file"),
  openExternal: invoke("shell:open-external"),
  showInFolder: invoke("shell:show-in-folder"),
};

contextBridge.exposeInMainWorld("electron", api);
