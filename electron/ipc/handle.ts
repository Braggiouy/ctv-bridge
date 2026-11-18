import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { getErrorMessage } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Registers an IPC handler that resolves to `{ success: true, ...result }`.
 * Thrown errors are returned as `{ success: false, message }`.
 */
export function handle<Args extends unknown[]>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: Args) => Promise<object | void>
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { success: true, ...(await fn(event, ...(args as Args))) };
    } catch (error) {
      logger.error(`${channel} failed`, error);
      return { success: false, message: getErrorMessage(error) };
    }
  });
}

/** Sends progress lines to the window that made the request, if it is still open. */
export const replyLog =
  (event: IpcMainInvokeEvent, channel: string) =>
  (line: string): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, line);
  };
