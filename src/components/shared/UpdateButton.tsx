import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, RefreshCw, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function UpdateButton() {
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(
    null
  );

  useEffect(() => {
    // Get current version
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((version) => {
        setCurrentVersion(version);
      });
    }

    // Listen for update events
    if (window.electron?.onUpdateAvailable) {
      const unsubAvailable = window.electron.onUpdateAvailable((info) => {
        setUpdateInfo(info);
        setUpdateAvailable(true);
        setChecking(false);
      });

      const unsubError = window.electron.onUpdateError((error: unknown) => {
        const err = error as Error; // Assuming the error object has a message property
        toast.error(`Update check failed: ${err.message || err}`); // Use err.message if available, otherwise the error itself
        setChecking(false);
      });

      return () => {
        unsubAvailable();
        unsubError();
      };
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electron?.checkForUpdates) {
      toast.error("Updates not available in development mode");
      return;
    }

    setChecking(true);
    const result = await window.electron.checkForUpdates();
    setChecking(false);

    if (result && result.version === currentVersion) {
      toast.success("You're already on the latest version! 🎉");
    }
  };

  const handleDownloadUpdate = () => {
    // Open GitHub releases page instead of auto-downloading
    // (auto-update doesn't work without code signing on macOS)
    const repoUrl = "https://github.com/Braggiouy/ctv-bridge/releases/latest";
    window.open(repoUrl, "_blank");
    setUpdateAvailable(false);
    toast.info("Opening releases page in browser...");
  };

  const getButtonContent = () => {
    if (checking) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    return <Download className="h-4 w-4" />;
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCheckForUpdates}
                disabled={checking}
                className="h-9 w-9 relative transition-all hover:bg-accent"
              >
                {getButtonContent()}
              </Button>
              {/* Update available indicator */}
              {!checking && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-medium">
                {checking ? "Checking for updates..." : "Check for Updates"}
              </p>
              <p className="text-xs text-muted-foreground">v{currentVersion}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={updateAvailable} onOpenChange={setUpdateAvailable}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <AlertDialogTitle className="text-xl">
                New Update Available!
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Current Version
                  </p>
                  <p className="text-lg font-bold text-muted-foreground">
                    v{currentVersion}
                  </p>
                </div>
                <div className="text-muted-foreground">→</div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    New Version
                  </p>
                  <p className="text-lg font-bold text-primary">
                    v{updateInfo?.version}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Click "Update Now" to open the releases page and download the
                latest version.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-2">
            <AlertDialogCancel>Maybe Later</AlertDialogCancel>
            <AlertDialogAction onClick={handleDownloadUpdate} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Update Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
