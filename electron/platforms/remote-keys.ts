import type {
  ColorKey,
  DigitKey,
  MediaKey,
  Platform,
  RemoteKey,
} from "../../shared/ipc";

interface KeyDefinition {
  key: string;
  code: string;
  keyCode: number;
  /** Set for keys that also produce a keypress. */
  text?: string;
}

const DIGITS = Object.fromEntries(
  Array.from({ length: 10 }, (_, digit) => [
    String(digit),
    {
      key: String(digit),
      code: `Digit${digit}`,
      keyCode: 48 + digit,
      text: String(digit),
    },
  ])
) as Record<DigitKey, KeyDefinition>;

/** The same on every platform. */
const COMMON: Partial<Record<RemoteKey, KeyDefinition>> = {
  up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  enter: { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
  ...DIGITS,
};

// Samsung and LG remotes report colour and media keys with the same TV key codes.
const TV_KEYS: Record<ColorKey | MediaKey, KeyDefinition> = {
  red: { key: "ColorF0Red", code: "", keyCode: 403 },
  green: { key: "ColorF1Green", code: "", keyCode: 404 },
  yellow: { key: "ColorF2Yellow", code: "", keyCode: 405 },
  blue: { key: "ColorF3Blue", code: "", keyCode: 406 },
  play: { key: "MediaPlay", code: "", keyCode: 415 },
  pause: { key: "MediaPause", code: "", keyCode: 19 },
  stop: { key: "MediaStop", code: "", keyCode: 413 },
  rewind: { key: "MediaRewind", code: "", keyCode: 412 },
  fastForward: { key: "MediaFastForward", code: "", keyCode: 417 },
};

// Each TV reports its remote's Back button with its own key code. What an
// Android TV WebView reports for colour and media keys isn't verified yet.
const PLATFORM_KEYS: Record<
  Platform,
  Partial<Record<RemoteKey, KeyDefinition>>
> = {
  tizen: { back: { key: "XF86Back", code: "", keyCode: 10009 }, ...TV_KEYS },
  webos: { back: { key: "GoBack", code: "", keyCode: 461 }, ...TV_KEYS },
  android: { back: { key: "BrowserBack", code: "BrowserBack", keyCode: 166 } },
};

/** The Input.dispatchKeyEvent calls (down, then up) that press a remote key in the app. */
export function remoteKeyEvents(remoteKey: RemoteKey, platform: Platform) {
  const definition = PLATFORM_KEYS[platform][remoteKey] ?? COMMON[remoteKey];
  if (!definition) {
    throw new Error(
      `CTV Bridge can't send the ${remoteKey} key to ${platform === "android" ? "Android TV" : platform} apps yet.`
    );
  }
  const { key, code, keyCode, text } = definition;
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
