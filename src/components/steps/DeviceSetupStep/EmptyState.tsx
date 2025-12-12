import { WifiOff } from "lucide-react";

interface EmptyStateProps {
  platform: "tizen" | "webos";
}

/**
 * Empty state when no devices are registered/connected
 */
export const EmptyState = ({ platform }: EmptyStateProps) => {
  const action = platform === "webos" ? "registered" : "connected";
  const verb = platform === "webos" ? "Register" : "Connect to";

  return (
    <div className="p-4 rounded border border-dashed bg-muted/50 text-center text-sm text-muted-foreground mb-4">
      <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
      No devices {action}. {verb} a device below.
    </div>
  );
};
