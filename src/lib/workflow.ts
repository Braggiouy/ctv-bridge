import type { Device, Platform } from "@/types";

/** Everything the user picked for one platform, persisted across launches. */
export interface Workflow {
  sdkReady: boolean;
  device?: Device;
  projectPath: string;
  /** Package produced by the last build of `projectPath`. */
  packagePath?: string;
  recentProjects: string[];
  profileName?: string;
}

export const EMPTY_WORKFLOW: Workflow = {
  sdkReady: false,
  projectPath: "",
  recentProjects: [],
};

export const PLATFORM_KEY = "ctv-bridge:platform";
export const workflowKey = (platform: Platform) =>
  `ctv-bridge:workflow:${platform}`;

export const STEPS = [
  { id: 1, name: "Setup" },
  { id: 2, name: "TV" },
  { id: 3, name: "Build" },
  { id: 4, name: "Deploy" },
] as const;

/** The furthest step the user can jump to with what is already configured. */
export function furthestStep(workflow: Workflow): number {
  if (!workflow.sdkReady) return 1;
  if (!workflow.device) return 2;
  if (!workflow.packagePath) return 3;
  return 4;
}

const MAX_RECENT_PROJECTS = 5;

export const addRecentProject = (recent: string[], path: string) =>
  [path, ...recent.filter((p) => p !== path)].slice(0, MAX_RECENT_PROJECTS);

const PLATFORM_IDS: Platform[] = ["tizen", "webos", "android"];

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

/** One-time move from the pre-2.0 scattered localStorage keys. */
export function migrateLegacyStorage(): void {
  const MIGRATED_KEY = "ctv-bridge:migrated";
  if (localStorage.getItem(MIGRATED_KEY)) return;

  const legacyPlatform = localStorage.getItem("platform");
  if (legacyPlatform) {
    localStorage.setItem(PLATFORM_KEY, JSON.stringify(legacyPlatform));
  }

  const legacyKeys = [
    "platform",
    "sdbPath",
    "tizenPath",
    "aresPath",
    "adbPath",
    "tizen-device-names",
    "android-device-names",
  ];

  for (const platform of PLATFORM_IDS) {
    const projectPath = localStorage.getItem(`${platform}_projectPath`) ?? "";
    const savedPaths = readJson<{ path: string }[]>(
      `${platform}_savedBuildPaths`,
      []
    );
    const workflow: Workflow = {
      ...EMPTY_WORKFLOW,
      projectPath,
      recentProjects: [
        ...new Set([projectPath, ...savedPaths.map((p) => p.path)]),
      ]
        .filter(Boolean)
        .slice(0, MAX_RECENT_PROJECTS),
      profileName:
        localStorage.getItem(`${platform}_selectedProfile`) ?? undefined,
    };
    localStorage.setItem(workflowKey(platform), JSON.stringify(workflow));
    legacyKeys.push(
      ...[
        "projectPath",
        "savedBuildPaths",
        "selectedProfile",
        "tvIp",
        "deviceName",
      ].map((suffix) => `${platform}_${suffix}`)
    );
  }

  // Device names used to live here; the main process now remembers devices.
  for (const platform of ["tizen", "android"] as const) {
    const names = readJson<Record<string, string>>(
      `${platform}-device-names`,
      {}
    );
    for (const [ip, name] of Object.entries(names)) {
      const device = { ip: ip.replace(/:\d+$/, ""), name };
      void window.electron.devices.update(platform, device, device);
    }
  }

  legacyKeys.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(MIGRATED_KEY, "1");
}
