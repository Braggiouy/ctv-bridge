type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";

function format(level: Level, message: string, args: unknown[]): string {
  const details = args.length > 0 ? ` ${JSON.stringify(args)}` : "";
  return `[${new Date().toISOString()}] [${level}] ${message}${details}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (process.env.NODE_ENV === "development") {
      console.log(format("DEBUG", message, args));
    }
  },
  info: (message: string, ...args: unknown[]) =>
    console.log(format("INFO", message, args)),
  warn: (message: string, ...args: unknown[]) =>
    console.warn(format("WARN", message, args)),
  error: (message: string, ...args: unknown[]) =>
    console.error(format("ERROR", message, args)),
};
