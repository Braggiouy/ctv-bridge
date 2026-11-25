import type {
  AppAction,
  DeployMode,
  DeployTarget,
  Device,
  ToolCheck,
} from "../../shared/ipc";

export type LogFn = (message: string) => void;

export interface DeployOutcome {
  message: string;
  /** Set after a debug deploy when DevTools can be opened for the app. */
  inspectorUrl?: string;
}

/** Each platform implements this; IPC handlers dispatch to it by platform. Errors are thrown. */
export interface PlatformAdapter {
  listDevices(): Promise<Device[]>;
  addDevice(device: Device): Promise<string>;
  updateDevice(previous: Device, next: Device): Promise<void>;
  removeDevice(device: Device): Promise<void>;
  testConnection(device: Device): Promise<{ message: string; duid?: string }>;
  build(projectPath: string, profileName?: string): Promise<string>;
  deploy(
    device: Device,
    target: DeployTarget,
    mode: DeployMode,
    log: LogFn
  ): Promise<DeployOutcome>;
  /** Acts on the installed app; resolves with a message for the log. */
  appAction(
    device: Device,
    target: DeployTarget,
    action: AppAction
  ): Promise<string>;
  verifySdk(): Promise<ToolCheck[]>;
}
