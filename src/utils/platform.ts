/**
 * Utility for platform-related checks
 */

/**
 * Checks if the current operating system is Windows
 */
export const isWindows = (): boolean => {
  return window.navigator.platform.toLowerCase().includes("win");
};

/**
 * Returns a platform-specific path example
 */
export const getPlatformPathPlaceholder = (
  winPath: string,
  posixPath: string
): string => {
  return isWindows() ? winPath : posixPath;
};
