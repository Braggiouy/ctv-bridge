// Central export point for all configuration
export * from "./constants";

// For backward compatibility - direct export of commonly used values
import { UI_CONFIG } from "./constants";
export const TOAST_DURATION = UI_CONFIG.TOAST_DURATION;

// Re-export device utilities for convenience
export * from "../deviceUtils";
