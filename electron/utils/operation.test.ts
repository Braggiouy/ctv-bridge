import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { on: () => undefined } }));

const { runCli } = await import("./cli");
const { cancelOperation, childrenByParent, runCancellable, CancelledError } =
  await import("./operation");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const running = (marker: string) =>
  execFileSync("ps", ["-A", "-o", "command="], { encoding: "utf8" })
    .split("\n")
    .some((line) => line.includes(marker) && !line.includes("ps -A"));

describe("childrenByParent", () => {
  it("groups pids by parent", () => {
    const tree = childrenByParent("  10   1\n  11  10\n  12  10\n  13  11\n");
    expect(tree.get(10)).toEqual([11, 12]);
    expect(tree.get(11)).toEqual([13]);
  });
});

describe.skipIf(process.platform === "win32")("runCancellable", () => {
  it("kills the wrapper and what it started, at once", async () => {
    // Like the tizen script starting java: the work runs in a child process.
    const marker = "37.123";
    let failure: unknown;
    const work = runCancellable(async () => {
      await runCli("sh", ["-c", `sleep ${marker}; echo done`]).catch(
        (error) => {
          failure = error;
          throw error;
        }
      );
      return "finished";
    });
    await wait(300);
    expect(running(`sleep ${marker}`)).toBe(true);

    expect(cancelOperation()).toBe(true);
    await expect(work).rejects.toBeInstanceOf(CancelledError);
    await wait(300);
    expect(running(`sleep ${marker}`)).toBe(false);
    // Not reported as a timeout, so no timeout recovery runs.
    expect((failure as { killed?: boolean }).killed).toBe(false);
  });

  it("refuses commands the cancelled work tries to run afterwards", async () => {
    let later: Promise<unknown> | undefined;
    const work = runCancellable(async () => {
      await wait(200);
      later = runCli("echo", ["too late"]);
      return later;
    });
    cancelOperation();
    await expect(work).rejects.toBeInstanceOf(CancelledError);
    await wait(300);
    await expect(later).rejects.toBeInstanceOf(CancelledError);
  });

  it("has nothing to cancel outside an operation", () => {
    expect(cancelOperation()).toBe(false);
  });
});
