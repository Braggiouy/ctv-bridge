import { Device, WebOSDevice, TizenDevice } from "@/types";
import { Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * Get the unique identifier for a device
 */
export function getDeviceId(device: Device): string {
  return device.name || device.ip;
}

/**
 * Get connection status icon component
 */
export function getConnectionStatusIcon(
  status?: string,
  isTesting?: boolean
): React.ReactElement {
  if (isTesting) {
    return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
  }

  switch (status) {
    case "testing":
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    case "connected":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Wifi className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Get connection status badge class
 */
export function getConnectionStatusClass(status?: string): string {
  switch (status) {
    case "connected":
      return "bg-green-50 text-green-700 ring-1 ring-green-600/20";
    case "error":
      return "bg-red-50 text-red-700 ring-1 ring-red-600/20";
    case "testing":
      return "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20";
    default:
      return "bg-gray-50 text-gray-700 ring-1 ring-gray-600/20";
  }
}

/**
 * Get connection status text
 */
export function getConnectionStatusText(
  device: Device,
  platform: "tizen" | "webos"
): string {
  if (platform === "tizen") {
    const tizenDevice = device as TizenDevice;
    if (tizenDevice.sdbStatus === "connected") {
      return `Connected (${tizenDevice.sdbStatus})`;
    }
  }

  switch (device.connectionStatus) {
    case "connected":
      return "✓ Connected";
    case "error":
      return "✗ Connection Failed";
    case "testing":
      return "Testing...";
    default:
      return "Not Tested";
  }
}

/**
 * Format device display name
 */
export function formatDeviceDisplayName(
  device: Device,
  platform: "tizen" | "webos"
): string {
  if (platform === "webos") {
    const webosDevice = device as WebOSDevice;
    return `${webosDevice.username}@${webosDevice.ip}:${webosDevice.port}`;
  }
  return device.name || device.ip;
}

/**
 * Mask passphrase for display
 */
export function maskPassphrase(
  passphrase: string,
  maxLength: number = 8
): string {
  if (!passphrase) return "";
  return "•".repeat(Math.min(passphrase.length, maxLength));
}
