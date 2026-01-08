import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TOAST_DURATION } from "@/utils";
import { Device } from "@/types";
import { LoadingState } from "./LoadingState";
import { EmptyState } from "./EmptyState";
import { DeviceList } from "./DeviceList";
import { AddDeviceForm } from "./AddDeviceForm";
import { useDevices } from "@/hooks/steps/useDevices";

interface DeviceSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Main DeviceSetupStep component (refactored)
 * Orchestrates device management flow
 */
export const DeviceSetupStep = ({ onNext, onBack }: DeviceSetupStepProps) => {
  const platform =
    (localStorage.getItem("platform") as "tizen" | "webos") || "tizen";
  const {
    devices,
    loading,
    addDevice,
    removeDevice,
    updateDevice,
    updateDeviceConnectionStatus,
  } = useDevices(platform);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDeviceSelect = (device: Device) => {
    if (device.connectionStatus !== "connected") {
      toast.error("Test Connection First", {
        description: "Please test the connection before proceeding.",
        duration: TOAST_DURATION,
      });
      return;
    }

    // Save selected device info
    localStorage.setItem("tvIp", device.ip);
    if (platform === "webos") {
      localStorage.setItem("deviceName", device.name);
    }

    toast.success("Device Selected", {
      description: `Connected to ${device.name || device.ip}`,
      duration: TOAST_DURATION,
    });

    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-sm mb-2">
            {platform === "webos"
              ? "Select a registered device or add a new one. Devices are managed via "
              : "Select a connected device or connect to a new one. Devices are managed via "}
            <code>
              {platform === "webos" ? "ares-setup-device" : "sdb connect"}
            </code>
            .
          </p>

          {loading && <LoadingState />}

          {!loading && devices.length === 0 && (
            <EmptyState platform={platform} />
          )}

          {!loading && devices.length > 0 && (
            <DeviceList
              devices={devices}
              platform={platform}
              onSelect={handleDeviceSelect}
              onRemove={removeDevice}
              onUpdate={updateDevice}
              onUpdateConnectionStatus={updateDeviceConnectionStatus}
            />
          )}

          {showAddForm ? (
            <AddDeviceForm
              platform={platform}
              onAdd={addDevice}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              variant="outline"
              className="w-full"
            >
              {platform === "webos"
                ? "Register New Device"
                : "Connect to Device"}
            </Button>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={onBack} variant="outline">
            <span className="mr-2">&lt;</span> Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
