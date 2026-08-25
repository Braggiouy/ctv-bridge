import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Rocket, Bug, Play } from "lucide-react";
import { toast } from "sonner";
import { TOAST_DURATION } from "@/utils";
import { mergeClassNames } from "@/utils";
import { useGlobalLogs } from "@/utils";

interface DeployStepProps {
  onBack: () => void;
  onHome: () => void;
}

const LOG_DRAIN_DELAY_MS = 1000;

export const DeployStep = (props: DeployStepProps) => {
  const { onBack, onHome } = props;
  const { addLog } = useGlobalLogs();
  const platform =
    (localStorage.getItem("platform") as "tizen" | "webos" | "android") ||
    "tizen";
  const [deploying, setDeploying] = useState(false);
  const [deployMode, setDeployMode] = useState<"debug" | "run" | null>(null);

  const handleDeploy = async (mode: "debug" | "run") => {
    setDeploying(true);
    setDeployMode(mode);
    addLog("step", `Deploy started: mode=${mode}`);

    const tvIp = localStorage.getItem(`${platform}_tvIp`) || "";
    const deviceName = localStorage.getItem(`${platform}_deviceName`) || "";
    const projectPath = localStorage.getItem(`${platform}_projectPath`) || "";

    // For webOS, require deviceName; for Tizen and Android, use tvIp (or ID)
    const deviceArg = platform === "webos" ? deviceName : tvIp;

    if (!deviceArg || !projectPath) {
      const msg =
        "Missing Configuration: Please complete the previous steps first.";
      toast.error("Missing Configuration", {
        description: "Please complete the previous steps first.",
        duration: TOAST_DURATION,
      });
      addLog("error", msg);
      setDeploying(false);
      setDeployMode(null);
      return;
    }

    // Set up log listener
    const unsubscribe = window.electron.onDeployLog((log) => {
      addLog("log", log);
    });

    try {
      const result = await window.electron.deployApp(
        platform,
        deviceArg,
        projectPath,
        mode
      );

      if (result.success) {
        toast.success("Deployment Successful", {
          description: result.message,
          duration: TOAST_DURATION,
        });
        addLog("step", `Deployment successful: ${result.message}`);
      } else {
        toast.error("Deployment Failed", {
          description: result.message,
          duration: TOAST_DURATION,
        });
        addLog("error", `Deployment failed: ${result.message}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      const msg = `Deployment failed: ${
        err.message || "An error occurred during deployment"
      }`;
      toast.error("Deployment Failed", {
        description: err.message || "An error occurred during deployment",
        duration: TOAST_DURATION,
      });
      addLog("error", msg);
    } finally {
      setDeploying(false);
      setDeployMode(null);
      await new Promise((resolve) => setTimeout(resolve, LOG_DRAIN_DELAY_MS));
      unsubscribe();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Deploy to TV
        </CardTitle>
        <CardDescription>
          Choose your deployment mode and launch the application on your{" "}
          {platform === "tizen"
            ? "Samsung"
            : platform === "webos"
              ? "LG"
              : "Android"}{" "}
          TV
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => handleDeploy("debug")}
            disabled={deploying}
            className={mergeClassNames(
              "group relative overflow-hidden rounded-lg border-2 p-6 text-left transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
              deployMode === "debug" && deploying
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-950">
                <Bug className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Debug Mode</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deploy with debugging enabled for development
                </p>
              </div>
            </div>
            {deployMode === "debug" && deploying && (
              <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deploying...</span>
              </div>
            )}
          </button>

          <button
            onClick={() => handleDeploy("run")}
            disabled={deploying}
            className={mergeClassNames(
              "group relative overflow-hidden rounded-lg border-2 p-6 text-left transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
              deployMode === "run" && deploying
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-950">
                <Play className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Run Mode</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deploy and run the application in production mode
                </p>
              </div>
            </div>
            {deployMode === "run" && deploying && (
              <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deploying...</span>
              </div>
            )}
          </button>
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={onBack} variant="outline" disabled={deploying}>
            <span className="mr-2">&lt;</span> Back
          </Button>
          <Button onClick={onHome} variant="outline" disabled={deploying}>
            Go Home
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
