import { useCallback, useEffect, useState } from "react";
import { Github, Tv2 } from "lucide-react";
import { Footer } from "@/components/shared/Footer";
import { LogViewer } from "@/components/shared/LogViewer";
import { StepIndicator } from "@/components/shared/StepIndicator";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { UpdateButton } from "@/components/shared/UpdateButton";
import { BuildStep } from "@/components/steps/BuildStep";
import { DeployStep } from "@/components/steps/DeployStep";
import { DeviceSetupStep } from "@/components/steps/DeviceSetupStep";
import { InstallationStep } from "@/components/steps/InstallationStep";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePersistentState } from "@/hooks/usePersistentState";
import { PLATFORM_LIST } from "@/lib/platforms";
import {
  EMPTY_WORKFLOW,
  PLATFORM_KEY,
  furthestStep,
  workflowKey,
  type Workflow,
} from "@/lib/workflow";
import type { Device, Platform } from "@/types";
import { addLog, cn } from "@/utils";

const DeploymentWorkflow = () => {
  const [platform, setPlatform] = usePersistentState<Platform>(
    PLATFORM_KEY,
    "tizen"
  );
  const [workflow, setWorkflow] = usePersistentState<Workflow>(
    workflowKey(platform),
    EMPTY_WORKFLOW
  );
  const furthest = furthestStep(workflow);
  // Returning users land where they left off instead of re-doing setup.
  const [step, setStep] = useState(() => Math.min(furthest, 3));

  const updateWorkflow = useCallback(
    (patch: Partial<Workflow>) =>
      setWorkflow((current) => ({ ...current, ...patch })),
    [setWorkflow]
  );

  useEffect(
    () => window.electron.onDeployLog((line) => addLog("log", line)),
    []
  );

  const switchPlatform = (next: Platform) => {
    if (next === platform) return;
    const nextWorkflow = JSON.parse(
      localStorage.getItem(workflowKey(next)) ?? "null"
    ) as Workflow | null;
    setPlatform(next);
    setStep(Math.min(furthestStep(nextWorkflow ?? EMPTY_WORKFLOW), 3));
  };

  const selectDevice = (device: Device) => {
    updateWorkflow({ device });
    setStep(3);
  };

  const knownDuids = workflow.device?.duid ? [workflow.device.duid] : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Tv2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">CTV Bridge</span>
          </div>

          <div
            role="tablist"
            aria-label="Platform"
            className="mx-auto flex rounded-lg bg-muted p-1"
          >
            {PLATFORM_LIST.map((info) => (
              <button
                key={info.id}
                role="tab"
                aria-selected={platform === info.id}
                onClick={() => switchPlatform(info.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  platform === info.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {info.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://github.com/Braggiouy/ctv-bridge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
                  aria-label="View on GitHub"
                >
                  <Github className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom">View on GitHub</TooltipContent>
            </Tooltip>
            <UpdateButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <StepIndicator
          currentStep={step}
          furthestStep={furthest}
          onStepClick={setStep}
        />

        {step === 1 && (
          <InstallationStep
            platform={platform}
            sdkReady={workflow.sdkReady}
            onVerified={(sdkReady) => updateWorkflow({ sdkReady })}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <DeviceSetupStep
            platform={platform}
            selectedDevice={workflow.device}
            onSelect={selectDevice}
            onSelectionChange={(device) => updateWorkflow({ device })}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <BuildStep
            platform={platform}
            workflow={workflow}
            updateWorkflow={updateWorkflow}
            knownDuids={knownDuids}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <DeployStep
            platform={platform}
            workflow={workflow}
            onChangeDevice={() => setStep(2)}
            onChangePackage={() => setStep(3)}
            onBack={() => setStep(3)}
          />
        )}

        <LogViewer />
      </main>

      <Footer />
    </div>
  );
};

export default DeploymentWorkflow;
