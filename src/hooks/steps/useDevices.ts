import { useState, useEffect, useCallback } from "react";
import { Device, WebOSDevice, TizenDevice } from "@/types";
import { useGlobalLogs } from "@/utils";
import { useSecureStorage } from "@/hooks/useSecureStorage";
import { toast } from "@/hooks/use-toast";
import { TOAST_DURATION } from "@/utils";

/**
 * Hook for managing device CRUD operations
 */
export function useDevices(platform: "tizen" | "webos") {
  const { addLog } = useGlobalLogs();
  const { getPassphrase, savePassphrase, deletePassphrase } =
    useSecureStorage();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      if (platform === "webos") {
        const res = await window.electron.listDevices();
        if (res.success) {
          // Load passphrases from secure storage
          const devicesWithPassphrases = await Promise.all(
            (res.devices as WebOSDevice[]).map(async (device) => {
              const passphrase = await getPassphrase(device.name);
              return {
                ...device,
                passphrase: passphrase || "",
                connectionStatus: "idle" as const,
              };
            })
          );
          setDevices(devicesWithPassphrases);
          addLog("log", `Loaded ${res.devices.length} webOS devices.`);
        } else {
          addLog("error", `Failed to load webOS devices: ${res.message}`);
        }
      } else {
        // Tizen
        const res = await window.electron.listTizenDevices();
        if (res.success) {
          const storedNames = JSON.parse(
            localStorage.getItem("tizen-device-names") || "{}"
          );
          const devicesWithNames = (res.devices || []).map((device: any) => ({
            name: storedNames[device.ip] || device.ip,
            ip: device.ip,
            sdbStatus: device.status,
            connectionStatus: "idle" as const,
          }));
          setDevices(devicesWithNames);
          addLog("log", `Loaded ${res.devices?.length || 0} Tizen devices.`);
        } else {
          addLog("error", `Failed to load Tizen devices: ${res.message}`);
        }
      }
    } catch (error: any) {
      addLog("error", `Error loading devices: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [platform, getPassphrase, addLog]);

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addDevice = async (
    device: Device
  ): Promise<{ success: boolean; message?: string }> => {
    if (platform === "webos") {
      const res = await window.electron.addDevice(device);
      if (res.success) {
        toast({
          title: "Device registered",
          description: `Device ${device.name} added.`,
          duration: TOAST_DURATION,
        });
        addLog("step", `Device registered: ${device.name}`);

        // Save passphrase to secure storage
        if ((device as WebOSDevice).passphrase) {
          await savePassphrase(
            device.name,
            (device as WebOSDevice).passphrase!
          );
        }

        await fetchDevices();
        return { success: true };
      } else {
        toast({
          title: "Registration failed",
          description: res.message,
          variant: "destructive",
          duration: TOAST_DURATION,
        });
        addLog("error", `Device registration failed: ${res.message}`);
        return res;
      }
    } else {
      // Tizen
      const res = await window.electron.addTizenDevice(device.ip);
      if (res.success) {
        toast({
          title: "Device Connected",
          description: res.message,
          duration: TOAST_DURATION,
        });
        addLog("step", `Tizen device connected: ${device.ip}`);

        // Save device name if provided
        if (device.name) {
          const storedNames = JSON.parse(
            localStorage.getItem("tizen-device-names") || "{}"
          );
          storedNames[device.ip] = device.name;
          localStorage.setItem(
            "tizen-device-names",
            JSON.stringify(storedNames)
          );
        }

        await fetchDevices();
        return { success: true };
      } else {
        toast({
          title: "Connection Failed",
          description: res.message,
          variant: "destructive",
          duration: TOAST_DURATION,
        });
        addLog("error", `Tizen connection failed: ${res.message}`);
        return res;
      }
    }
  };

  const removeDevice = async (device: Device): Promise<void> => {
    try {
      if (platform === "webos") {
        const res = await window.electron.removeDevice(device.name);
        if (res.success) {
          toast({
            title: "Device removed",
            description: `Device ${device.name} removed.`,
            duration: TOAST_DURATION,
          });
          addLog("step", `Device removed: ${device.name}`);

          // Delete passphrase from secure storage
          await deletePassphrase(device.name);

          await fetchDevices();
        } else {
          toast({
            title: "Remove failed",
            description: res.message,
            variant: "destructive",
            duration: TOAST_DURATION,
          });
        }
      } else {
        // Tizen
        const res = await window.electron.removeTizenDevice(device.ip);
        if (res.success) {
          toast({
            title: "Device Disconnected",
            description: res.message,
            duration: TOAST_DURATION,
          });
          addLog("step", `Tizen device disconnected: ${device.ip}`);

          const storedNames = JSON.parse(
            localStorage.getItem("tizen-device-names") || "{}"
          );
          delete storedNames[device.ip];
          localStorage.setItem(
            "tizen-device-names",
            JSON.stringify(storedNames)
          );

          await fetchDevices();
        } else {
          toast({
            title: "Disconnect Failed",
            description: res.message,
            variant: "destructive",
            duration: TOAST_DURATION,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: TOAST_DURATION,
      });
    }
  };

  const updateDevice = async (
    oldDevice: Device,
    newDevice: Device
  ): Promise<void> => {
    if (platform === "webos") {
      const oldName = oldDevice.name;
      const newName = newDevice.name;

      // If name changed, we need to remove old and add new
      if (oldName !== newName) {
        // Remove old device
        const removeRes = await window.electron.removeDevice(oldName);
        if (!removeRes.success) {
          toast({
            title: "Update failed",
            description: `Failed to remove old device: ${removeRes.message}`,
            variant: "destructive",
            duration: TOAST_DURATION,
          });
          return;
        }

        // Add new device with new name
        const addRes = await window.electron.addDevice(newDevice);
        if (!addRes.success) {
          toast({
            title: "Update failed",
            description: addRes.message,
            variant: "destructive",
            duration: TOAST_DURATION,
          });
          return;
        }

        // Update passphrase in secure storage
        await deletePassphrase(oldName);
        if ((newDevice as WebOSDevice).passphrase) {
          await savePassphrase(newName, (newDevice as WebOSDevice).passphrase!);
        }

        toast({ title: "Device updated", duration: TOAST_DURATION });
        addLog("step", `Device renamed: ${oldName} → ${newName}`);
      } else {
        // Name didn't change, just update
        const res = await window.electron.updateDevice(newDevice);
        if (!res.success) {
          toast({
            title: "Update failed",
            description: res.message,
            variant: "destructive",
            duration: TOAST_DURATION,
          });
          addLog("error", `Device update failed: ${res.message}`);
          return;
        }

        toast({ title: "Device updated", duration: TOAST_DURATION });
        addLog("step", `Device updated: ${newDevice.name}`);

        // Save passphrase to secure storage
        if ((newDevice as WebOSDevice).passphrase) {
          await savePassphrase(
            newDevice.name,
            (newDevice as WebOSDevice).passphrase!
          );
        } else {
          await deletePassphrase(newDevice.name);
        }
      }

      await fetchDevices();
    } else {
      // Tizen: Update name in localStorage and reconnect if IP changed
      const oldIp = oldDevice.ip;
      const newIp = newDevice.ip;

      if (oldIp !== newIp) {
        // IP changed - disconnect old, connect new
        await window.electron.removeTizenDevice(oldIp);
        const res = await window.electron.addTizenDevice(newIp);
        if (!res.success) {
          toast({
            title: "Update failed",
            description: res.message,
            variant: "destructive",
            duration: TOAST_DURATION,
          });
          return;
        }
      }

      // Update name in localStorage
      const storedNames = JSON.parse(
        localStorage.getItem("tizen-device-names") || "{}"
      );
      if (oldIp !== newIp) {
        delete storedNames[oldIp];
      }
      if (newDevice.name) {
        storedNames[newIp] = newDevice.name;
      } else {
        delete storedNames[newIp];
      }
      localStorage.setItem("tizen-device-names", JSON.stringify(storedNames));

      toast({ title: "Device updated", duration: TOAST_DURATION });
      addLog("step", `Device updated: ${newDevice.name || newIp}`);
      await fetchDevices();
    }
  };

  const updateDeviceConnectionStatus = (
    deviceId: string,
    status: "idle" | "testing" | "connected" | "error"
  ) => {
    setDevices((prev) =>
      prev.map((d) =>
        (d.name || d.ip) === deviceId ? { ...d, connectionStatus: status } : d
      )
    );
  };

  return {
    devices,
    loading,
    fetchDevices,
    addDevice,
    removeDevice,
    updateDevice,
    updateDeviceConnectionStatus,
  };
}
