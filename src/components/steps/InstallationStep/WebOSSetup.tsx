import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";

interface WebOSSetupProps {
  aresPath: string;
  onAresPathChange: (path: string) => void;
}

/**
 * webOS SDK configuration component
 */
export const WebOSSetup = ({ aresPath, onAresPathChange }: WebOSSetupProps) => {
  return (
    <div className="space-y-4 mt-6">
      <Alert>
        <AlertDescription className="space-y-2">
          <p className="font-medium">First time setup:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Download webOS TV SDK from LG Developer</li>
            <li>Install and note the installation directory</li>
            <li>Locate the CLI tools (ares commands)</li>
          </ol>
          <Button variant="link" className="h-auto p-0 text-sm" asChild>
            <a
              href="https://webostv.developer.lge.com/develop/tools/cli-installation"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download webOS TV SDK{" "}
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
            Enter the <strong>full path</strong> to the ares binary below. No
            need to add anything to your system PATH.
          </p>
          <p className="text-xs text-green-700 dark:text-green-300 mt-2">
            The app will use this exact path when running webOS commands.
          </p>
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="aresPath">webOS CLI Path</Label>
        <Input
          id="aresPath"
          placeholder="/path/to/webOS_TV_SDK/CLI/bin/ares"
          value={aresPath}
          onChange={(e) => onAresPathChange(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Example (macOS/Linux):{" "}
          <code className="text-xs">
            /Users/yourname/webOS_TV_SDK/CLI/bin/ares
          </code>
          <br />
          Example (Windows):{" "}
          <code className="text-xs">
            C:\Users\yourname\webOS_TV_SDK\CLI\bin\ares.exe
          </code>
        </p>
      </div>
    </div>
  );
};
