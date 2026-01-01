// Add the updateDevice method to the ElectronAPI interface
interface ElectronAPI {
  // webOS device management
  listDevices: () => Promise<{
    success: boolean;
    devices: Device[];
    message?: string;
  }>;
  addDevice: (device: Device) => Promise<{ success: boolean; message: string }>;
  removeDevice: (
    name: string
  ) => Promise<{ success: boolean; message: string }>;
  // Tizen device management
  listTizenDevices: () => Promise<{
    success: boolean;
    devices: { ip: string; status: string }[];
    message?: string;
  }>;
  addTizenDevice: (
    ip: string
  ) => Promise<{ success: boolean; message: string }>;
  removeTizenDevice: (
    ip: string
  ) => Promise<{ success: boolean; message: string }>;
  // Other methods
  selectDirectory: () => Promise<string | null>;
  checkTizenSdk: () => Promise<{ success: boolean; message: string }>;
  checkWebOsSdk: () => Promise<{ success: boolean; message: string }>;
  updateDevice: (
    device: Device
  ) => Promise<{ success: boolean; message?: string }>;
  // Secure storage
  savePassphrase: (
    deviceName: string,
    passphrase: string
  ) => Promise<{ success: boolean; message?: string }>;
  getPassphrase: (deviceName: string) => Promise<{
    success: boolean;
    passphrase: string | null;
    message?: string;
  }>;
  deletePassphrase: (
    deviceName: string
  ) => Promise<{ success: boolean; message?: string }>;
  getAllDeviceNames: () => Promise<{
    success: boolean;
    deviceNames: string[];
    message?: string;
  }>;
  isSecureStorageAvailable: () => Promise<{
    success: boolean;
    available: boolean;
  }>;
  // Generic invoke method for any IPC handler
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  listTizenProfiles: () => Promise<{
    success: boolean;
    profiles: { name: string; active: boolean }[];
    message?: string;
  }>;
  openExternal: (url: string) => Promise<{ success: boolean }>;
  // SDK paths management
  saveSdkPaths: (paths: {
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
  }) => Promise<{ success: boolean }>;
  getSdkPaths: () => Promise<{
    sdbPath?: string;
    tizenPath?: string;
    aresPath?: string;
  }>;
}
