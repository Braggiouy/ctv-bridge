import { useState, useCallback } from "react";
import { toast } from "sonner";
import { TOAST_DURATION, useGlobalLogs } from "@/utils";

/**
 * Hook for managing build process state and execution
 */
export function useBuildProcess(platform: "tizen" | "webos" | "android") {
  const { addLog } = useGlobalLogs();
  const [building, setBuilding] = useState(false);
  const [isPackageGenerated, setIsPackageGenerated] = useState(false);
  const [generatedPackageInfo, setGeneratedPackageInfo] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [lastBuildMessage, setLastBuildMessage] = useState<string>("");
  const [tizenProfiles, setTizenProfiles] = useState<
    Array<{ name: string; active: boolean }>
  >([]);

  const fetchTizenProfiles = useCallback(async () => {
    if (platform !== "tizen") return;
    try {
      const result = await window.electron.listTizenProfiles();
      if (result.success) {
        setTizenProfiles(result.profiles);
      }
    } catch (error) {
      console.error("Failed to fetch Tizen profiles:", error);
    }
  }, [platform]);

  const executeBuild = useCallback(
    async (projectPath: string, profileName?: string): Promise<void> => {
      // Reset state
      setIsPackageGenerated(false);
      setGeneratedPackageInfo(null);
      setLastBuildMessage("");

      if (!projectPath) {
        const msg = `Missing Project Path: Please enter the path to your ${platform} project.`;
        toast.error("Missing Project Path", {
          description: `Please enter the path to your ${platform} project.`,
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
          setIsPackageGenerated(true);

          if (result.packageName && result.packagePath) {
            setGeneratedPackageInfo({
              name: result.packageName,
              path: result.packagePath,
            });
          } else {
            setGeneratedPackageInfo(null);
          }

          toast.success(
            `${platform === "tizen" ? "WGT" : "IPK"} Package Generated`,
            {
              description:
                result.packageName && result.packagePath
                  ? `✓ ${result.packageName} generated at ${result.packagePath}`
                  : result.message,
              duration: TOAST_DURATION,
            }
          );

          addLog(
            "step",
            result.packageName && result.packagePath
              ? `Package generated: ${result.packageName} at ${result.packagePath}`
              : `Build successful: ${result.message}`
          );
        } else {
          toast.error("Build Failed", {
            description: result.message,
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
        toast.error("Build Failed", {
          description:
            (error as Error).message ||
            "An error occurred during the build process",
          duration: TOAST_DURATION,
        });
        addLog("error", msg);
      }
    },
    [platform, addLog]
  );

  return {
    building,
    isPackageGenerated,
    generatedPackageInfo,
    lastBuildMessage,
    tizenProfiles,
    fetchTizenProfiles,
    executeBuild,
  };
}
