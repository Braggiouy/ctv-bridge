import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Lightbulb,
  Info,
  Settings2,
  Command,
  FolderOpen,
} from "lucide-react";
import { isWindows } from "@/utils";
import { SetupAlert } from "./SetupAlert";

interface AndroidSetupProps {
  adbPath: string;
  onAdbPathChange: (path: string) => void;
}

/**
 * Android ADB configuration and onboarding component
 */
export const AndroidSetup = ({
  adbPath,
  onAdbPathChange,
}: AndroidSetupProps) => {
  const win = isWindows();

  const handleBrowse = async () => {
    try {
      const path = (await window.electron.invoke(
        "select-file",
        win ? [{ name: "Executable", extensions: ["exe"] }] : []
      )) as string | null;
      if (path) onAdbPathChange(path);
    } catch (error) {
      console.error("Failed to select file:", error);
    }
  };

  return (
    <div className="space-y-6 mt-6 animate-in fade-in-50">
      {/* Step 1: External Requirements */}
      {/* Step 1: External Requirements */}
      <SetupAlert
        title="Getting Started"
        icon={Info}
        variant="blue"
        defaultOpen={true}
      >
        <div className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>
              Download <strong>Android Platform Tools</strong> (ADB)
            </li>
            <li>
              Enable <strong>Developer Options</strong> on your Android TV
            </li>
            <li>
              Turn on <strong>USB Debugging</strong> (or Network Debugging)
            </li>
          </ol>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-white dark:bg-slate-900"
              asChild
            >
              <a
                href="https://developer.android.com/tools/releases/platform-tools"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Platform Tools{" "}
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-white dark:bg-slate-900"
              asChild
            >
              <a
                href="https://developer.android.com/tv/games/debug"
                target="_blank"
                rel="noopener noreferrer"
              >
                Debugging Guide <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </SetupAlert>

      <SetupAlert title="ADB CLI Tools" icon={Command} variant="slate">
        <p className="text-sm text-slate-800/90 dark:text-slate-300 leading-relaxed">
          The <code>adb</code> command is the bridge that connects your computer
          to your Android TV. It is usually found in the{" "}
          <code>platform-tools</code> folder of your SDK installation.
        </p>
      </SetupAlert>

      {/* Helpful Tip Section */}
      <SetupAlert
        title="Enabling Developer Mode"
        icon={Lightbulb}
        variant="amber"
      >
        <div className="space-y-4">
          <p className="text-sm text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
            Most Android TVs hide developer options. You must enable them to
            connect via ADB.
          </p>

          <div className="text-xs space-y-2.5 bg-white/40 dark:bg-black/20 p-3 rounded-md border border-amber-200/50 dark:border-amber-900/50">
            <p className="font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100 opacity-70">
              How to enable:
            </p>
            <ul className="grid grid-cols-1 gap-2 text-amber-800 dark:text-amber-200">
              <li className="flex gap-2">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  1.
                </span>
                <span>
                  Go to{" "}
                  <strong>
                    Settings {">"} Device Preferences {">"} About
                  </strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  2.
                </span>
                <span>
                  Scroll down to <strong>Build</strong> and click it{" "}
                  <strong>7 times</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  3.
                </span>
                <span>
                  Go back, open <strong>Developer Options</strong>, and enable{" "}
                  <strong>USB Debugging</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </SetupAlert>

      {/* Path Configuration */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">SDK Path Configuration</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="adb-path"
              className="text-xs font-medium uppercase tracking-wider opacity-70"
            >
              ADB Path
            </Label>
            <div className="flex gap-2">
              <Input
                id="adb-path"
                placeholder={
                  win
                    ? "C:\\Users\\name\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe"
                    : "/Users/name/Library/Android/sdk/platform-tools/adb"
                }
                value={adbPath}
                onChange={(e) => onAdbPathChange(e.target.value)}
                className="font-mono text-sm bg-muted/30 focus-visible:ring-blue-500"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowse}
                title="Browse for ADB executable"
                type="button"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              Expected:{" "}
              {win ? (
                <code>...\\platform-tools\\adb.exe</code>
              ) : (
                <code>.../platform-tools/adb</code>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
