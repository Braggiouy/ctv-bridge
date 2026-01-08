/**
 * Simple structured logging utility for Electron main process
 * Provides consistent logging with timestamps and severity levels
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : "";
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === "development") {
      console.log(this.formatMessage(LogLevel.DEBUG, message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage(LogLevel.INFO, message, ...args));
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, ...args));
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, ...args));
  }

  /**
   * Helper for timestamped logging in IPC handlers
   */
  getTimeLog(message: string): string {
    return `[${new Date().toLocaleTimeString()}] ${message}`;
  }
}

export const logger = new Logger();
