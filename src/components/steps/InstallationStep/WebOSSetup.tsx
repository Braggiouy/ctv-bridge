import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Info, Settings2, Command } from "lucide-react";
import { isWindows } from "@/utils/platform";

interface WebOSSetupProps {
  aresPath: string;
  onAresPathChange: (path: string) => void;
}

/**
 * webOS TV SDK configuration and onboarding component
 */
export const WebOSSetup = ({ aresPath, onAresPathChange }: WebOSSetupProps) => {
  const win = isWindows();

  return (
    <div className="space-y-6 mt-6">
      {/* Step 1: External Requirements */}
      <Alert className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30">
        <AlertDescription className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-green-900 dark:text-green-100">
            <Info className="h-4 w-4" />
            <span>Getting Started</span>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-green-800 dark:text-green-200">
            <li>
              Download and install the <strong>webOS TV SDK</strong>
            </li>
            <li>
              Launch <strong>Component Management</strong> to install the CLI
              tools
            </li>
            <li>
              Note the installation path for the <code>ares</code> commands
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
                href="https://webostv.developer.lge.com/develop/tools/cli-installation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download webOS TV SDK{" "}
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Helpful Tip Section */}
      <Alert className="bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
        <AlertDescription className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-full">
              <Command className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Ares CLI Tools
              </p>
              <p className="text-sm text-slate-800/90 dark:text-slate-300 leading-relaxed">
                The <code>ares</code> commands are the engine that powers app
                deployment. They are usually found in the <code>CLI/bin</code>{" "}
                folder of your SDK installation.
              </p>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Path Configuration */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">SDK Path Configuration</h3>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="aresPath"
            className="text-xs font-medium uppercase tracking-wider opacity-70"
          >
            webOS CLI Path (ares)
          </Label>
          <Input
            id="aresPath"
            placeholder={
              win
                ? "C:\\webOS_TV_SDK\\CLI\\bin\\ares.exe"
                : "/Users/name/webOS_TV_SDK/CLI/bin/ares"
            }
            value={aresPath}
            onChange={(e) => onAresPathChange(e.target.value)}
            className="font-mono text-sm bg-muted/30 focus-visible:ring-green-500"
          />
          <p className="text-[11px] text-muted-foreground italic">
            Expected:{" "}
            {win ? (
              <code>...\\CLI\\bin\\ares.exe</code>
            ) : (
              <code>.../CLI/bin/ares</code>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
