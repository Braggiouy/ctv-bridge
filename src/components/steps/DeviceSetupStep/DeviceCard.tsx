import { Device, WebOSDevice, TizenDevice } from "@/types";
import { Button } from "@/components/ui/button";
import { DeviceEditForm } from "./DeviceEditForm";
import {
  getConnectionStatusIcon,
  getConnectionStatusClass,
  getConnectionStatusText,
  formatDeviceDisplayName,
  maskPassphrase,
} from "./helpers";

interface DeviceCardProps {
  device: Device;
  platform: "tizen" | "webos" | "android";
  isEditing: boolean;
  isTesting: boolean;
  onTest: (device: Device) => Promise<boolean>;
  onSelect: (device: Device) => void;
  onEdit: () => void;
  onRemove: (device: Device) => void;
  onSaveEdit: (device: Device) => void;
  onCancelEdit: () => void;
}

export const DeviceCard = ({
  device,
  platform,
  isEditing,
  isTesting,
  onTest,
  onSelect,
  onEdit,
  onRemove,
  onSaveEdit,
  onCancelEdit,
}: DeviceCardProps) => {
  if (isEditing) {
    return (
      <div className="flex items-center gap-3 p-3 rounded border bg-card">
        <div className="flex-1">
          <DeviceEditForm
            device={device}
            platform={platform}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded border bg-card">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-base">
            {formatDeviceDisplayName(device, platform)}
          </div>
          {getConnectionStatusIcon(device.connectionStatus, isTesting)}
        </div>
        <div className="text-xs text-muted-foreground">
          IP: {device.ip}
          {platform === "webos" && (
            <>
              {" "}
              | Port: {(device as WebOSDevice).port} | User:{" "}
              {(device as WebOSDevice).username}
              {(device as WebOSDevice).passphrase && (
                <>
                  {" "}
                  | Passphrase:{" "}
                  {maskPassphrase((device as WebOSDevice).passphrase!)}
                </>
              )}
            </>
          )}
          {platform === "tizen" && (device as TizenDevice).sdbStatus && (
            <> | Status: {(device as TizenDevice).sdbStatus}</>
          )}
        </div>
        {device.connectionStatus && (
          <div className="text-xs mt-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getConnectionStatusClass(
                device.connectionStatus
              )}`}
            >
              {getConnectionStatusText(device, platform)}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onTest(device)}
          disabled={isTesting}
        >
          {isTesting ? "Testing..." : "Test"}
        </Button>
        <Button
          size="sm"
          onClick={() => onSelect(device)}
          disabled={device.connectionStatus !== "connected"}
        >
          Select
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onRemove(device)}>
          Remove
        </Button>
      </div>
    </div>
  );
};
