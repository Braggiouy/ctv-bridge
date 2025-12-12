// Add the updateDevice method to the ElectronAPI interface
interface ElectronAPI {
  // webOS device management
  listDevices: () => Promise<any>;
  addDevice: (device: any) => Promise<any>;
  removeDevice: (name: string) => Promise<any>;
  // Tizen device management
  listTizenDevices: () => Promise<any>;
  addTizenDevice: (ip: string) => Promise<any>;
  removeTizenDevice: (ip: string) => Promise<any>;
  // Other methods
  selectDirectory: () => Promise<string | null>;
  checkTizenSdk: () => Promise<any>;
  checkWebOsSdk: () => Promise<any>;
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
  invoke: <T = any>(channel: string, ...args: any[]) => Promise<T>;
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
