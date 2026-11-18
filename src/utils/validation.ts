import type { Device, Platform } from "@/types";

export type DeviceErrors = Partial<Record<"name" | "ip" | "port", string>>;

export function isValidIp(ip: string): boolean {
  return (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split(".").every((octet) => Number(octet) <= 255)
  );
}

export function validateDevice(
  platform: Platform,
  device: Device
): DeviceErrors {
  const errors: DeviceErrors = {};
  if (platform === "webos") {
    // The name is the device's identifier for every ares-* command.
    if (!device.name) errors.name = "A name is required";
    else if (!/^[\w-]+$/.test(device.name))
      errors.name = "Use only letters, numbers, dashes and underscores";

    const port = Number(device.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      errors.port = "Port must be between 1 and 65535";
  }
  if (!isValidIp(device.ip)) errors.ip = "Enter a valid IPv4 address";
  return errors;
}
