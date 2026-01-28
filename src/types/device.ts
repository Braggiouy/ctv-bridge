export interface BaseDevice {
  name: string;
  ip: string;
  connectionStatus?:
    | "idle"
    | "testing"
    | "connected"
    | "error"
    | "disconnected";
}

export interface WebOSDevice extends BaseDevice {
  port: string;
  username: string;
  passphrase?: string;
}

export interface TizenDevice extends BaseDevice {
  // Tizen specific fields
  sdbStatus?: string;
}

export type Device = WebOSDevice | TizenDevice;
