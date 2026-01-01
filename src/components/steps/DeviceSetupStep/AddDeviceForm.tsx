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

interface AddDeviceFormProps {
  platform: "tizen" | "webos";
  onAdd: (device: Device) => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
}

export const AddDeviceForm = ({
  platform,
  onAdd,
  onCancel,
}: AddDeviceFormProps) => {
  const [formData, setFormData] = useState<Partial<Device>>({
    name: "",
    ip: "",
    port: "9922",
    username: "prisoner",
    passphrase: "",
    connectionStatus: "idle",
  });
  const [errors, setErrors] = useState<DeviceValidationErrors>({});
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Validate
    const validationErrors = validateDeviceForm(formData, platform);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Submit
    setSubmitting(true);
    const result = await onAdd(formData as Device);
    setSubmitting(false);

    if (result.success) {
      // Reset form and close
      setFormData({
        name: "",
        ip: "",
        port: "9922",
        username: "prisoner",
        passphrase: "",
        connectionStatus: "idle",
      });
      setErrors({});
      onCancel();
    }
    // Error toast is already shown by the hook
  };

  return (
    <div className="space-y-4 p-4 border rounded bg-card">
      <h3 className="font-semibold">
        {platform === "webos" ? "Register New Device" : "Connect to Device"}
      </h3>

      <div className="space-y-2">
        <Label htmlFor="deviceName">
          Device Name {platform === "tizen" && "(optional)"}
        </Label>
        <Input
          id="deviceName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={platform === "tizen" ? "Optional" : "my-lg-tv"}
          disabled={submitting}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="deviceIp">IP Address</Label>
        <Input
          id="deviceIp"
          value={formData.ip}
          onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
          placeholder="192.168.1.100"
          disabled={submitting}
        />
        {errors.ip && <p className="text-xs text-red-500">{errors.ip}</p>}
      </div>

      {platform === "webos" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              value={(formData as WebOSDevice).port}
              onChange={(e) =>
                setFormData({ ...formData, port: e.target.value })
              }
              disabled={submitting}
            />
            {errors.port && (
              <p className="text-xs text-red-500">{errors.port}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={(formData as WebOSDevice).username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase (optional)</Label>
            <div className="relative">
              <Input
                id="passphrase"
                type={showPassphrase ? "text" : "password"}
                value={(formData as WebOSDevice).passphrase || ""}
                onChange={(e) =>
                  setFormData({ ...formData, passphrase: e.target.value })
                }
                placeholder="Optional"
                disabled={submitting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassphrase(!showPassphrase)}
                disabled={submitting}
              >
                {showPassphrase ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
          {submitting
            ? "Adding..."
            : platform === "webos"
              ? "Register Device"
              : "Connect"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
