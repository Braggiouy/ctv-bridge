import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";

interface TizenSetupProps {
  sdbPath: string;
  tizenPath: string;
  onSdbPathChange: (path: string) => void;
  onTizenPathChange: (path: string) => void;
}

/**
 * Tizen SDK configuration component
 */
export const TizenSetup = ({
  sdbPath,
  tizenPath,
  onSdbPathChange,
  onTizenPathChange,
}: TizenSetupProps) => {
  return (
    <div className="space-y-4 mt-6">
      <Alert>
        <AlertDescription className="space-y-2">
          <p className="font-medium">First time setup:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Download Tizen Studio from Samsung Developer</li>
            <li>Install and note the installation directory</li>
            <li>Locate the tools in the installation folder</li>
          </ol>
          <Button variant="link" className="h-auto p-0 text-sm" asChild>
            <a
              href="https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Tizen Studio{" "}
              <ExternalLink className="ml-1 h-3 w-3 inline" />
            </a>
          </Button>
        </AlertDescription>
      </Alert>

      <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <AlertDescription>
          <p className="font-medium text-green-900 dark:text-green-100 mb-2">
            ℹ️ SDK Path Configuration
          </p>
          <p className="text-sm text-green-800 dark:text-green-200">
            Enter the <strong>full path</strong> to each binary file below. No
            need to add anything to your system PATH.
          </p>
          <p className="text-xs text-green-700 dark:text-green-300 mt-2">
            The app will use these exact paths when running Tizen commands.
          </p>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="sdbPath">SDB Path</Label>
        <Input
          id="sdbPath"
          placeholder="/path/to/tizen-studio/tools/sdb"
          value={sdbPath}
          onChange={(e) => onSdbPathChange(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Example (macOS/Linux):{" "}
          <code className="text-xs">
            /Users/yourname/tizen-studio/tools/sdb
          </code>
          <br />
          Example (Windows):{" "}
          <code className="text-xs">C:\tizen-studio\tools\sdb.exe</code>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tizenPath">Tizen CLI Path</Label>
        <Input
          id="tizenPath"
          placeholder="/path/to/tizen-studio/tools/ide/bin/tizen"
          value={tizenPath}
          onChange={(e) => onTizenPathChange(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Example (macOS/Linux):{" "}
          <code className="text-xs">
            /Users/yourname/tizen-studio/tools/ide/bin/tizen
          </code>
          <br />
          Example (Windows):{" "}
          <code className="text-xs">
            C:\tizen-studio\tools\ide\bin\tizen.bat
          </code>
        </p>
      </div>
    </div>
  );
};
