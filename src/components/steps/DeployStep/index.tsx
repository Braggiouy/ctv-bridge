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
import { toast } from "@/hooks/use-toast";
import { TOAST_DURATION } from "@/utils";
import { cn } from "@/utils";
import { useGlobalLogs } from "@/utils";

interface DeployStepProps {
  onBack: () => void;
  // Removed addLog prop
}

export const DeployStep = (props: DeployStepProps) => {
  const { onBack } = props;
  const { addLog } = useGlobalLogs();
  const platform =
    (localStorage.getItem("platform") as "tizen" | "webos") || "tizen";
  const [deploying, setDeploying] = useState(false);
  const [deployMode, setDeployMode] = useState<"debug" | "run" | null>(null);

  const handleDeploy = async (mode: "debug" | "run") => {
    setDeploying(true);
    setDeployMode(mode);
    addLog("step", `Deploy started: mode=${mode}`);

    const tvIp = localStorage.getItem("tvIp") || "";
    const deviceName = localStorage.getItem("deviceName") || "";
    const projectPath = localStorage.getItem(`${platform}_projectPath`) || "";

    // For webOS, require deviceName; for Tizen, use tvIp
    const deviceArg = platform === "webos" ? deviceName : tvIp;

    if (!deviceArg || !projectPath) {
      const msg =
        "Missing Configuration: Please complete the previous steps first.";
      toast({
        title: "Missing Configuration",
        description: "Please complete the previous steps first.",
        variant: "destructive",
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

      setDeploying(false);
      setDeployMode(null);

      if (result.success) {
        toast({
          title: "Deployment Successful",
          description: result.message,
          duration: TOAST_DURATION,
        });
        addLog("step", `Deployment successful: ${result.message}`);
      } else {
        toast({
          title: "Deployment Failed",
          description: result.message,
          variant: "destructive",
          duration: TOAST_DURATION,
        });
        addLog("error", `Deployment failed: ${result.message}`);
      }
    } catch (error: any) {
      setDeploying(false);
      setDeployMode(null);
      const msg = `Deployment failed: ${
        error.message || "An error occurred during deployment"
      }`;
      toast({
        title: "Deployment Failed",
        description: error.message || "An error occurred during deployment",
        variant: "destructive",
        duration: TOAST_DURATION,
      });
      addLog("error", msg);
    } finally {
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
          {platform === "tizen" ? "Samsung" : "LG"} TV
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => handleDeploy("debug")}
            disabled={deploying}
            className={cn(
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
            className={cn(
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
        </div>
      </CardContent>
    </Card>
  );
};
