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

describe("remoteKeyEvents, extra keys", () => {
  const code = (
    key: Parameters<typeof remoteKeyEvents>[0],
    platform: "tizen" | "webos" | "android"
  ) => remoteKeyEvents(key, platform)[0].windowsVirtualKeyCode;

  it("uses the TV key codes for colour and media keys on Tizen and webOS", () => {
    for (const platform of ["tizen", "webos"] as const) {
      expect(
        ["red", "green", "yellow", "blue"].map((k) =>
          code(k as "red", platform)
        )
      ).toEqual([403, 404, 405, 406]);
      expect(
        ["play", "pause", "stop", "rewind", "fastForward"].map((k) =>
          code(k as "play", platform)
        )
      ).toEqual([415, 19, 413, 412, 417]);
    }
  });

  it("sends digits with text so the app also gets a keypress", () => {
    expect(remoteKeyEvents("7", "android")[0]).toMatchObject({
      type: "keyDown",
      key: "7",
      code: "Digit7",
      text: "7",
      windowsVirtualKeyCode: 55,
    });
  });

  it("refuses keys whose Android code isn't known, instead of guessing", () => {
    expect(() => remoteKeyEvents("red", "android")).toThrow(
      "CTV Bridge can't send the red key to Android TV apps yet."
    );
  });
});
