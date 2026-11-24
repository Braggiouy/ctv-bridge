// Fake window.electron for recording the README demo: made-up TVs, project and
// logs, so nothing from a real machine or network ends up in the recording.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const listeners = {};
const on = (channel) => (callback) => {
  (listeners[channel] ??= new Set()).add(callback);
  return () => listeners[channel].delete(callback);
};
const emit = (channel, payload) =>
  listeners[channel]?.forEach((callback) => callback(payload));
const ok = async () => ({ success: true });

const PROJECT = "~/projects/streaming-app";
const DEVICES = {
  tizen: [
    { name: "Living Room TV", ip: "192.0.2.10" },
    { name: "Office TV", ip: "192.0.2.11" },
  ],
  webos: [{ name: "Bedroom TV", ip: "192.0.2.20" }],
  android: [{ name: "Streaming Stick", ip: "192.0.2.30" }],
};
const NEARBY = [
  { name: "Kitchen TV", ip: "192.0.2.12", model: "QE55Q80C" },
  { name: "Guest Room TV", ip: "192.0.2.13", warning: "Developer Mode is off" },
];

// "setup" shows the one-time setup screen; anything else starts ready to deploy.
const scene = process.argv
  .find((arg) => arg.startsWith("--demo-scene="))
  ?.split("=")[1];

localStorage.setItem("theme", "dark");
localStorage.setItem("ctv-bridge:migrated", "1");
localStorage.setItem("ctv-bridge:platform", JSON.stringify("tizen"));
localStorage.setItem(
  "ctv-bridge:workflow:tizen",
  JSON.stringify({
    sdkReady: scene !== "setup",
    device: DEVICES.tizen[0],
    projectPath: PROJECT,
    recentProjects: [PROJECT, "~/projects/kids-app"],
    profileName: "my-profile",
  })
);

const appLog = (level, text) => emit("entries", [{ level, text }]);

// The demo app's focus moves like a real TV app's would.
const rails = ["Continue watching", "Trending now", "New releases"];
const titles = ["The Long Night", "Ocean Deep", "City Lights", "Red Canyon"];
let rail = 0;
let item = 0;
const focus = () => appLog("log", `focus → ${rails[rail]} · ${titles[item]}`);

const REACTIONS = {
  right: () => {
    item = Math.min(item + 1, titles.length - 1);
    focus();
  },
  left: () => {
    item = Math.max(item - 1, 0);
    focus();
  },
  down: () => {
    rail = Math.min(rail + 1, rails.length - 1);
    focus();
  },
  up: () => {
    rail = Math.max(rail - 1, 0);
    focus();
  },
  enter: () => {
    appLog("info", `Open details: ${titles[item]}`);
    setTimeout(
      () =>
        appLog(
          "warning",
          "Artwork missing for 1 episode (falling back to the poster)"
        ),
      500
    );
  },
  back: () => appLog("info", "Back to Home"),
};

async function startAppConsole() {
  await sleep(300);
  emit("state", "live");
  const boot = [
    ["log", '[boot] streaming-app 2.4.0 started {env: "staging", rails: 6}'],
    ["info", "Player initialised (HLS, 1080p)"],
    ["log", "Home rendered in 812ms"],
    [
      "warning",
      "Manifest retry 1/3 (https://cdn.example.com/live/master.m3u8)",
    ],
    [
      "error",
      "Request failed: 503\n    at loadRails (main.js:42:10)\n    at init (main.js:17:3)",
    ],
  ];
  for (const [level, text] of boot) {
    await sleep(450);
    appLog(level, text);
  }
}

window.electron = {
  devices: {
    list: async (platform) => ({
      success: true,
      devices: DEVICES[platform] ?? [],
    }),
    add: ok,
    update: ok,
    remove: ok,
    test: async (_platform, device) => {
      await sleep(500);
      return { success: true, message: `Connected to ${device.name}` };
    },
    discover: async () => {
      await sleep(600);
      return { success: true, tvs: NEARBY };
    },
  },
  sdk: {
    getPaths: async () => ({
      sdbPath: "~/tizen-studio/tools/sdb",
      tizenPath: "~/tizen-studio/tools/ide/bin/tizen",
    }),
    savePaths: ok,
    verify: async () => ({ success: true, tools: [] }),
  },
  build: async () => {
    await sleep(900);
    return { success: true, packagePath: `${PROJECT}/StreamingApp.wgt` };
  },
  deploy: async (_platform, device, _target, mode) => {
    const lines = [
      `Connecting to ${device.name}…`,
      "Installing StreamingApp.wgt…",
      "Installation complete",
      ...(mode === "debug"
        ? [
            "Starting app in debug mode…",
            "Debug port forwarded to 127.0.0.1:41237",
          ]
        : ["Launching application…"]),
    ];
    for (const line of lines) {
      await sleep(420);
      emit("deploy-log", line);
    }
    if (mode !== "debug")
      return { success: true, message: "Deployed and launched" };
    void startAppConsole();
    return {
      success: true,
      message: "Deployed in debug mode",
      inspectorUrl:
        "devtools://devtools/bundled/inspector.html?ws=127.0.0.1:41237/devtools/page/1",
    };
  },
  openInspector: ok,
  projectWatch: {
    start: ok,
    stop: ok,
    onChange: on("project-changed"),
  },
  onDeployLog: on("deploy-log"),
  appConsole: {
    stop: async () => {
      emit("state", "stopped");
      return { success: true };
    },
    liveReload: async () => ({ success: true, reloaded: true }),
    onEntries: on("entries"),
    onState: on("state"),
  },
  remote: {
    press: async (key) => {
      setTimeout(REACTIONS[key], 120);
      return { success: true };
    },
    screenshot: async () => {
      await sleep(350);
      return {
        success: true,
        path: "~/Pictures/CTV Bridge/screenshot-2026-11-19-10-30-12.png",
      };
    },
  },
  tizen: {
    listProfiles: async () => ({
      success: true,
      profiles: [{ name: "my-profile", active: true }],
    }),
    deleteProfile: ok,
    login: async () => ({ success: false, cancelled: true }),
    cancelLogin: ok,
    logout: ok,
    generateCertificates: ok,
    onCertificateLog: on("certificate-log"),
  },
  updater: {
    check: ok,
    download: ok,
    install: async () => {},
    getVersion: async () => "1.12.0",
    onAvailable: on("update-available"),
    onProgress: on("update-progress"),
    onReady: on("update-ready"),
  },
  selectDirectory: async () => null,
  selectFile: async () => null,
  openExternal: async () => {},
  showInFolder: async () => {},
};
