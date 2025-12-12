import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Package, Bookmark, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { TOAST_DURATION, useGlobalLogs } from "@/utils";
import { SavedPathsList } from "./SavedPathsList";
import { ProjectPathInput } from "./ProjectPathInput";
import { BuildOutput } from "./BuildOutput";
import { useBuildProcess } from "@/hooks/steps/useBuildProcess";

interface SavedPath {
  name: string;
  path: string;
  editing?: boolean;
}

interface BuildStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Main BuildStep component (refactored)
 * Orchestrates the build process
 */
export const BuildStep = ({ onNext, onBack }: BuildStepProps) => {
  const { addLog } = useGlobalLogs();
  const platform =
    (localStorage.getItem("platform") as "tizen" | "webos") || "tizen";

  // Project path state
  const [projectPath, setProjectPath] = useState(
    localStorage.getItem(`${platform}_projectPath`) || ""
  );

  // Saved paths state
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`${platform}_savedBuildPaths`) || "[]"
      );
    } catch {
      return [];
    }
  });

  // Build process hook
  const {
    building,
    wgtGenerated,
    generatedPkgInfo,
    lastBuildMessage,
    executeBuild,
  } = useBuildProcess(platform);

  const handleSavePath = () => {
    if (!projectPath || savedPaths.length >= 3) return;

    const name = projectPath;
    if (savedPaths.some((p) => p.name === name)) {
      toast({
        title: "Duplicate path",
        description: "This path is already saved.",
        variant: "destructive",
        duration: TOAST_DURATION,
      });
      return;
    }

    const updated = [...savedPaths, { name, path: projectPath }];
    setSavedPaths(updated);
    localStorage.setItem(
      `${platform}_savedBuildPaths`,
      JSON.stringify(updated)
    );
    toast({
      title: "Path saved",
      description: `Saved as '${name}'`,
      duration: TOAST_DURATION,
    });
  };

  const handleSelectDirectory = async () => {
    try {
      const selectedPath = await window.electron.selectDirectory();
      if (selectedPath) {
        setProjectPath(selectedPath);
        addLog("step", `Project directory selected: ${selectedPath}`);
      }
    } catch (error: any) {
      const msg = `Error selecting directory: ${
        error.message || "Failed to select directory"
      }`;
      toast({
        title: "Error",
        description: error.message || "Failed to select directory",
        variant: "destructive",
        duration: TOAST_DURATION,
      });
      addLog("error", msg);
    }
  };

  const handleNext = () => {
    if (!wgtGenerated) {
      toast({
        title: "Generate Package First",
        description: "Please generate the WGT package before proceeding.",
        variant: "destructive",
        duration: TOAST_DURATION,
      });
      return;
    }
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Build Application
        </CardTitle>
        <CardDescription>
          Generate a {platform === "tizen" ? "WGT" : "IPK"} package from your
          pre-built {platform} project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-2 rounded bg-muted/60 px-3 py-2 border border-muted-foreground/10">
              <Bookmark className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                Your saved build paths will appear here. You can rename or
                delete them. You can save up to 3 paths.
              </span>
            </div>
            {savedPaths.length > 0 && (
              <div>
                <Label>Saved Build Paths</Label>
                <div className="flex flex-col gap-2 mt-1">
                  <SavedPathsList
                    savedPaths={savedPaths}
                    setSavedPaths={setSavedPaths}
                    setProjectPath={setProjectPath}
                  />
                </div>
              </div>
            )}
          </div>

          <ProjectPathInput
            platform={platform}
            projectPath={projectPath}
            onPathChange={setProjectPath}
            onBrowse={handleSelectDirectory}
            onSavePath={handleSavePath}
            savedPathsCount={savedPaths.length}
          />
        </div>

        {wgtGenerated && (
          <BuildOutput
            packageInfo={generatedPkgInfo}
            message={lastBuildMessage}
          />
        )}

        <div className="flex gap-3 pt-4">
          <Button onClick={onBack} variant="outline">
            <span className="mr-2">&lt;</span> Back
          </Button>
          <Button
            onClick={() => executeBuild(projectPath)}
            disabled={building}
            variant="outline"
            className="flex-1"
          >
            {building && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate {platform === "tizen" ? "WGT" : "IPK"} Package
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    onClick={handleNext}
                    className="w-full"
                    disabled={!wgtGenerated}
                  >
                    Next: Deploy
                  </Button>
                </span>
              </TooltipTrigger>
              {!wgtGenerated && (
                <TooltipContent side="top">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span>Generate an IPK package before deploying.</span>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};
