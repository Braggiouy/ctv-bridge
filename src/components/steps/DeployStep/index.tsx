import { useState } from "react";
import {
  Bug,
  CheckCircle2,
  Loader2,
  Package,
  Play,
  Tv,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/shared/StepCard";
import { PLATFORMS } from "@/lib/platforms";
import type { Workflow } from "@/lib/workflow";
import type { DeployMode, Platform } from "@/types";
import { addLog, cn, notify } from "@/utils";

interface DeployStepProps {
  platform: Platform;
  workflow: Workflow;
  onChangeDevice: () => void;
  onChangePackage: () => void;
  onBack: () => void;
}

const MODES: {
  mode: DeployMode;
  title: string;
  description: string;
  icon: typeof Play;
}[] = [
  {
    mode: "run",
    title: "Install & run",
    description: "Install the package and launch it on the TV.",
    icon: Play,
  },
  {
    mode: "debug",
    title: "Install & debug",
    description:
      "Launch with the web inspector attached so you can debug in Chrome.",
    icon: Bug,
  },
];

const SummaryRow = ({
  icon: Icon,
  label,
  value,
  onChange,
  disabled,
}: {
  icon: typeof Tv;
  label: string;
  value: string;
  onChange: () => void;
  disabled: boolean;
}) => (
  <div className="flex items-center gap-3">
    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
    <Button variant="ghost" size="sm" onClick={onChange} disabled={disabled}>
      Change
    </Button>
  </div>
);

export const DeployStep = ({
  platform,
  workflow,
  onChangeDevice,
  onChangePackage,
  onBack,
}: DeployStepProps) => {
  const info = PLATFORMS[platform];
  const { device, projectPath, packagePath } = workflow;
  const [deploying, setDeploying] = useState<DeployMode | null>(null);
  const [outcome, setOutcome] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const deploy = async (mode: DeployMode) => {
    if (!device || !packagePath) return;
    setDeploying(mode);
    setOutcome(null);
    addLog("info", `Deploying to ${device.name || device.ip} (${mode})…`, true);

    try {
      const result = await window.electron.deploy(
        platform,
        device,
        { projectPath, packagePath },
        mode
      );
      const message =
        result.message ?? (result.success ? "Done" : "Deployment failed");
      setOutcome({ success: result.success, message });
      if (result.success) notify.success(message);
      else notify.error("Deployment failed", message);
    } finally {
      setDeploying(null);
    }
  };

  return (
    <StepCard
      title={`Deploy to your ${info.tvName}`}
      description="Install the package on the TV. Deploy again any time after rebuilding."
      onBack={onBack}
      busy={!!deploying}
    >
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <SummaryRow
          icon={Tv}
          label="TV"
          value={
            device
              ? `${device.name || device.ip} (${device.ip})`
              : "None selected"
          }
          onChange={onChangeDevice}
          disabled={!!deploying}
        />
        <SummaryRow
          icon={Package}
          label="Package"
          value={packagePath ?? "Not built yet"}
          onChange={onChangePackage}
          disabled={!!deploying}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODES.map(({ mode, title, description, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => deploy(mode)}
            disabled={!!deploying || !device || !packagePath}
            className={cn(
              "flex items-start gap-4 rounded-lg border-2 p-5 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
              deploying === mode
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            <div className="rounded-full bg-primary/10 p-3">
              {deploying === mode ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Icon className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-medium">
                {deploying === mode ? "Deploying…" : title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {outcome && (
        <div
          className={cn(
            "flex gap-2 rounded-lg border p-3 text-sm",
            outcome.success
              ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
          )}
        >
          {outcome.success ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="whitespace-pre-wrap">
            {outcome.message}
            {!outcome.success && " See the activity log below for details."}
          </span>
        </div>
      )}
    </StepCard>
  );
};
