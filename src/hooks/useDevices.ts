import { useCallback, useEffect, useRef, useState } from "react";
import type { Device, Platform, Result } from "@/types";
import { addLog, notify } from "@/utils";

/** The TV list for a platform, backed by the main process device registry. */
export function useDevices(platform: Platform) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    const result = await window.electron.devices.list(platform);
    // A slower answer for the previous platform must not overwrite this one.
    if (request !== latestRequest.current) return;
    if (result.success) {
      setDevices(result.devices);
      addLog("log", `Found ${result.devices.length} ${platform} device(s)`);
    } else {
      setDevices([]);
      notify.error("Couldn't load devices", result.message);
    }
    setLoading(false);
  }, [platform]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = async (
    action: Promise<Result>,
    successTitle: string,
    errorTitle: string
  ): Promise<boolean> => {
    const result = await action;
    if (result.success) notify.success(successTitle, result.message);
    else notify.error(errorTitle, result.message);
    await refresh();
    return result.success;
  };

  const { devices: api } = window.electron;
  return {
    devices,
    loading,
    refresh,
    add: (device: Device) =>
      mutate(api.add(platform, device), "TV added", "Couldn't add TV"),
    update: (previous: Device, next: Device) =>
      mutate(
        api.update(platform, previous, next),
        "TV updated",
        "Couldn't update TV"
      ),
    remove: (device: Device) =>
      mutate(
        api.remove(platform, device),
        `Removed ${device.name || device.ip}`,
        "Couldn't remove TV"
      ),
  };
}
