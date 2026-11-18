import { useState } from "react";
import { Plus, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StepCard } from "@/components/shared/StepCard";
import { useDevices } from "@/hooks/useDevices";
import { PLATFORMS } from "@/lib/platforms";
import type { Device, Platform } from "@/types";
import { DeviceCard } from "./DeviceCard";
import { DeviceForm } from "./DeviceForm";

interface DeviceSetupStepProps {
  platform: Platform;
  selectedDevice?: Device;
  /** Select a TV and move on to the next step. */
  onSelect: (device: Device) => void;
  /** Keep the stored selection in sync after an edit or removal, without navigating. */
  onSelectionChange: (device: Device | undefined) => void;
  onBack: () => void;
}

const sameDevice = (a?: Device, b?: Device) =>
  !!a && !!b && a.ip === b.ip && a.name === b.name;

export const DeviceSetupStep = ({
  platform,
  selectedDevice,
  onSelect,
  onSelectionChange,
  onBack,
}: DeviceSetupStepProps) => {
  const { devices, loading, refresh, add, update, remove } =
    useDevices(platform);
  const [editing, setEditing] = useState<Device | "new" | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Device | null>(null);
  const info = PLATFORMS[platform];

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    const device = pendingRemoval;
    setPendingRemoval(null);
    if ((await remove(device)) && sameDevice(device, selectedDevice)) {
      onSelectionChange(undefined);
    }
  };

  const handleUpdate = async (previous: Device, next: Device) => {
    const saved = await update(previous, next);
    if (saved && sameDevice(previous, selectedDevice)) onSelectionChange(next);
    return saved;
  };

  return (
    <StepCard
      title={`Choose your ${info.tvName}`}
      description={`Add the TV once; CTV Bridge remembers it. Make sure Developer Mode is on and the TV is on the same network.`}
      onBack={onBack}
      actions={
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-3">
        {loading && devices.length === 0 ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : devices.length === 0 && editing !== "new" ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <WifiOff className="mx-auto mb-2 h-8 w-8 opacity-50" />
            No TVs yet. Add one to get started.
          </div>
        ) : (
          devices.map((device) =>
            editing !== "new" && sameDevice(editing ?? undefined, device) ? (
              <DeviceForm
                key={device.ip + device.name}
                platform={platform}
                device={device}
                onSubmit={(next) => handleUpdate(device, next)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <DeviceCard
                key={device.ip + device.name}
                device={device}
                platform={platform}
                selected={sameDevice(device, selectedDevice)}
                onUse={onSelect}
                onEdit={() => setEditing(device)}
                onRemove={() => setPendingRemoval(device)}
              />
            )
          )
        )}

        {editing === "new" ? (
          <DeviceForm
            platform={platform}
            onSubmit={add}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setEditing("new")}
          >
            <Plus className="h-4 w-4" />
            Add a TV
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove this TV?"
        description={`${pendingRemoval?.name || pendingRemoval?.ip} will be removed from CTV Bridge${platform === "webos" ? " and the webOS CLI" : ""}. You can add it again later.`}
        confirmLabel="Remove"
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </StepCard>
  );
};
