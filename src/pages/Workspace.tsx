import { useCallback, useEffect, useRef, useState } from "react";
import { Github, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeviceList } from "@/components/devices/DeviceList";
import type { ConnectionStatus } from "@/components/devices/status";
import { ProjectPanel } from "@/components/project/ProjectPanel";
import { SetupDialog, SetupForm } from "@/components/setup/Setup";
import { AppTitle } from "@/components/shared/About";
import { Console } from "@/components/shared/Console";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { UpdateButton } from "@/components/shared/UpdateButton";
import { useDevices } from "@/hooks/useDevices";
import { usePersistentState } from "@/hooks/usePersistentState";
import { PLATFORM_LIST, PLATFORMS } from "@/lib/platforms";
import {
  EMPTY_WORKFLOW,
  PLATFORM_KEY,
  workflowKey,
  type Workflow,
} from "@/lib/workflow";
import type { Device, Platform } from "@/types";
import { addLog, cn } from "@/utils";
import { REPO_URL } from "../../shared/links";

const HeaderIcon = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom">{label}</TooltipContent>
  </Tooltip>
);

const Workspace = () => {
  const [platform, setPlatform] = usePersistentState<Platform>(
    PLATFORM_KEY,
    "tizen"
  );
  const [workflow, setWorkflow] = usePersistentState<Workflow>(
    workflowKey(platform),
    EMPTY_WORKFLOW
  );
  const devices = useDevices(platform);
  const [status, setStatus] = useState<ConnectionStatus>();
  const [setupOpen, setSetupOpen] = useState(false);
  const latestCheck = useRef(0);

  const updateWorkflow = useCallback(
    (patch: Partial<Workflow>) =>
      setWorkflow((current) => ({ ...current, ...patch })),
    [setWorkflow]
  );

  useEffect(
    () => window.electron.onDeployLog((line) => addLog("log", line)),
    []
  );

  const checkConnection = useCallback(
    async (device: Device) => {
      const check = ++latestCheck.current;
      setStatus({ state: "checking" });
      const result = await window.electron.devices.test(platform, device);
      if (check !== latestCheck.current) return;
      if (result.success) {
        setStatus({ state: "connected" });
        addLog("step", result.message ?? `Connected to ${device.name}`);
        if (result.duid && result.duid !== device.duid) {
          updateWorkflow({ device: { ...device, duid: result.duid } });
        }
      } else {
        const message = result.message ?? "Connection failed";
        setStatus({ state: "failed", message });
        addLog(
          "error",
          `Connection to ${device.name || device.ip} failed: ${message}`
        );
      }
    },
    [platform, updateWorkflow]
  );

  const cancelCheck = () => {
    latestCheck.current++;
    setStatus({ state: "failed", message: "Connection check cancelled" });
  };

  // Check the remembered TV once per platform, so its status is current.
  const { sdkReady, device } = workflow;
  const checkedPlatform = useRef<Platform | null>(null);
  useEffect(() => {
    if (!sdkReady || !device || checkedPlatform.current === platform) return;
    checkedPlatform.current = platform;
    void checkConnection(device);
  }, [platform, sdkReady, device, checkConnection]);

  const switchPlatform = (next: Platform) => {
    if (next === platform) return;
    latestCheck.current++;
    setStatus(undefined);
    setPlatform(next);
  };

  const selectDevice = (next: Device) => {
    updateWorkflow({ device: next });
    void checkConnection(next);
  };

  const changeSelection = (next: Device | undefined) => {
    latestCheck.current++;
    setStatus(undefined);
    updateWorkflow({ device: next });
  };

  const knownDuids = [
    ...new Set(
      devices.devices.map((d) => d.duid).filter((d): d is string => !!d)
    ),
  ];

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_clamp(7rem,24vh,12rem)] bg-background">
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <AppTitle />

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
          <HeaderIcon label={`${PLATFORMS[platform].name} setup`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSetupOpen(true)}
              aria-label="Setup"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </HeaderIcon>
          <HeaderIcon label="View on GitHub">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              aria-label="View on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </HeaderIcon>
          <UpdateButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[16rem_1fr]">
        <DeviceList
          platform={platform}
          devices={devices}
          selected={workflow.device}
          status={status}
          onSelect={selectDevice}
          onSelectionChange={changeSelection}
        />
        <main className="min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-3xl">
            {workflow.sdkReady ? (
              <ProjectPanel
                key={platform}
                platform={platform}
                workflow={workflow}
                updateWorkflow={updateWorkflow}
                status={workflow.device ? status : undefined}
                onRetryConnection={() =>
                  workflow.device && void checkConnection(workflow.device)
                }
                onCancelConnection={cancelCheck}
                knownDuids={knownDuids}
              />
            ) : (
              <section className="space-y-4 p-5">
                <div>
                  <h1 className="text-lg font-semibold">
                    Set up {PLATFORMS[platform].name}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    One-time step: install the SDK, enable Developer Mode on the
                    TV, then let CTV Bridge check the tools.
                  </p>
                </div>
                <SetupForm
                  platform={platform}
                  onVerified={(ready) => updateWorkflow({ sdkReady: ready })}
                />
              </section>
            )}
          </div>
        </main>
      </div>

      <Console />

      <SetupDialog
        platform={platform}
        open={setupOpen && workflow.sdkReady}
        onOpenChange={setSetupOpen}
        onVerified={(ready) => updateWorkflow({ sdkReady: ready })}
      />
    </div>
  );
};

export default Workspace;
