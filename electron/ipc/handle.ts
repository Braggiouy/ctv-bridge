import { ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import type {
  EventChannel,
  InvokeArgs,
  InvokeChannel,
  InvokeResult,
  IpcEventChannels,
} from "../../shared/ipc";
import { getErrorMessage } from "../utils/errors";
import { logger } from "../utils/logger";

/** What a `handle` handler returns: its result, which `handle` marks successful. */
type Reply<R> = Omit<R, "success"> & { success?: boolean } extends infer Fields
  ? object extends Fields
    ? Fields | void
    : Fields
  : never;

/**
 * Registers an IPC handler that resolves to `{ success: true, ...result }`.
 * Thrown errors are returned as `{ success: false, message }`.
 */
export function handle<C extends InvokeChannel>(
  channel: C,
  fn: (
    event: IpcMainInvokeEvent,
    ...args: InvokeArgs<C>
  ) => Promise<Reply<InvokeResult<C>>>
) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await fn(event, ...(args as InvokeArgs<C>));
      return { success: true, ...(result as object | void) };
    } catch (error) {
      logger.error(`${channel} failed`, error);
      return { success: false, message: getErrorMessage(error) };
    }
  });
}

/** Registers an IPC handler whose value is returned as is, errors included. */
export function handleRaw<C extends InvokeChannel>(
  channel: C,
  fn: (
    event: IpcMainInvokeEvent,
    ...args: InvokeArgs<C>
  ) => InvokeResult<C> | Promise<InvokeResult<C>>
) {
  ipcMain.handle(channel, (event, ...args) =>
    fn(event, ...(args as InvokeArgs<C>))
  );
}

/** Sends an event to a window, if it is still open. */
export function sendTo<C extends EventChannel>(
  target: WebContents,
  channel: C,
  payload: IpcEventChannels[C]
): void {
  if (!target.isDestroyed()) target.send(channel, payload);
}

/** Sends progress lines to the window that made the request, if it is still open. */
export const replyLog =
  (event: IpcMainInvokeEvent, channel: "deploy-log" | "tizen-cert:log") =>
  (line: string): void =>
    sendTo(event.sender, channel, line);
