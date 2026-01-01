import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { TOAST_DURATION, useGlobalLogs } from "@/utils";

/**
 * Hook for managing build process state and execution
 */
export function useBuildProcess(platform: "tizen" | "webos") {
  const { addLog } = useGlobalLogs();
  const [building, setBuilding] = useState(false);
  const [wgtGenerated, setWgtGenerated] = useState(false);
  const [generatedPkgInfo, setGeneratedPkgInfo] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [lastBuildMessage, setLastBuildMessage] = useState<string>("");
  const [tizenProfiles, setTizenProfiles] = useState<
    Array<{ name: string; active: boolean }>
  >([]);

  const fetchTizenProfiles = async () => {
    if (platform !== "tizen") return;
    try {
      const result = await window.electron.listTizenProfiles();
      if (result.success) {
        setTizenProfiles(result.profiles);
      }
    } catch (error) {
      console.error("Failed to fetch Tizen profiles:", error);
    }
  };

  const executeBuild = async (
    projectPath: string,
    profileName?: string
  ): Promise<void> => {
    // Reset state
    setWgtGenerated(false);
    setGeneratedPkgInfo(null);
    setLastBuildMessage("");

    if (!projectPath) {
      const msg = `Missing Project Path: Please enter the path to your ${platform} project.`;
      toast({
        title: "Missing Project Path",
        description: `Please enter the path to your ${platform} project.`,
        variant: "destructive",
        duration: TOAST_DURATION,
      });
      addLog("error", msg);
      return;
    }

    setBuilding(true);
    localStorage.setItem(`${platform}_projectPath`, projectPath);

    try {
      const result = await window.electron.buildPackage(
        platform,
        projectPath,
        profileName
      );

      setBuilding(false);

      if (result.success) {
        setLastBuildMessage(result.message);
        setWgtGenerated(true);

        if (result.packageName && result.packagePath) {
          setGeneratedPkgInfo({
            name: result.packageName,
            path: result.packagePath,
          });
        } else {
          setGeneratedPkgInfo(null);
        }

        toast({
          title: `${platform === "tizen" ? "WGT" : "IPK"} Package Generated`,
          description:
            result.packageName && result.packagePath
              ? `✓ ${result.packageName} generated at ${result.packagePath}`
              : result.message,
          duration: TOAST_DURATION,
        });

        addLog(
          "step",
          result.packageName && result.packagePath
            ? `Package generated: ${result.packageName} at ${result.packagePath}`
            : `Build successful: ${result.message}`
        );
      } else {
        toast({
          title: "Build Failed",
          description: result.message,
          variant: "destructive",
          duration: TOAST_DURATION,
        });
        addLog("error", `Build failed: ${result.message}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      setBuilding(false);
      const msg = `Build failed: ${
        err.message || "An error occurred during the build process"
      }`;
      toast({
        title: "Build Failed",
        description:
          (error as Error).message ||
          "An error occurred during the build process",
        variant: "destructive",
        duration: TOAST_DURATION,
      });
      addLog("error", msg);
    }
  };

  return {
    building,
    wgtGenerated,
    generatedPkgInfo,
    lastBuildMessage,
    tizenProfiles,
    fetchTizenProfiles,
    executeBuild,
  };
}
