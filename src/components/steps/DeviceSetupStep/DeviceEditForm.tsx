import { useState } from "react";
import { Device, WebOSDevice } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import {
  validateDeviceForm,
  DeviceValidationErrors,
} from "@/utils/steps/deviceValidation";

interface DeviceEditFormProps {
  device: Device;
  platform: "tizen" | "webos";
  onSave: (device: Device) => void;
  onCancel: () => void;
}

export const DeviceEditForm = ({
  device,
  platform,
  onSave,
  onCancel,
}: DeviceEditFormProps) => {
  const [formData, setFormData] = useState<Device>(device);
  const [errors, setErrors] = useState<DeviceValidationErrors>({});
  const [showPassphrase, setShowPassphrase] = useState(false);

  const isEmulator = device.ip === "127.0.0.1";

  const handleSave = () => {
    // Validate
    const validationErrors = validateDeviceForm(formData, platform);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSave(formData);
  };

  return (
    <div className="space-y-2">
      <div className="font-semibold text-base mb-2">
        Editing: {device.name || device.ip}
      </div>

      <div className="flex gap-2 items-center">
        <Label className="text-xs w-20">
          Name{platform === "tizen" ? " (optional)" : ""}:
        </Label>
        <Input
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="h-8 text-xs"
          placeholder={platform === "tizen" ? "Optional" : "Device name"}
          disabled={isEmulator}
          title={isEmulator ? "Emulator device name cannot be changed" : ""}
        />
      </div>
      {errors.name && (
        <p className="text-xs text-red-500 ml-22">{errors.name}</p>
      )}

      <div className="flex gap-2 items-center">
        <Label className="text-xs w-20">IP:</Label>
        <Input
          value={formData.ip || ""}
          onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      {errors.ip && <p className="text-xs text-red-500 ml-22">{errors.ip}</p>}

      {platform === "webos" && (
        <>
          <div className="flex gap-2 items-center">
            <Label className="text-xs w-20">Port:</Label>
            <Input
              value={(formData as WebOSDevice).port || ""}
              onChange={(e) =>
                setFormData({ ...formData, port: e.target.value })
              }
              className="h-8 text-xs"
            />
          </div>
          {errors.port && (
            <p className="text-xs text-red-500 ml-22">{errors.port}</p>
          )}

          <div className="flex gap-2 items-center">
            <Label className="text-xs w-20">User:</Label>
            <Input
              value={(formData as WebOSDevice).username || ""}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className="h-8 text-xs"
            />
          </div>

          <div className="flex gap-2 items-center">
            <Label className="text-xs w-20">Passphrase:</Label>
            <div className="relative flex-1">
              <Input
                type={showPassphrase ? "text" : "password"}
                value={(formData as WebOSDevice).passphrase || ""}
                onChange={(e) =>
                  setFormData({ ...formData, passphrase: e.target.value })
                }
                className="h-8 text-xs pr-8"
                placeholder="Optional"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                onClick={() => setShowPassphrase(!showPassphrase)}
              >
                {showPassphrase ? (
                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Eye className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleSave}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
