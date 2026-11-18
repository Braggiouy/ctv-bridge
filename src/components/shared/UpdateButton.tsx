import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type UpdateState =
  | { phase: "idle" | "checking" }
  | { phase: "available"; version: string }
  | { phase: "downloading"; version: string; percent: number }
  | { phase: "ready"; version: string };

// Each version is announced once, not on every periodic check.
const NOTIFIED_KEY = "ctv-bridge:update-notified";

const releaseUrl = (version: string) =>
  `https://github.com/Braggiouy/ctv-bridge/releases/tag/v${version}`;

function firstNotice(version: string): boolean {
  try {
    if (localStorage.getItem(NOTIFIED_KEY) === version) return false;
    localStorage.setItem(NOTIFIED_KEY, version);
  } catch {
    // Storage unavailable: announcing again is harmless.
  }
  return true;
}

export function UpdateButton() {
  const [currentVersion, setCurrentVersion] = useState("");
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const { updater } = window.electron;

  const install = useCallback(() => void updater.install(), [updater]);

  const download = useCallback(
    async (version: string) => {
      setState({ phase: "downloading", version, percent: 0 });
      const result = await updater.download();
      if (!result.success) {
        setState({ phase: "available", version });
        toast.error("Update failed", { description: result.message });
      } else if (result.manual) {
        setState({ phase: "available", version });
        toast.info(
          result.manual === "installer"
            ? "Installer opened. Drag CTV Bridge into Applications to finish."
            : "Download the new version from the release page."
        );
      }
      // Otherwise onReady takes over.
    },
    [updater]
  );

  useEffect(() => {
    void updater.getVersion().then(setCurrentVersion);

    const offAvailable = updater.onAvailable(({ version }) => {
      setState((current) =>
        current.phase === "downloading" || current.phase === "ready"
          ? current
          : { phase: "available", version }
      );
      if (!firstNotice(version)) return;
      toast(`CTV Bridge ${version} is available`, {
        duration: 15000,
        action: { label: "Update", onClick: () => void download(version) },
        cancel: {
          label: "What's new",
          onClick: () => void window.electron.openExternal(releaseUrl(version)),
        },
      });
    });
    const offProgress = updater.onProgress((percent) =>
      setState((current) =>
        current.phase === "available" || current.phase === "downloading"
          ? { phase: "downloading", version: current.version, percent }
          : current
      )
    );
    const offReady = updater.onReady(({ version }) => {
      setState({ phase: "ready", version });
      toast.success(`CTV Bridge ${version} is ready`, {
        description: "Restart now, or it installs the next time you quit.",
        duration: Infinity,
        action: { label: "Restart", onClick: install },
      });
    });
    return () => {
      offAvailable();
      offProgress();
      offReady();
    };
  }, [updater, download, install]);

  const handleClick = async () => {
    if (state.phase === "available") return download(state.version);
    if (state.phase === "ready") return install();
    if (state.phase !== "idle") return;

    setState({ phase: "checking" });
    const result = await updater.check();
    if (!result.success) {
      setState({ phase: "idle" });
      toast.error("Couldn't check for updates", {
        description: result.message,
      });
    } else if (!result.version) {
      setState({ phase: "idle" });
      toast.success("You're on the latest version.");
    }
    // A newer version arrives through onAvailable.
  };

  const label = {
    idle: "Check for updates",
    checking: "Checking for updates…",
    available: `Update to ${"version" in state ? state.version : ""}`,
    downloading: `Downloading update… ${"percent" in state ? state.percent : 0}%`,
    ready: "Restart to update",
  }[state.phase];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={state.phase === "checking" || state.phase === "downloading"}
          className="relative h-9 w-9"
          aria-label={label}
        >
          {state.phase === "checking" || state.phase === "downloading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state.phase === "ready" ? (
            <RotateCw className="h-4 w-4 text-primary" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {(state.phase === "available" || state.phase === "ready") && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">v{currentVersion}</p>
      </TooltipContent>
    </Tooltip>
  );
}
