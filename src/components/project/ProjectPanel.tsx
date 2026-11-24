import { Fragment, useEffect, useRef, useState } from "react";
import {
  Bug,
  CheckCircle2,
  FolderOpen,
  Hammer,
  Loader2,
  Play,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { STATUS_DOT, type ConnectionStatus } from "@/components/devices/status";
import { PathInput } from "@/components/shared/PathInput";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PLATFORMS } from "@/lib/platforms";
import {
  addRecentProject,
  recentProjectLabels,
  type Workflow,
} from "@/lib/workflow";
import type { DeployMode, Platform } from "@/types";
import { addLog, cn } from "@/utils";
import { TizenSigning } from "./TizenSigning";

interface ProjectPanelProps {
  platform: Platform;
  workflow: Workflow;
  updateWorkflow: (patch: Partial<Workflow>) => void;
  status?: ConnectionStatus;
  onRetryConnection: () => void;
  onCancelConnection: () => void;
  knownDuids: string[];
}

type Busy = "build" | DeployMode | null;
type Outcome = {
  success: boolean;
  message: string;
  at: Date;
  inspectorUrl?: string;
};

const baseName = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/** e.g. "index.html", or "index.html and 3 more". */
const describeChanges = (changed: string[]) =>
  changed.length > 1
    ? `${changed[0]} and ${changed.length - 1} more`
    : (changed[0] ?? "Project");

