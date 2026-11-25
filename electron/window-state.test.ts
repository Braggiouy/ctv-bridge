import { describe, expect, it } from "vitest";
import { restorableState } from "./window-state";

const laptop = { x: 0, y: 25, width: 1512, height: 920 };
const monitor = { x: 1512, y: 0, width: 2560, height: 1415 };
const minSize = { width: 800, height: 600 };

describe("restorableState", () => {
  it("restores a window that is on a screen", () => {
    const saved = {
      bounds: { x: 1700, y: 100, width: 1400, height: 900 },
      maximized: true,
    };
    expect(restorableState(saved, [laptop, monitor], minSize)).toEqual(saved);
  });

  it("drops a window left on a monitor that is gone", () => {
    const saved = {
      bounds: { x: 1700, y: 100, width: 1400, height: 900 },
      maximized: false,
    };
    expect(restorableState(saved, [laptop], minSize)).toBeUndefined();
  });

  it("drops a window whose title bar is above the screen", () => {
    const saved = { bounds: { x: 100, y: -300, width: 1000, height: 800 } };
    expect(restorableState(saved, [laptop], minSize)).toBeUndefined();
  });

  it("ignores missing or broken state and keeps the minimum size", () => {
    expect(restorableState(undefined, [laptop], minSize)).toBeUndefined();
    expect(
      restorableState({ bounds: { x: "a" } }, [laptop], minSize)
    ).toBeUndefined();
    expect(
      restorableState(
        { bounds: { x: 10, y: 40, width: 300, height: 200 } },
        [laptop],
        minSize
      )
    ).toEqual({
      bounds: { x: 10, y: 40, width: 800, height: 600 },
      maximized: false,
    });
  });
});
