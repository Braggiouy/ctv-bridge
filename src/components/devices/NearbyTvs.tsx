import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Device, DiscoveredTv, Platform } from "@/types";
import { cn } from "@/utils";

interface NearbyTvsProps {
  platform: Platform;
  /** TVs already added, left out of the results. */
  existing: Device[];
  selectedIp?: string;
  onPick: (tv: DiscoveredTv) => void;
}

/** Searches the network when shown, and lists TVs that can be added with one click. */
export const NearbyTvs = ({
  platform,
  existing,
  selectedIp,
  onPick,
}: NearbyTvsProps) => {
  const [tvs, setTvs] = useState<DiscoveredTv[]>([]);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string>();

  const search = useCallback(async () => {
    setSearching(true);
    setError(undefined);
    const result = await window.electron.devices.discover(platform);
    if (result.success) setTvs(result.tvs ?? []);
    else setError(result.message);
    setSearching(false);
  }, [platform]);

  useEffect(() => {
    void search();
  }, [search]);

  const found = tvs.filter((tv) => !existing.some((d) => d.ip === tv.ip));

  return (
    <section className="space-y-2" aria-label="TVs on your network">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On your network
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={search}
          disabled={searching}
          title="Search again"
          aria-label="Search again"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", searching && "animate-spin")}
          />
        </Button>
      </div>
      {searching && found.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching for TVs…
        </p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : found.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No new TVs found. Check the TV is on and on the same network, or enter
          its IP address below.
        </p>
      ) : (
        <ul className="space-y-1">
          {found.map((tv) => (
            <li key={tv.ip}>
              <button
                type="button"
                onClick={() => onPick(tv)}
                aria-pressed={tv.ip === selectedIp}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tv.ip === selectedIp && "border-primary bg-primary/10"
                )}
              >
                <span className="block truncate text-sm font-medium">
                  {tv.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[tv.ip, tv.model].filter(Boolean).join(" · ")}
                </span>
                {tv.warning && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {tv.warning}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
