export type ConnectionStatus =
  | { state: "checking" }
  | { state: "connected" }
  | { state: "failed"; message: string };

export const STATUS_DOT: Record<ConnectionStatus["state"], string> = {
  checking: "bg-yellow-500 animate-pulse",
  connected: "bg-green-500",
  failed: "bg-red-500",
};
