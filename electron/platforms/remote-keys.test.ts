import { describe, expect, it } from "vitest";
import { remoteKeyEvents } from "./remote-keys";

describe("remoteKeyEvents", () => {
  it("presses and releases arrow keys", () => {
    expect(remoteKeyEvents("left", "tizen")).toEqual([
      {
        type: "rawKeyDown",
        key: "ArrowLeft",
        code: "ArrowLeft",
        windowsVirtualKeyCode: 37,
        nativeVirtualKeyCode: 37,
      },
      {
        type: "keyUp",
        key: "ArrowLeft",
        code: "ArrowLeft",
        windowsVirtualKeyCode: 37,
        nativeVirtualKeyCode: 37,
      },
    ]);
  });

  it("sends Enter with text so the app also gets a keypress", () => {
    const [down] = remoteKeyEvents("enter", "webos");
    expect(down).toMatchObject({ type: "keyDown", text: "\r", key: "Enter" });
  });

  it("uses each platform's Back key code", () => {
    const backCode = (platform: "tizen" | "webos" | "android") =>
      remoteKeyEvents("back", platform)[0].windowsVirtualKeyCode;
    expect(backCode("tizen")).toBe(10009);
    expect(backCode("webos")).toBe(461);
    expect(backCode("android")).toBe(166);
  });
});
