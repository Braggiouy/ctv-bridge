import { useState } from "react";
import { Device } from "@/types";
import { DeviceCard } from "./DeviceCard";
import { useDeviceConnection } from "@/hooks/steps/useDeviceConnection";
import { getDeviceId } from "./helpers";

interface DeviceListProps {
  devices: Device[];
  platform: "tizen" | "webos";
  onSelect: (device: Device) => void;
  onRemove: (device: Device) => void;
  onUpdate: (oldDevice: Device, newDevice: Device) => void;
  onUpdateConnectionStatus: (
    deviceId: string,
    status: "idle" | "testing" | "connected" | "error"
  ) => void;
}

export const DeviceList = ({
  devices,
  platform,
  onSelect,
  onRemove,
  onUpdate,
  onUpdateConnectionStatus,
}: DeviceListProps) => {
  const { testConnection, isTestingConnection } = useDeviceConnection(platform);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);

  const handleTestConnection = async (device: Device): Promise<boolean> => {
    const deviceId = getDeviceId(device);
    onUpdateConnectionStatus(deviceId, "testing");

    const success = await testConnection(device);

    onUpdateConnectionStatus(deviceId, success ? "connected" : "error");

    return success;
  };

  return (
    <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
      {devices.map((device) => {
        const deviceId = getDeviceId(device);
        return (
          <DeviceCard
            key={deviceId}
            device={device}
            platform={platform}
            isEditing={editingDeviceId === deviceId}
            isTesting={isTestingConnection(deviceId)}
            onTest={handleTestConnection}
            onSelect={onSelect}
            onEdit={() => setEditingDeviceId(deviceId)}
            onRemove={onRemove}
            onSaveEdit={(updated) => {
              onUpdate(device, updated);
              setEditingDeviceId(null);
            }}
            onCancelEdit={() => setEditingDeviceId(null)}
          />
        );
      })}
    </div>
  );
};
