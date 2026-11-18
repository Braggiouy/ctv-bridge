import { useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PathInput } from "@/components/shared/PathInput";
import { StepCard } from "@/components/shared/StepCard";
import { PLATFORMS, isWindows } from "@/lib/platforms";
import type { Platform, SdkPaths, ToolCheck } from "@/types";
import { addLog, cn, notify } from "@/utils";

interface InstallationStepProps {
  platform: Platform;
  sdkReady: boolean;
  onVerified: (ready: boolean) => void;
  onNext: () => void;
}

const Section = ({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
        aria-expanded={open}
      >
        {title}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t px-4 py-3 text-sm">{children}</div>}
    </div>
  );
};

export const InstallationStep = ({
  platform,
  sdkReady,
  onVerified,
  onNext,
}: InstallationStepProps) => {
  const info = PLATFORMS[platform];
  const [paths, setPaths] = useState<SdkPaths>({});
  const [checks, setChecks] = useState<ToolCheck[]>([]);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    void window.electron.sdk.getPaths().then(setPaths);
    setChecks([]);
  }, [platform]);

  const verifyAndContinue = async () => {
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
      onNext();
    } else {
      notify.error("Some tools could not be found", result.message);
    }
  };

  return (
    <StepCard
      title={`Set up ${info.name}`}
      description="Install the vendor SDK once, enable Developer Mode on the TV, then let CTV Bridge find the tools."
      actions={
        <Button onClick={verifyAndContinue} disabled={verifying}>
          {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
          {verifying ? "Checking tools…" : "Check tools & continue"}
        </Button>
      }
    >
      <Section title="1. Install the SDK" defaultOpen={!sdkReady}>
        <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
          {info.sdkSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          {info.links.map((link) => (
            <Button key={link.url} variant="outline" size="sm" asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ))}
        </div>
      </Section>

      <Section
        title="2. Enable Developer Mode on the TV"
        defaultOpen={!sdkReady}
      >
        <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
          {info.tvSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">3. Tool locations</h3>
          <p className="text-xs text-muted-foreground">
            Leave empty if the tools are already on your PATH.
          </p>
        </div>
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
      </div>
    </StepCard>
  );
};
