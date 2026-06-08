import { useRef, useState } from "react";

/**
 * Custom hook for secure passphrase storage operations
 */
export function useSecureStorage() {
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const availabilityCheckedRef = useRef(false);

  const checkAvailability = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.isSecureStorageAvailable();
      setIsAvailable(result.available);
      availabilityCheckedRef.current = true;
      return result.available;
    } catch (error) {
      console.error("Failed to check secure storage availability:", error);
      setIsAvailable(false);
      availabilityCheckedRef.current = true;
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const ensureAvailability = async (): Promise<boolean> => {
    if (availabilityCheckedRef.current) {
      return isAvailable;
    }
    return await checkAvailability();
  };

  const savePassphrase = async (
    deviceName: string,
    passphrase: string
  ): Promise<{ success: boolean; message?: string }> => {
    const available = await ensureAvailability();
    if (!available) {
      return {
        success: false,
        message: "Secure storage is not available on this system",
      };
    }
    return await window.electron.savePassphrase(deviceName, passphrase);
  };

  const getPassphrase = async (deviceName: string): Promise<string | null> => {
    const available = await ensureAvailability();
    if (!available) {
      return null;
    }
    const result = await window.electron.getPassphrase(deviceName);
    return result.passphrase;
  };

  const deletePassphrase = async (
    deviceName: string
  ): Promise<{ success: boolean; message?: string }> => {
    const available = await ensureAvailability();
    if (!available) {
      return {
        success: false,
        message: "Secure storage is not available on this system",
      };
    }
    return await window.electron.deletePassphrase(deviceName);
  };

  const getAllDeviceNames = async (): Promise<string[]> => {
    const available = await ensureAvailability();
    if (!available) {
      return [];
    }
    const result = await window.electron.getAllDeviceNames();
    return result.deviceNames || [];
  };

  return {
    isAvailable,
    isLoading,
    savePassphrase,
    getPassphrase,
    deletePassphrase,
    getAllDeviceNames,
  };
}
