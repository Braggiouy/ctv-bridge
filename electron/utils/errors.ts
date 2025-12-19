/**
 * Custom error types for better error handling and type safety
 */

export class CTVBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CTVBridgeError";
  }
}

export class SDKError extends CTVBridgeError {
  constructor(message: string, public readonly sdkType: "tizen" | "webos") {
    super(message);
    this.name = "SDKError";
  }
}

export class ConnectionError extends CTVBridgeError {
  constructor(message: string, public readonly deviceIp: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export class BuildError extends CTVBridgeError {
  constructor(message: string, public readonly projectPath: string) {
    super(message);
    this.name = "BuildError";
  }
}

export class DeploymentError extends CTVBridgeError {
  constructor(
    message: string,
    public readonly deviceIp: string,
    public readonly projectPath: string
  ) {
    super(message);
    this.name = "DeploymentError";
  }
}

export class ValidationError extends CTVBridgeError {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}
