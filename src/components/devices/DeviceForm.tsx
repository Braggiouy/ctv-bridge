import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { PLATFORMS } from "@/lib/platforms";
import type { Device, Platform } from "@/types";
import { validateDevice, type DeviceErrors } from "@/utils";

const WEBOS_DEFAULTS = { port: "9922", username: "prisoner" };

interface DeviceFormProps {
  platform: Platform;
  /** Present when editing an existing device. */
  device?: Device;
  onSubmit: (device: Device) => Promise<boolean>;
  onCancel: () => void;
}

const Field = ({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {error ? (
      <p className="text-xs text-red-500">{error}</p>
    ) : (
      hint && <p className="text-xs text-muted-foreground">{hint}</p>
    )}
  </div>
);

/** Add/edit form for a TV; webOS needs SSH details on top of name and IP. */
export const DeviceForm = ({
  platform,
  device,
  onSubmit,
  onCancel,
}: DeviceFormProps) => {
  const isWebos = platform === "webos";
  const [form, setForm] = useState<Device>({
    name: "",
    ip: "",
    ...(isWebos ? WEBOS_DEFAULTS : {}),
    ...device,
    passphrase: "",
  });
  const [errors, setErrors] = useState<DeviceErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof Device) => (e: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: e.target.value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const device = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
    ) as Device;
    const validation = validateDevice(platform, device);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    const saved = await onSubmit(device);
    setSubmitting(false);
    if (saved) onCancel();
  };

  const nameRequired = PLATFORMS[platform].deviceNameRequired;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="device-name"
          label={nameRequired ? "Name" : "Name (optional)"}
          error={errors.name}
        >
          <Input
            id="device-name"
            value={form.name}
            onChange={set("name")}
            placeholder={isWebos ? "living-room-tv" : "Living room TV"}
            disabled={submitting}
            autoFocus
          />
        </Field>
        <Field
          id="device-ip"
          label="IP address"
          error={errors.ip}
          hint="Shown in the TV's network settings"
        >
          <Input
            id="device-ip"
            value={form.ip}
            onChange={set("ip")}
            placeholder="192.168.1.100"
            disabled={submitting}
          />
        </Field>
        {isWebos && (
          <>
            <Field id="device-port" label="SSH port" error={errors.port}>
              <Input
                id="device-port"
                value={form.port}
                onChange={set("port")}
                disabled={submitting}
              />
            </Field>
            <Field id="device-username" label="SSH user">
              <Input
                id="device-username"
                value={form.username}
                onChange={set("username")}
                disabled={submitting}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="device-passphrase"
                label="Passphrase"
                hint="Shown in the Developer Mode app. Needed the first time you connect."
              >
                <PasswordInput
                  id="device-passphrase"
                  value={form.passphrase}
                  onChange={set("passphrase")}
                  placeholder={
                    device?.hasPassphrase
                      ? "Saved. Leave blank to keep it."
                      : "e.g. A1B2C3"
                  }
                  disabled={submitting}
                />
              </Field>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {device ? "Save" : "Add TV"}
        </Button>
      </div>
    </form>
  );
};
