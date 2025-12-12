import { vi } from "vitest";
import * as child_process from "child_process";
import * as fs from "fs/promises";

// ------------------- Mock Stubs -------------------
export const childProcessExecMock = child_process.exec as unknown as ReturnType<
  typeof vi.fn
>;
export const fsReaddirMock = fs.readdir as unknown as ReturnType<typeof vi.fn>;
export const fsStatMock = fs.stat as unknown as ReturnType<typeof vi.fn>;
export const fsRenameMock = fs.rename as unknown as ReturnType<typeof vi.fn>;

/**
 * Mock a successful exec command.
 */
export function mockExecSuccess(stdout: string, stderr = "") {
  childProcessExecMock.mockImplementation((cmd, opts, callback) => {
    const cb = typeof opts === "function" ? opts : callback;
    cb(null, { stdout, stderr });
  });
}

/**
 * Mock a command‑not‑found error.
 */
export function mockExecCommandNotFound(command: string) {
  childProcessExecMock.mockImplementation((cmd, callback) => {
    callback(new Error(`command not found: ${command}`), {
      stdout: "",
      stderr: "",
    });
  });
}
