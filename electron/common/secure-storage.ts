import { safeStorage, app } from "electron";
import fs from "fs/promises";
import path from "path";

interface PassphraseStore {
  [deviceName: string]: string; // Encrypted passphrase (base64)
}

const STORE_FILE_NAME = "secure-credentials.json";

/**
 * Get the path to the secure credentials store file
 */
function getStorePath(): string {
  return path.join(app.getPath("userData"), STORE_FILE_NAME);
}

/**
 * Load the encrypted passphrase store from disk
 */
async function loadStore(): Promise<PassphraseStore> {
  try {
    const storePath = getStorePath();
    const data = await fs.readFile(storePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    // File doesn't exist or is corrupted - return empty store
    if (error.code === "ENOENT") {
      return {};
    }
    console.error("Error loading secure store:", error);
    return {};
  }
}

/**
 * Save the encrypted passphrase store to disk
 */
async function saveStore(store: PassphraseStore): Promise<void> {
  const storePath = getStorePath();
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Check if secure storage (encryption) is available on this system
 */
export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Save a passphrase securely for a device
 * @param deviceName - Unique device name
 * @param passphrase - Plain text passphrase to encrypt and store
 */
export async function savePassphrase(
  deviceName: string,
  passphrase: string
): Promise<void> {
  if (!deviceName || !passphrase) {
    throw new Error("Device name and passphrase are required");
  }

  if (!isSecureStorageAvailable()) {
    throw new Error(
      "Secure storage is not available on this system. Cannot save passphrase."
    );
  }

  // Encrypt the passphrase
  const encryptedBuffer = safeStorage.encryptString(passphrase);
  const encryptedBase64 = encryptedBuffer.toString("base64");

  // Load current store
  const store = await loadStore();

  // Update with new encrypted passphrase
  store[deviceName] = encryptedBase64;

  // Save back to disk
  await saveStore(store);
}

/**
 * Retrieve a passphrase for a device
 * @param deviceName - Device name to retrieve passphrase for
 * @returns Decrypted passphrase or null if not found
 */
export async function getPassphrase(
  deviceName: string
): Promise<string | null> {
  if (!deviceName) {
    return null;
  }

  const store = await loadStore();
  const encryptedBase64 = store[deviceName];

  if (!encryptedBase64) {
    return null;
  }

  if (!isSecureStorageAvailable()) {
    console.error("Secure storage not available - cannot decrypt passphrase");
    return null;
  }

  try {
    // Decrypt the passphrase
    const encryptedBuffer = Buffer.from(encryptedBase64, "base64");
    const decryptedPassphrase = safeStorage.decryptString(encryptedBuffer);
    return decryptedPassphrase;
  } catch (error) {
    console.error("Error decrypting passphrase:", error);
    return null;
  }
}

/**
 * Delete a passphrase for a device
 * @param deviceName - Device name to delete passphrase for
 */
export async function deletePassphrase(deviceName: string): Promise<void> {
  if (!deviceName) {
    return;
  }

  const store = await loadStore();

  if (store[deviceName]) {
    delete store[deviceName];
    await saveStore(store);
  }
}

/**
 * Get all device names that have saved passphrases
 * @returns Array of device names
 */
export async function getAllDeviceNames(): Promise<string[]> {
  const store = await loadStore();
  return Object.keys(store);
}

/**
 * Clear all saved passphrases (useful for testing or reset functionality)
 */
export async function clearAllPassphrases(): Promise<void> {
  await saveStore({});
}
