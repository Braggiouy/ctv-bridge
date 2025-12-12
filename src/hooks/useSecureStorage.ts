import { useState, useEffect } from "react";

/**
 * Custom hook for secure passphrase storage operations
 */
export function useSecureStorage() {
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      const result = await window.electron.isSecureStorageAvailable();
      setIsAvailable(result.available);
    } catch (error) {
      console.error("Failed to check secure storage availability:", error);
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  };

  const savePassphrase = async (
    deviceName: string,
    passphrase: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAvailable) {
      return {
        success: false,
        message: "Secure storage is not available on this system",
      };
    }
    return await window.electron.savePassphrase(deviceName, passphrase);
  };

  const getPassphrase = async (deviceName: string): Promise<string | null> => {
    if (!isAvailable) {
      return null;
    }
    const result = await window.electron.getPassphrase(deviceName);
    return result.passphrase;
  };

  const deletePassphrase = async (
    deviceName: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isAvailable) {
      return {
        success: false,
        message: "Secure storage is not available on this system",
      };
    }
    return await window.electron.deletePassphrase(deviceName);
  };

  const getAllDeviceNames = async (): Promise<string[]> => {
    if (!isAvailable) {
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