const time = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const ProjectPanel = ({
  platform,
  workflow,
  updateWorkflow,
  status,
  onRetryConnection,
  onCancelConnection,
  knownDuids,
}: ProjectPanelProps) => {
  const info = PLATFORMS[platform];
  const { device, projectPath, packagePath, recentProjects, profileName } =
    workflow;
  const recentLabels = recentProjectLabels(recentProjects);
  const [busy, setBusy] = useState<Busy>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [autoRedeploy, setAutoRedeploy] = useState(false);
  /** Set synchronously, so a change arriving before the re-render doesn't start a second run. */
  const running = useRef(false);
  /** Files changed during a run, redeployed once it ends. */
  const queuedChanges = useRef<string[]>([]);
  /** Auto-redeploy repeats the last Run or Debug. */
  const lastDeployMode = useRef<DeployMode>("run");

  const setProjectPath = (path: string) => {
    if (path === projectPath) return;
    updateWorkflow({ projectPath: path, packagePath: undefined });
    setOutcome(null);
  };

  const missing = !projectPath
    ? info.projectIsFile
      ? "Choose an APK."
      : "Choose a project folder."
    : platform === "tizen" && !profileName
      ? "Choose a signing profile."
      : null;

  const build = async (): Promise<string | undefined> => {
    addLog("info", `Building ${projectPath}…`);
    const result = await window.electron.build(
      platform,
      projectPath,
      profileName
    );
    if (!result.success || !result.packagePath) {
      setOutcome({
        success: false,
        message: result.message ?? "Build failed",
        at: new Date(),
      });
      addLog("error", `Build failed: ${result.message}`);
      return undefined;
    }
    updateWorkflow({
      packagePath: result.packagePath,
      recentProjects: addRecentProject(recentProjects, projectPath),
    });
    addLog("step", `${baseName(result.packagePath)} ready`);
    return result.packagePath;
  };

  const openInspector = async (url: string, background = false) => {
    const result = await window.electron.openInspector(url, background);
    if (!result.success) {
      addLog("error", `Couldn't open DevTools: ${result.message}`);
    }
  };

  /** `auto`: started by a file change, so DevTools is only reconnected if open, not focused. */
  const run = async (action: "build" | DeployMode, auto = false) => {
    running.current = true;
    if (action !== "build") lastDeployMode.current = action;
    setBusy(action);
    setOutcome(null);
    try {
      const built = await build();
      if (!built) return;
      if (action === "build") {
        setOutcome({
          success: true,
          message: `Built ${baseName(built)}`,
          at: new Date(),
        });
        return;
      }
      addLog("info", `Deploying to ${device!.name || device!.ip} (${action})…`);
      const result = await window.electron.deploy(
        platform,
        device!,
        { projectPath, packagePath: built },
        action
      );
      const message =
        result.message ?? (result.success ? "Done" : "Deployment failed");
      const { inspectorUrl } = result;
      setOutcome({
        success: result.success,
        message,
        at: new Date(),
        inspectorUrl,
      });
      if (result.success) addLog("step", message);
      else addLog("error", `Deployment failed: ${message}`);
      if (inspectorUrl) await openInspector(inspectorUrl, auto);
    } finally {
      running.current = false;
      setBusy(null);
      const queued = queuedChanges.current;
      if (queued.length > 0) {
        queuedChanges.current = [];
        // After the re-render, so the redeploy sees the current project and TV.
        setTimeout(() => onProjectChange.current(queued));
      }
    }
  };

  const canDeploy = !missing && !!device && status?.state !== "checking";

  const onProjectChange = useRef<(changed: string[]) => void>(() => {});
  onProjectChange.current = (changed) => {
    const what = describeChanges(changed);
    if (running.current) {
      queuedChanges.current = [
        ...new Set([...queuedChanges.current, ...changed]),
      ];
      return;
    }
    if (!canDeploy) {
      addLog(
        "warning",
        `${what} changed, but can't redeploy: ${missing ?? (device ? "the TV is still connecting." : "select a TV.")}`
      );
      return;
    }
    addLog("info", `${what} changed. Redeploying…`);
    void run(lastDeployMode.current, true);
  };

  useEffect(() => {
    if (!autoRedeploy || !projectPath) return;
    const { projectWatch } = window.electron;
    const off = projectWatch.onChange((changed) =>
      onProjectChange.current(changed)
    );
    void projectWatch.start(projectPath).then((result) => {
      if (result.success) return;
      addLog("error", `Auto-redeploy stopped: ${result.message}`);
      setAutoRedeploy(false);
    });
    return () => {
      off();
      void projectWatch.stop();
      // Changes seen during a deploy no longer count once watching stops.
      queuedChanges.current = [];
    };
  }, [autoRedeploy, projectPath]);

  return (
    <section className="space-y-5 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="project-path">
          {info.projectIsFile ? "APK file" : "Project folder"}
        </Label>
        <PathInput
          id="project-path"
          value={projectPath}
          onChange={setProjectPath}
          placeholder={info.projectHint}
          directory={!info.projectIsFile}
          extensions={info.projectIsFile ? ["apk"] : undefined}
          disabled={!!busy}
        />
        {recentProjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">Recent</span>
            {recentProjects.map((path, i) => (
              <span
                key={path}
                className={cn(
                  "inline-flex items-center rounded-full border text-xs",
                  path === projectPath && "border-primary/50 bg-primary/10"
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="py-0.5 pl-2.5 pr-1 hover:text-primary"
                      onClick={() => setProjectPath(path)}
                      aria-label={path}
                      disabled={!!busy}
                    >
                      {recentLabels[i]}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-xl font-mono text-xs"
                  >
                    {/* Long paths wrap only after a slash. */}
                    {path.split(/(?<=[\\/])/).map((part, j) => (
                      <Fragment key={j}>
                        {part}
                        <wbr />
                      </Fragment>
                    ))}
                  </TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    updateWorkflow({
                      recentProjects: recentProjects.filter((p) => p !== path),
                    })
                  }
                  aria-label={`Forget ${path}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {platform === "tizen" && (
        <TizenSigning
          profileName={profileName}
          onChange={(name) =>
            updateWorkflow({ profileName: name, packagePath: undefined })
          }
          knownDuids={knownDuids}
          disabled={!!busy}
        />
      )}

      <div className="space-y-3 border-t pt-5">
        <p className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              status ? STATUS_DOT[status.state] : "bg-muted-foreground/30"
            )}
          />
          {device ? (
            <>
              <span className="font-medium">{device.name || device.ip}</span>
              <span
                className={cn(
                  "truncate",
                  status?.state === "failed"
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                )}
                title={status?.state === "failed" ? status.message : undefined}
              >
                {status?.state === "checking"
                  ? "Connecting…"
                  : status?.state === "failed"
                    ? status.message
                    : status?.state === "connected"
                      ? `Connected · ${device.ip}`
                      : device.ip}
              </span>
              {status?.state === "checking" ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={onCancelConnection}
                >
                  Cancel
                </Button>
              ) : (
                status?.state === "failed" && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto shrink-0 p-0"
                    onClick={onRetryConnection}
                    disabled={!!busy}
                  >
                    Retry
                  </Button>
                )
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              Select a TV on the left, or add one.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            onClick={() => run("run")}
            title={
              info.projectIsFile
                ? "Install the APK and launch it"
                : `Build the ${info.packageLabel}, install it and launch it`
            }
            disabled={!!busy || !canDeploy}
          >
            {busy === "run" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => run("debug")}
            disabled={!!busy || !canDeploy}
            title={
              info.projectIsFile
                ? "Like Run, then opens DevTools for the app's WebView"
                : "Like Run, then opens DevTools for the app"
            }
          >
            {busy === "debug" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bug className="h-4 w-4" />
            )}
            Debug
          </Button>
          {!info.projectIsFile && (
            <Button
              size="lg"
              variant="ghost"
              onClick={() => run("build")}
              disabled={!!busy || !!missing}
              title={`Only create the ${info.packageLabel}`}
            >
              {busy === "build" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Hammer className="h-4 w-4" />
              )}
              Build only
            </Button>
          )}
          <Button
            size="lg"
            variant={autoRedeploy ? "secondary" : "ghost"}
            onClick={() => setAutoRedeploy((on) => !on)}
            disabled={!projectPath}
            aria-pressed={autoRedeploy}
            title={`Redeploy with Run or Debug, whichever you used last, when the ${info.projectIsFile ? "APK" : "project"} changes`}
          >
            <RefreshCw className="h-4 w-4" />
            Auto-redeploy
          </Button>
        </div>
        {autoRedeploy && (
          <p className="text-xs text-muted-foreground">
            Watching {baseName(projectPath)}. Changes redeploy with{" "}
            {lastDeployMode.current === "debug" ? "Debug" : "Run"}.
          </p>
        )}

        {missing && <p className="text-xs text-muted-foreground">{missing}</p>}
        {outcome ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-sm",
              outcome.success
                ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
            )}
          >
            {outcome.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 whitespace-pre-wrap break-words">
              {outcome.message}
            </span>
            {outcome.inspectorUrl && (
              <Button
                size="sm"
                variant="outline"
                className="-my-1 h-7 shrink-0"
                onClick={() => openInspector(outcome.inspectorUrl!)}
              >
                <Bug className="h-3.5 w-3.5" />
                Open DevTools
              </Button>
            )}
            <span className="shrink-0 text-xs opacity-70">
              {time(outcome.at)}
            </span>
          </div>
        ) : (
          packagePath && (
            <button
              type="button"
              onClick={() => window.electron.showInFolder(packagePath)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title={packagePath}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Last package: {baseName(packagePath)}
            </button>
          )
        )}
      </div>
    </section>
  );
};
