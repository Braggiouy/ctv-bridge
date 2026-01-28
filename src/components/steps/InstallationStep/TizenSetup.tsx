import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Lightbulb, Info, Settings2 } from "lucide-react";
import { isWindows } from "@/utils";

interface TizenSetupProps {
  sdbPath: string;
  tizenPath: string;
  onSdbPathChange: (path: string) => void;
  onTizenPathChange: (path: string) => void;
}

/**
 * Tizen Studio configuration and onboarding component
 */
export const TizenSetup = ({
  sdbPath,
  tizenPath,
  onSdbPathChange,
  onTizenPathChange,
}: TizenSetupProps) => {
  const win = isWindows();

  return (
    <div className="space-y-6 mt-6">
      {/* Step 1: External Requirements */}
      <Alert className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30">
        <AlertDescription className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-100">
            <Info className="h-4 w-4" />
            <span>Getting Started</span>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>
              Download and install <strong>Tizen Studio</strong>
            </li>
            <li>
              Launch <strong>Package Manager</strong> to install the Main SDK
            </li>
            <li>
              Create a <strong>Samsung Certificate</strong> (see Tip below)
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
                href="https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Tizen Studio{" "}
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
                href="https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Certificate Guide <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Helpful Tip Section */}
      <Alert className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900">
        <AlertDescription className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1 bg-amber-100 dark:bg-amber-900/60 rounded-full">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                The "Security Pass"
              </p>
              <p className="text-sm text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
                Samsung TVs only run apps with a "Security Pass" (Certificate)
                linked to their unique ID (DUID). You only need to set this up
                once in Tizen Studio.
              </p>
            </div>
          </div>

          <div className="text-xs space-y-2.5 bg-white/40 dark:bg-black/20 p-3 rounded-md border border-amber-200/50 dark:border-amber-900/50">
            <p className="font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100 opacity-70">
              One-Time Action (In Tizen Studio):
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-amber-800 dark:text-amber-200">
              <li className="flex gap-2">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  1.
                </span>
                <span>
                  Open <strong>Certificate Manager</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  2.
                </span>
                <span>
                  Select <strong>Samsung</strong> profile
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  3.
                </span>
                <span>
                  Add your TV's <strong>DUID</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  4.
                </span>
                <span>Save and close Studio</span>
              </li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Path Configuration */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">SDK Path Configuration</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="sdbPath"
              className="text-xs font-medium uppercase tracking-wider opacity-70"
            >
              SDB Path
            </Label>
            <Input
              id="sdbPath"
              placeholder={
                win
                  ? "C:\\tizen-studio\\tools\\sdb.exe"
                  : "/Users/name/tizen-studio/tools/sdb"
              }
              value={sdbPath}
              onChange={(e) => onSdbPathChange(e.target.value)}
              className="font-mono text-sm bg-muted/30 focus-visible:ring-blue-500"
            />
            <p className="text-[11px] text-muted-foreground italic">
              Expected:{" "}
              {win ? (
                <code>...\\tools\\sdb.exe</code>
              ) : (
                <code>.../tools/sdb</code>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="tizenPath"
              className="text-xs font-medium uppercase tracking-wider opacity-70"
            >
              Tizen CLI Path
            </Label>
            <Input
              id="tizenPath"
              placeholder={
                win
                  ? "C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat"
                  : "/Users/name/tizen-studio/tools/ide/bin/tizen"
              }
              value={tizenPath}
              onChange={(e) => onTizenPathChange(e.target.value)}
              className="font-mono text-sm bg-muted/30 focus-visible:ring-blue-500"
            />
            <p className="text-[11px] text-muted-foreground italic">
              Expected:{" "}
              {win ? (
                <code>...\\ide\\bin\\tizen.bat</code>
              ) : (
                <code>.../ide/bin/tizen</code>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
