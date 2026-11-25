/** Where the main window was, so it reopens there. Free of Electron imports so it can be tested. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: Rect;
  maximized: boolean;
}

/** How much of the window's title bar must be on a screen to reach it. */
const MIN_VISIBLE = 100;

/**
 * The saved state if the window would still be reachable on today's screens,
 * e.g. not on a monitor that was unplugged; otherwise undefined.
 */
export function restorableState(
  saved: unknown,
  workAreas: Rect[],
  minSize: { width: number; height: number }
): WindowState | undefined {
  const state = saved as Partial<WindowState> | undefined;
  const bounds = state?.bounds;
  const isNumber = (value: unknown) => Number.isFinite(value);
  if (
    !bounds ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(isNumber)
  ) {
    return undefined;
  }
  const reachable = workAreas.some(
    (area) =>
      bounds.x + bounds.width - MIN_VISIBLE >= area.x &&
      bounds.x + MIN_VISIBLE <= area.x + area.width &&
      bounds.y >= area.y &&
      bounds.y + MIN_VISIBLE <= area.y + area.height
  );
  if (!reachable) return undefined;
  return {
    bounds: {
      ...bounds,
      width: Math.max(bounds.width, minSize.width),
      height: Math.max(bounds.height, minSize.height),
    },
    maximized: state.maximized === true,
  };
}
