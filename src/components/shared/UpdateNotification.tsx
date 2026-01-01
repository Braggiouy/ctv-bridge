import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, RefreshCw, X } from "lucide-react";

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(
    null
  );
  const [downloading, setDownloading] = useState(false);
  const [readyToInstall, setReadyToInstall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Listen for update events
    const unsubAvailable = window.electron.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setDismissed(false);
    });

    const unsubDownloaded = window.electron.onUpdateDownloaded(() => {
      setDownloading(false);
      setReadyToInstall(true);
    });

    const unsubError = window.electron.onUpdateError((err) => {
      setError(err);
      setDownloading(false);
    });

    return () => {
      unsubAvailable();
      unsubDownloaded();
      unsubError();
    };
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    const result = await window.electron.downloadUpdate();
    if (!result.success) {
      setError(result.error || "Failed to download update");
      setDownloading(false);
    }
  };

  const handleInstall = () => {
    window.electron.installUpdate();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!updateInfo || dismissed) return null;

  return (
    <Alert className="fixed bottom-4 right-4 w-96 shadow-lg border-2 z-index-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <AlertTitle className="flex items-center gap-2">
            {readyToInstall ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Update Ready!
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Update Available
              </>
            )}
          </AlertTitle>
          <AlertDescription className="mt-2">
            {readyToInstall ? (
              <div className="space-y-2">
                <p>Version {updateInfo.version} is ready to install.</p>
                <p className="text-sm text-muted-foreground">
                  The app will restart to complete the update.
                </p>
                <Button onClick={handleInstall} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Restart & Update
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p>Version {updateInfo.version} is available.</p>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download Update
                    </>
                  )}
                </Button>
              </div>
            )}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-2"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
