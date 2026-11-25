/** Types shared by the Electron main process and the renderer. */

export type Platform = "tizen" | "webos" | "android";
export type DeployMode = "debug" | "run";
/** Acts on the installed app without building or installing. */
export type AppAction = "restart" | "stop" | "uninstall";

export interface Device {
  name: string;
  ip: string;
  /** webOS only: SSH port and user registered with ares-setup-device. */
  port?: string;
  username?: string;
  /** webOS only: write-only, sent when saving and never returned. */
  passphrase?: string;
  hasPassphrase?: boolean;
  /** Tizen: unique device ID, read from the TV on a successful connection. */
  duid?: string;
}

export interface Result {
  success: boolean;
  message?: string;
}

export interface DeviceListResult extends Result {
  devices: Device[];
}

export interface TestConnectionResult extends Result {
  duid?: string;
}

/** A TV found on the local network, not yet added. */
export interface DiscoveredTv {
  name: string;
  ip: string;
  model?: string;
  /** Something to fix on the TV before deploying, e.g. Developer Mode is off. */
  warning?: string;
}

export interface BuildResult extends Result {
  packagePath?: string;
}

export interface DeployResult extends Result {
  /** Set after a debug deploy when DevTools can be opened for the app. */
  inspectorUrl?: string;
}

export type AppLogLevel = "log" | "info" | "warning" | "error";

/** A console message, uncaught exception or browser log line from the app on the TV. */
export interface AppLogEntry {
  level: AppLogLevel;
  text: string;
}

export type ColorKey = "red" | "green" | "yellow" | "blue";
export type MediaKey = "play" | "pause" | "stop" | "rewind" | "fastForward";
export type DigitKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";
export type RemoteKey =
  | "up"
  | "down"
  | "left"
  | "right"
  | "enter"
  | "back"
  | ColorKey
  | MediaKey
  | DigitKey;

/** `paused`: the TV allows one debugger at a time and DevTools has it. */
export type AppConsoleState = "live" | "paused" | "stopped";

export interface DeployTarget {
  projectPath: string;
  /** The package produced by the last build; deploy falls back to the newest one. */
  packagePath?: string;
}

export interface SdkPaths {
  sdbPath?: string;
  tizenPath?: string;
  aresPath?: string;
  adbPath?: string;
}

export interface ToolCheck {
  key: keyof SdkPaths;
  tool: string;
  ok: boolean;
  detail: string;
}

export interface SdkVerifyResult extends Result {
  tools: ToolCheck[];
}

export interface TizenProfile {
  name: string;
  active: boolean;
}

export interface TizenCertificateParams {
  email: string;
  deviceIds?: string[];
  password?: string;
  privilegeLevel?: "Public" | "Partner" | "Platform";
  developerType?: "Individual" | "Corporation";
  profileName?: string;
}

type Unsubscribe = () => void;

/**
 * `manual` means the app couldn't update itself: the macOS installer or the
 * release page was opened instead.
 */
export interface UpdateDownloadResult extends Result {
  manual?: "installer" | "release-page";
}

