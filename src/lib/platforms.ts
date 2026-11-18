import type { Platform, SdkPaths } from "@/types";

export const isWindows = navigator.userAgent.includes("Windows");

interface ToolField {
  key: keyof SdkPaths;
  label: string;
  placeholder: { mac: string; windows: string };
  /** File-picker filter on Windows. */
  windowsExtensions: string[];
}

interface Link {
  label: string;
  url: string;
}

export interface PlatformInfo {
  id: Platform;
  name: string;
  tvName: string;
  /** What gets built and installed, e.g. "WGT package". */
  packageLabel: string;
  sdkSteps: string[];
  tvSteps: string[];
  links: Link[];
  tools: ToolField[];
  /** Android deploys a pre-built APK file; the others package a project folder. */
  projectIsFile: boolean;
  projectHint: string;
  /** webOS devices are addressed by name in every ares-* command. */
  deviceNameRequired: boolean;
}

export const PLATFORMS: Record<Platform, PlatformInfo> = {
  tizen: {
    id: "tizen",
    name: "Samsung Tizen",
    tvName: "Samsung TV",
    packageLabel: "WGT package",
    sdkSteps: [
      "Install Tizen Studio (or the Tizen CLI).",
      "In Package Manager, install the TV extension and the Samsung Certificate Extension.",
    ],
    tvSteps: [
      "Open the Apps panel on the TV.",
      "Press 1 2 3 4 5 on the remote.",
      "Turn Developer Mode on and enter this computer's IP address.",
      "Restart the TV.",
    ],
    links: [
      {
        label: "Install Tizen Studio",
        url: "https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html",
      },
      {
        label: "Certificate guide",
        url: "https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html",
      },
    ],
    tools: [
      {
        key: "sdbPath",
        label: "sdb",
        placeholder: {
          mac: "~/tizen-studio/tools/sdb",
          windows: "C:\\tizen-studio\\tools\\sdb.exe",
        },
        windowsExtensions: ["exe"],
      },
      {
        key: "tizenPath",
        label: "tizen CLI",
        placeholder: {
          mac: "~/tizen-studio/tools/ide/bin/tizen",
          windows: "C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat",
        },
        windowsExtensions: ["bat", "exe"],
      },
    ],
    projectIsFile: false,
    projectHint: "Folder containing config.xml",
    deviceNameRequired: false,
  },
  webos: {
    id: "webos",
    name: "LG webOS",
    tvName: "LG TV",
    packageLabel: "IPK package",
    sdkSteps: [
      "Install the webOS TV CLI (ares-* commands).",
      "Make sure Node.js is installed; the CLI depends on it.",
    ],
    tvSteps: [
      "Install the Developer Mode app from the LG Content Store.",
      "Sign in with your LG developer account.",
      "Turn on Dev Mode Status and Key Server, then note the passphrase.",
    ],
    links: [
      {
        label: "Install webOS CLI",
        url: "https://webostv.developer.lge.com/develop/tools/cli-installation",
      },
    ],
    tools: [
      {
        key: "aresPath",
        label: "ares",
        placeholder: {
          mac: "~/webOS_TV_SDK/CLI/bin/ares",
          windows: "C:\\webOS_TV_SDK\\CLI\\bin\\ares.cmd",
        },
        windowsExtensions: ["cmd", "exe"],
      },
    ],
    projectIsFile: false,
    projectHint: "Folder containing appinfo.json",
    deviceNameRequired: true,
  },
  android: {
    id: "android",
    name: "Android TV",
    tvName: "Android TV",
    packageLabel: "APK",
    sdkSteps: ["Install Android SDK Platform Tools (adb)."],
    tvSteps: [
      "Go to Settings → Device Preferences → About.",
      "Select Build 7 times to unlock Developer options.",
      "In Developer options, turn on USB debugging (and Network debugging if available).",
    ],
    links: [
      {
        label: "Download Platform Tools",
        url: "https://developer.android.com/tools/releases/platform-tools",
      },
      {
        label: "Debugging guide",
        url: "https://developer.android.com/tv/games/debug",
      },
    ],
    tools: [
      {
        key: "adbPath",
        label: "adb",
        placeholder: {
          mac: "~/Library/Android/sdk/platform-tools/adb",
          windows:
            "C:\\Users\\you\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
        },
        windowsExtensions: ["exe"],
      },
    ],
    projectIsFile: true,
    projectHint:
      "Pre-built .apk file (e.g. app/build/outputs/apk/debug/app-debug.apk)",
    deviceNameRequired: false,
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);
