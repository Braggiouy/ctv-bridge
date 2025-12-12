import { useState } from "react";
import { Device } from "@/types";
import { useSecureStorage } from "@/hooks/useSecureStorage";
import { useGlobalLogs } from "@/utils";
import { toast } from "@/hooks/use-toast";
import { TOAST_DURATION } from "@/utils";

/**
 * Hook for testing device connections
 */
export function useDeviceConnection(platform: "tizen" | "webos") {
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
        toast({
          title: "Connection Successful",
          description: result.message,
          duration: TOAST_DURATION,
        });
        addLog("step", `Connection successful: ${device.name || device.ip}`);
        return true;
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
          duration: TOAST_DURATION,
        });
        addLog("error", `Connection failed: ${result.message}`);
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
        duration: TOAST_DURATION,
      });
      addLog("error", `Connection error: ${error.message}`);
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
