import { useState } from "react";
import { Device } from "@/types";
import { useSecureStorage } from "@/hooks/useSecureStorage";
import { useGlobalLogs } from "@/utils";
import { toast } from "sonner";
import { TOAST_DURATION } from "@/utils";

/**
 * Hook for testing device connections
 */
export function useDeviceConnection(platform: "tizen" | "webos" | "android") {
  const { getPassphrase } = useSecureStorage();
  const { addLog } = useGlobalLogs();
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);

  const testConnection = async (device: Device): Promise<boolean> => {
    const deviceId = device.name || device.ip;
    setTestingDeviceId(deviceId);

    try {
      let passphrase: string | undefined;
      if (platform === "webos") {
        const storedPassphrase = await getPassphrase(device.name);
        passphrase = storedPassphrase || undefined;
      }

      const result = await window.electron.testConnection(
        platform,
        platform === "webos" ? device.name : device.ip,
        passphrase
      );

      if (result.success) {
        toast.success("Connection Successful", {
          description: result.message,
          duration: TOAST_DURATION,
        });
        addLog("step", `Connection successful: ${device.name || device.ip}`);
        return true;
      } else {
        toast.error("Connection Failed", {
          description: result.message,
          duration: TOAST_DURATION,
        });
        addLog("error", `Connection failed: ${result.message}`);
        return false;
      }
    } catch (error: unknown) {
      const err = error as Error;
      toast.error("Connection Error", {
        description: err.message,
        duration: TOAST_DURATION,
      });
      addLog("error", `Connection error: ${err.message}`);
      return false;
    } finally {
      setTestingDeviceId(null);
    }
  };

  return {
    testConnection,
    testingDeviceId,
    isTestingConnection: (deviceId: string) => testingDeviceId === deviceId,
  };
}
