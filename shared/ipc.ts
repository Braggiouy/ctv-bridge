/** Types shared by the Electron main process and the renderer. */

export type Platform = "tizen" | "webos" | "android";
export type DeployMode = "debug" | "run";

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

export type RemoteKey = "up" | "down" | "left" | "right" | "enter" | "back";

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
  /** Opens DevTools for the app in its own window. */
  openInspector(url: string): Promise<Result>;
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