/** The `window.electron` bridge exposed by the preload script. */
export interface ElectronApi {
  devices: {
    list(platform: Platform): Promise<DeviceListResult>;
    add(platform: Platform, device: Device): Promise<Result>;
    update(platform: Platform, previous: Device, next: Device): Promise<Result>;
    remove(platform: Platform, device: Device): Promise<Result>;
    test(platform: Platform, device: Device): Promise<TestConnectionResult>;
    /** Searches the local network for TVs of this platform. */
    discover(platform: Platform): Promise<Result & { tvs?: DiscoveredTv[] }>;
  };
  sdk: {
    getPaths(): Promise<SdkPaths>;
    savePaths(paths: SdkPaths): Promise<Result>;
    verify(platform: Platform): Promise<SdkVerifyResult>;
  };
  build(
    platform: Platform,
    projectPath: string,
    profileName?: string
  ): Promise<BuildResult>;
  deploy(
    platform: Platform,
    device: Device,
    target: DeployTarget,
    mode: DeployMode
  ): Promise<DeployResult>;
  /** Restarts, stops or uninstalls the project's app on the TV. */
  appAction(
    platform: Platform,
    device: Device,
    target: DeployTarget,
    action: AppAction
  ): Promise<Result>;
  /**
   * Opens DevTools for the app in its own window. `background`: only
   * reconnects a DevTools window that is already open, without focusing it.
   */
  openInspector(url: string, background?: boolean): Promise<Result>;
  /** Watches a project folder or APK for auto-redeploy; replaces any earlier watch. */
  projectWatch: {
    start(target: string): Promise<Result>;
    stop(): Promise<Result>;
    /** Paths relative to the project that changed, once changes settle. */
    onChange(callback: (changed: string[]) => void): Unsubscribe;
  };
  onDeployLog(callback: (line: string) => void): Unsubscribe;
  /** Console output of the app being debugged, streamed after a debug deploy. */
  appConsole: {
    stop(): Promise<Result>;
    onEntries(callback: (entries: AppLogEntry[]) => void): Unsubscribe;
    onState(callback: (state: AppConsoleState) => void): Unsubscribe;
  };
  /** Controls the app being debugged, over the same connection as its console. */
  remote: {
    press(key: RemoteKey): Promise<Result>;
    /** Saves a PNG of the app's screen and copies it to the clipboard. */
    screenshot(): Promise<Result & { path?: string }>;
  };
  /** The console's lines, as text. */
  logs: {
    copy(text: string): Promise<Result>;
    /** Asks where to save; `cancelled` if the user closed the dialog. */
    save(
      text: string
    ): Promise<Result & { path?: string; cancelled?: boolean }>;
  };
  tizen: {
    listProfiles(): Promise<Result & { profiles?: TizenProfile[] }>;
    deleteProfile(name: string): Promise<Result>;
    login(): Promise<Result & { cancelled?: boolean; email?: string }>;
    cancelLogin(): Promise<Result>;
    logout(): Promise<Result>;
    generateCertificates(
      params: TizenCertificateParams
    ): Promise<Result & { path?: string }>;
    onCertificateLog(callback: (line: string) => void): Unsubscribe;
  };
  updater: {
    /** `version` is set when a newer release exists. */
    check(): Promise<Result & { version?: string }>;
    download(): Promise<UpdateDownloadResult>;
    install(): Promise<void>;
    getVersion(): Promise<string>;
    onAvailable(callback: (info: { version: string }) => void): Unsubscribe;
    onProgress(callback: (percent: number) => void): Unsubscribe;
    onReady(callback: (info: { version: string }) => void): Unsubscribe;
  };
  selectDirectory(): Promise<string | null>;
  selectFile(extensions?: string[]): Promise<string | null>;
  openExternal(url: string): Promise<void>;
  showInFolder(target: string): Promise<void>;
}

type Api = ElectronApi;

/** Every channel the renderer invokes, typed by the ElectronApi method it backs. */
export interface IpcInvokeChannels {
  "devices:list": Api["devices"]["list"];
  "devices:add": Api["devices"]["add"];
  "devices:update": Api["devices"]["update"];
  "devices:remove": Api["devices"]["remove"];
  "devices:test": Api["devices"]["test"];
  "devices:discover": Api["devices"]["discover"];
  "sdk:get-paths": Api["sdk"]["getPaths"];
  "sdk:save-paths": Api["sdk"]["savePaths"];
  "sdk:verify": Api["sdk"]["verify"];
  "package:build": Api["build"];
  "package:deploy": Api["deploy"];
  "app:action": Api["appAction"];
  "inspector:open": Api["openInspector"];
  "project-watch:start": Api["projectWatch"]["start"];
  "project-watch:stop": Api["projectWatch"]["stop"];
  "app-console:stop": Api["appConsole"]["stop"];
  "remote:press": Api["remote"]["press"];
  "remote:screenshot": Api["remote"]["screenshot"];
  "logs:copy": Api["logs"]["copy"];
  "logs:save": Api["logs"]["save"];
  "tizen:list-profiles": Api["tizen"]["listProfiles"];
  "tizen:delete-profile": Api["tizen"]["deleteProfile"];
  "tizen-cert:login": Api["tizen"]["login"];
  "tizen-cert:cancel-login": Api["tizen"]["cancelLogin"];
  "tizen-cert:logout": Api["tizen"]["logout"];
  "tizen-cert:generate": Api["tizen"]["generateCertificates"];
  "updater:check": Api["updater"]["check"];
  "updater:download": Api["updater"]["download"];
  "updater:install": Api["updater"]["install"];
  "updater:get-version": Api["updater"]["getVersion"];
  "dialog:select-directory": Api["selectDirectory"];
  "dialog:select-file": Api["selectFile"];
  "shell:open-external": Api["openExternal"];
  "shell:show-in-folder": Api["showInFolder"];
}

/** Every channel the main process sends to the renderer, with its payload. */
export interface IpcEventChannels {
  "deploy-log": string;
  "project-watch:changed": string[];
  "app-console:entries": AppLogEntry[];
  "app-console:state": AppConsoleState;
  "tizen-cert:log": string;
  "updater:available": { version: string };
  "updater:progress": number;
  "updater:ready": { version: string };
}

export type InvokeChannel = keyof IpcInvokeChannels;
export type EventChannel = keyof IpcEventChannels;
export type InvokeArgs<C extends InvokeChannel> = Parameters<
  IpcInvokeChannels[C]
>;
export type InvokeResult<C extends InvokeChannel> = Awaited<
  ReturnType<IpcInvokeChannels[C]>
>;
