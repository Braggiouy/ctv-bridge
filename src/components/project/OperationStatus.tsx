import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** e.g. "8 s", "1:05". */
const elapsed = (seconds: number) =>
  seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** What a running build or deploy is doing, for how long, and a way to stop it. Mount it per run. */
export const OperationStatus = ({ label }: { label: string }) => {
  const [startedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  const [step, setStep] = useState<string>();
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => window.electron.onDeployLog(setStep), []);

  const cancel = async () => {
    setCancelling(true);
    const result = await window.electron.cancel();
    if (!result.success) setCancelling(false);
  };

  return (
    <div
      role="status"
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      <span className="truncate">{step ?? label}</span>
      <span className="shrink-0 tabular-nums">
        {elapsed(Math.floor((now - startedAt) / 1000))}
      </span>
      <Button
        variant="link"
        size="sm"
        className="h-auto shrink-0 p-0 text-xs"
        onClick={cancel}
        disabled={cancelling}
      >
        {cancelling ? "Cancelling…" : "Cancel"}
      </Button>
    </div>
  );
};
