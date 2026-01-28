import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges multiple class names using clsx and tailwind-merge to handle conflicts.
 */
export function mergeClassNames(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
