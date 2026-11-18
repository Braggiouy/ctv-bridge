import { useState } from "react";
import { CheckCircle2, FolderOpen, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PathInput } from "@/components/shared/PathInput";
import { StepCard } from "@/components/shared/StepCard";
import { PLATFORMS } from "@/lib/platforms";
import { addRecentProject, type Workflow } from "@/lib/workflow";
import type { Platform } from "@/types";
import { addLog, notify } from "@/utils";
import { TizenSigning } from "./TizenSigning";

interface BuildStepProps {
  platform: Platform;
  workflow: Workflow;
  updateWorkflow: (patch: Partial<Workflow>) => void;
  knownDuids: string[];
  onBack: () => void;
  onNext: () => void;
}

const baseName = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export const BuildStep = ({
  platform,
  workflow,
  updateWorkflow,
  knownDuids,
  onBack,
  onNext,
}: BuildStepProps) => {
  const info = PLATFORMS[platform];
  const { projectPath, packagePath, recentProjects, profileName } = workflow;
  const [building, setBuilding] = useState(false);

  const setProjectPath = (path: string) => {
    if (path !== projectPath)
      updateWorkflow({ projectPath: path, packagePath: undefined });
  };

  const build = async () => {
    if (!projectPath) {
      notify.error(
        info.projectIsFile
          ? "Choose an APK first"
          : "Choose a project folder first"
      );
      return;
    }
    if (platform === "tizen" && !profileName) {
      notify.error(
        "Choose a signing profile",
        "Samsung TVs only install signed apps."
      );
      return;
    }

    setBuilding(true);
    addLog("log", `Building ${projectPath}…`);
    const result = await window.electron.build(
      platform,
      projectPath,
      profileName
    );
    setBuilding(false);

    if (result.success) {
      updateWorkflow({
        packagePath: result.packagePath,
        recentProjects: addRecentProject(recentProjects, projectPath),
      });
      notify.success(`${info.packageLabel} ready`, result.packagePath);
    } else {
      notify.error("Build failed", result.message);
    }
  };

  return (
    <StepCard
      title={info.projectIsFile ? "Choose your APK" : "Build your app"}
      description={
        info.projectIsFile
          ? "Pick the APK you built with Android Studio or Gradle."
          : platform === "tizen"
            ? "Package your web app as a signed WGT package."
            : "Package your web app as an IPK package."
      }
      onBack={onBack}
      busy={building}
      actions={
        <>
          <Button
            variant={packagePath ? "outline" : "default"}
            onClick={build}
            disabled={building}
          >
            {building && <Loader2 className="h-4 w-4 animate-spin" />}
            {info.projectIsFile
              ? "Use this APK"
              : packagePath
                ? "Rebuild"
                : `Build ${info.packageLabel}`}
          </Button>
          <Button onClick={onNext} disabled={!packagePath || building}>
            Next: Deploy
          </Button>
        </>
      }
    >
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
          disabled={building}
        />
        <p className="text-xs text-muted-foreground">{info.projectHint}</p>
        {recentProjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">Recent:</span>
            {recentProjects.map((path) => (
              <span
                key={path}
                className="inline-flex items-center rounded-full border bg-background text-xs"
              >
                <button
                  type="button"
                  className="py-0.5 pl-2.5 pr-1 hover:text-primary"
                  onClick={() => setProjectPath(path)}
                  title={path}
                  disabled={building}
                >
                  {baseName(path)}
                </button>
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
          disabled={building}
        />
      )}

      {packagePath && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {baseName(packagePath)} is ready to deploy
            </p>
            <p
              className="truncate text-xs text-muted-foreground"
              title={packagePath}
            >
              {packagePath}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.electron.showInFolder(packagePath)}
          >
            <FolderOpen className="h-4 w-4" />
            Show
          </Button>
        </div>
      )}
    </StepCard>
  );
};
