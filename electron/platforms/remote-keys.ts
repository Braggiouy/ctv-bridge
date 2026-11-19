import type { Platform, RemoteKey } from "../../shared/ipc";

interface KeyDefinition {
  key: string;
  code: string;
  keyCode: number;
  /** Set for keys that also produce a keypress. */
  text?: string;
}

const KEYS: Record<Exclude<RemoteKey, "back">, KeyDefinition> = {
  up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  enter: { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
};

// Each TV reports its remote's Back button with its own key code.
const BACK: Record<Platform, KeyDefinition> = {
  tizen: { key: "XF86Back", code: "", keyCode: 10009 },
  webos: { key: "GoBack", code: "", keyCode: 461 },
  android: { key: "BrowserBack", code: "BrowserBack", keyCode: 166 },
};

/** The Input.dispatchKeyEvent calls (down, then up) that press a remote key in the app. */
export function remoteKeyEvents(remoteKey: RemoteKey, platform: Platform) {
  const { key, code, keyCode, text } =
    remoteKey === "back" ? BACK[platform] : KEYS[remoteKey];
  const base = {
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  };
  return [
    text ? { ...base, type: "keyDown", text } : { ...base, type: "rawKeyDown" },
    { ...base, type: "keyUp" },
  ];
}
