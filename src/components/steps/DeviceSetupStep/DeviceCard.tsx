import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
  Tv,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Device, Platform } from "@/types";
import { addLog, cn } from "@/utils";

interface DeviceCardProps {
  device: Device;
  platform: Platform;
  selected: boolean;
  onUse: (device: Device) => void;
  onEdit: () => void;
  onRemove: () => void;
}

function describe(device: Device, platform: Platform): string {
  if (platform === "webos") {
    return `${device.username}@${device.ip}:${device.port}${device.hasPassphrase ? " · passphrase saved" : ""}`;
  }
  return `${device.ip} · ${device.connected ? "connected" : "not connected"}`;
}

/** One TV. "Use this TV" checks the connection and selects it in a single step. */
export const DeviceCard = ({
  device,
  platform,
  selected,
  onUse,
  onEdit,
  onRemove,
}: DeviceCardProps) => {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUse = async () => {
    setTesting(true);
    setError(null);
    const result = await window.electron.devices.test(platform, device);
    setTesting(false);
    if (result.success) {
      addLog("step", result.message ?? `Connected to ${device.name}`);
      onUse({ ...device, duid: result.duid ?? device.duid });
    } else {
      setError(result.message ?? "Connection failed");
      addLog(
        "error",
        `Connection to ${device.name || device.ip} failed: ${result.message}`
      );
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        selected && "border-primary bg-primary/5",
        error && "border-red-500/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Tv className="h-8 w-8 text-muted-foreground" />
          {(device.connected || selected) && !error && (
            <CheckCircle2 className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-card text-green-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">
              {device.name || device.ip}
            </span>
            {selected && (
              <span className="rounded-full bg-primary/10 px-2 text-xs text-primary">
                Selected
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {describe(device, platform)}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          title="Edit"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          title="Remove"
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button onClick={handleUse} disabled={testing} className="min-w-32">
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            "Use this TV"
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-2 flex gap-2 text-sm text-red-600 dark:text-red-400">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};
