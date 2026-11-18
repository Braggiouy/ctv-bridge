import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { TizenProfile } from "@/types";
import { notify } from "@/utils";
import { FIELD_CLASSNAME, TizenCertificates } from "./TizenCertificates";

interface TizenSigningProps {
  profileName?: string;
  onChange: (profileName: string | undefined) => void;
  knownDuids: string[];
  disabled: boolean;
}

/** Picks the Tizen security profile used to sign the WGT, or creates a new one. */
export const TizenSigning = ({
  profileName,
  onChange,
  knownDuids,
  disabled,
}: TizenSigningProps) => {
  const [profiles, setProfiles] = useState<TizenProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await window.electron.tizen.listProfiles();
    setLoading(false);
    if (result.success) setProfiles(result.profiles ?? []);
    else notify.error("Couldn't list signing profiles", result.message);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the selection pointing at a profile that exists, preferring the active one.
  useEffect(() => {
    if (loading || profiles.some((p) => p.name === profileName)) return;
    const fallback = (profiles.find((p) => p.active) ?? profiles[0])?.name;
    if (fallback !== profileName) onChange(fallback);
  }, [loading, profiles, profileName, onChange]);

  const deleteProfile = async () => {
    const name = pendingDelete!;
    setPendingDelete(null);
    const result = await window.electron.tizen.deleteProfile(name);
    if (result.success) notify.success("Signing profile deleted", name);
    else notify.error("Couldn't delete profile", result.message);
    await refresh();
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="tizen-profile">Signing profile</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading || disabled}
        >
          <RefreshCw
            className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
          />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profiles…
        </p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Samsung TVs only install signed apps. Create a certificate to get a
          signing profile.
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            id="tizen-profile"
            className={`${FIELD_CLASSNAME} h-10`}
            value={profileName ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            {profiles.map((profile) => (
              <option key={profile.name} value={profile.name}>
                {profile.name}
                {profile.active ? " (active)" : ""}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPendingDelete(profileName ?? null)}
            disabled={disabled || !profileName}
            title="Delete profile"
            aria-label="Delete profile"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showGenerator ? (
        <TizenCertificates
          defaultDeviceIds={knownDuids}
          onClose={() => setShowGenerator(false)}
          onGenerated={async (name) => {
            setShowGenerator(false);
            await refresh();
            onChange(name);
          }}
        />
      ) : (
        <Button
          variant={profiles.length === 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setShowGenerator(true)}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
          Create certificate
        </Button>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete signing profile?"
        description={`"${pendingDelete}" will be removed from your Tizen security profiles.`}
        confirmLabel="Delete"
        onConfirm={deleteProfile}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
