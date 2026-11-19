import { useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { useDevices } from "@/hooks/useDevices";
import { PLATFORMS } from "@/lib/platforms";
import type { Device, DiscoveredTv, Platform } from "@/types";
import { cn } from "@/utils";
import { DeviceForm } from "./DeviceForm";
import { NearbyTvs } from "./NearbyTvs";
import { STATUS_DOT, type ConnectionStatus } from "./status";

interface DeviceListProps {
  platform: Platform;
  devices: ReturnType<typeof useDevices>;
  selected?: Device;
  status?: ConnectionStatus;
  onSelect: (device: Device) => void;
  /** Keeps the stored selection in sync after an edit or removal. */
  onSelectionChange: (device: Device | undefined) => void;
}

const sameDevice = (a?: Device, b?: Device) =>
  !!a && !!b && a.ip === b.ip && a.name === b.name;

// webOS names are CLI identifiers: "[LG] webOS TV" → "lg-webos-tv".
const deviceName = (platform: Platform, tv: DiscoveredTv) =>
  platform === "webos"
    ? tv.name
        .toLowerCase()
        .replace(/[^\w-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : tv.name;

export const DeviceList = ({
  platform,
  devices: { devices, loading, refresh, add, update, remove },
  selected,
  status,
  onSelect,
  onSelectionChange,
}: DeviceListProps) => {
  const [editing, setEditing] = useState<Device | "new" | null>(null);
  const [picked, setPicked] = useState<DiscoveredTv>();
  const [pendingRemoval, setPendingRemoval] = useState<Device | null>(null);
  const info = PLATFORMS[platform];

  const confirmRemoval = async () => {
    const device = pendingRemoval!;
    setPendingRemoval(null);
    if ((await remove(device)) && sameDevice(device, selected)) {
      onSelectionChange(undefined);
    }
  };

  const submit = async (next: Device) => {
    if (editing === "new") {
      const added = await add(next);
      if (added) onSelect(next);
      return added;
    }
    const saved = await update(editing!, next);
    if (saved && sameDevice(editing!, selected)) onSelectionChange(next);
    return saved;
  };

  return (
    <aside className="flex min-h-0 flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {info.tvName}s
        </h2>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditing("new")}
            title="Add a TV"
            aria-label="Add a TV"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {loading && devices.length === 0 ? (
          [0, 1].map((i) => (
            <li key={i}>
              <Skeleton className="h-12 w-full" />
            </li>
          ))
        ) : devices.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-muted-foreground">
            <p>No TVs yet.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setEditing("new")}
            >
              <Plus className="h-4 w-4" />
              Add a TV
            </Button>
          </li>
        ) : (
          devices.map((device) => {
            const isSelected = sameDevice(device, selected);
            const state = isSelected ? status?.state : undefined;
            return (
              <li key={device.ip + device.name}>
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-md pr-1 transition-colors",
                    isSelected
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(device)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-pressed={isSelected}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        state ? STATUS_DOT[state] : "bg-muted-foreground/30"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {device.name || device.ip}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {device.ip}
                      </span>
                    </span>
                    {state === "checking" && (
                      <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditing(device)}
                      title="Edit"
                      aria-label={`Edit ${device.name || device.ip}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setPendingRemoval(device)}
                      title="Remove"
                      aria-label={`Remove ${device.name || device.ip}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (open) return;
          setEditing(null);
          setPicked(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === "new"
                ? `Add a ${info.tvName}`
                : `Edit ${editing?.name || editing?.ip}`}
            </DialogTitle>
            <DialogDescription>
              Developer Mode must be on and the TV on the same network as this
              computer.
            </DialogDescription>
          </DialogHeader>
          {editing === "new" && (
            <NearbyTvs
              platform={platform}
              existing={devices}
              selectedIp={picked?.ip}
              onPick={setPicked}
            />
          )}
          {editing !== null && (
            <DeviceForm
              key={picked?.ip}
              platform={platform}
              device={editing === "new" ? undefined : editing}
              initial={
                picked && {
                  name: deviceName(platform, picked),
                  ip: picked.ip,
                }
              }
              onSubmit={submit}
              onCancel={() => {
                setEditing(null);
                setPicked(undefined);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove this TV?"
        description={`${pendingRemoval?.name || pendingRemoval?.ip} will be removed from CTV Bridge${platform === "webos" ? " and the webOS CLI" : ""}. You can add it again later.`}
        confirmLabel="Remove"
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </aside>
  );
};
