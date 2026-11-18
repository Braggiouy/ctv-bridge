import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PathInput } from "@/components/shared/PathInput";
import { PLATFORMS, isWindows } from "@/lib/platforms";
import type { Platform, SdkPaths, ToolCheck } from "@/types";
import { addLog, cn } from "@/utils";

interface SetupFormProps {
  platform: Platform;
  onVerified: (ready: boolean) => void;
}

const Steps = ({ title, steps }: { title: string; steps: string[] }) => (
  <div className="space-y-1">
    <h3 className="text-sm font-medium">{title}</h3>
    <ol className="list-inside list-decimal space-y-0.5 text-sm text-muted-foreground">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  </div>
);

/** SDK install guide plus the tool paths, verified with one click. */
export const SetupForm = ({ platform, onVerified }: SetupFormProps) => {
  const info = PLATFORMS[platform];
  const [paths, setPaths] = useState<SdkPaths>({});
  const [checks, setChecks] = useState<ToolCheck[]>([]);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    void window.electron.sdk.getPaths().then(setPaths);
    setChecks([]);
  }, [platform]);

  const verify = async () => {
    setVerifying(true);
    await window.electron.sdk.savePaths(paths);
    const result = await window.electron.sdk.verify(platform);
    setVerifying(false);
    setChecks(result.tools ?? []);
    onVerified(result.success);
    if (result.success) {
      addLog(
        "step",
        `${info.name} tools found: ${result.tools.map((t) => `${t.tool} ${t.detail}`).join(", ")}`
      );
    } else {
      addLog("error", `Some ${info.name} tools are missing: ${result.message}`);
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <Steps title="Install the SDK" steps={info.sdkSteps} />
        <Steps title="Enable Developer Mode on the TV" steps={info.tvSteps} />
        <div className="flex flex-wrap gap-2">
          {info.links.map((link) => (
            <Button key={link.url} variant="outline" size="sm" asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Tool locations: leave empty if the tools are already on your PATH.
        </p>
        {info.tools.map((tool) => {
          const check = checks.find((c) => c.key === tool.key);
          return (
            <div key={tool.key} className="space-y-1.5">
              <Label htmlFor={tool.key}>{tool.label}</Label>
              <PathInput
                id={tool.key}
                value={paths[tool.key] ?? ""}
                onChange={(value) =>
                  setPaths((current) => ({ ...current, [tool.key]: value }))
                }
                placeholder={
                  isWindows ? tool.placeholder.windows : tool.placeholder.mac
                }
                extensions={isWindows ? tool.windowsExtensions : undefined}
                disabled={verifying}
              />
              {check && (
                <p
                  className={cn(
                    "flex items-start gap-1.5 text-xs",
                    check.ok
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {check.ok ? (
                    <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  )}
                  {check.detail}
                </p>
              )}
            </div>
          );
        })}
        <div className="mt-auto flex justify-end">
          <Button onClick={verify} disabled={verifying}>
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            {verifying ? "Checking tools…" : "Check tools"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const SetupDialog = ({
  open,
  onOpenChange,
  onVerified,
  ...props
}: SetupFormProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{PLATFORMS[props.platform].name} setup</DialogTitle>
        <DialogDescription>
          Where CTV Bridge finds the {PLATFORMS[props.platform].name} tools.
        </DialogDescription>
      </DialogHeader>
      <SetupForm
        {...props}
        onVerified={(ready) => {
          onVerified(ready);
          if (ready) onOpenChange(false);
        }}
      />
    </DialogContent>
  </Dialog>
);
