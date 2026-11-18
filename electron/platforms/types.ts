import type {
  DeployMode,
  DeployTarget,
  Device,
  ToolCheck,
} from "../../shared/ipc";

export type LogFn = (message: string) => void;

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
  ): Promise<string>;
  verifySdk(): Promise<ToolCheck[]>;
}
