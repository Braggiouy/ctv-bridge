/**
 * Device validation utilities
 */

/**
 * Validate device name (webOS only)
 * Only letters, numbers, dashes, and underscores allowed
 */
export function validateDeviceName(name: string): boolean {
  if (!name) return false;
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  return nameRegex.test(name);
}

/**
 * Validate IP address format and range
 */
export function validateIpAddress(ip: string): boolean {
  if (!ip) return false;

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;

  // Validate each octet is 0-255
  const octets = ip.split(".");
  return octets.every((octet) => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validate port number
 */
export function validatePort(port: string | number): boolean {
  const portNum = typeof port === "string" ? parseInt(port, 10) : port;
  return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
}

/**
 * Validate device form data
 */
export interface DeviceValidationErrors {
  name?: string;
  ip?: string;
  port?: string;
  username?: string;
}

export function validateDeviceForm(
  data: {
    name?: string;
    ip?: string;
    port?: string;
    username?: string;
  },
  platform: "tizen" | "webos"
): DeviceValidationErrors {
  const errors: DeviceValidationErrors = {};

  // Name validation (required for webOS)
  if (platform === "webos") {
    if (!data.name) {
      errors.name = "Device name is required";
    } else if (!validateDeviceName(data.name)) {
      errors.name = "Only letters, numbers, dashes, and underscores allowed";
    }
  }

  // IP validation (required for both)
  if (!data.ip) {
    errors.ip = "IP address is required";
  } else if (!validateIpAddress(data.ip)) {
    errors.ip = "Invalid IP address format";
  }

  // Port validation (webOS only)
  if (platform === "webos" && data.port) {
    if (!validatePort(data.port)) {
      errors.port = "Port must be between 1 and 65535";
    }
  }

  return errors;
}
