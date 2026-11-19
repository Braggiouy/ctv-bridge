import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/PasswordInput";
import type { TizenCertificateParams } from "@/types";
import { addLog, notify, type LogType } from "@/utils";

type PrivilegeLevel = NonNullable<TizenCertificateParams["privilegeLevel"]>;
type DeveloperType = NonNullable<TizenCertificateParams["developerType"]>;

const DEFAULT_PASSWORD = "tizencert";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIVILEGE_LEVELS: PrivilegeLevel[] = ["Public", "Partner", "Platform"];
const DEVELOPER_TYPES: DeveloperType[] = ["Individual", "Corporation"];

export const FIELD_CLASSNAME =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function classifyLogLine(line: string): LogType {
  if (line.startsWith("Error:")) return "error";
  if (line.startsWith("Warning:")) return "warning";
  if (/successful|ready|Done!/i.test(line)) return "step";
  return "info";
}

interface TizenCertificatesProps {
  /** DUIDs of TVs CTV Bridge has already connected to. */
  defaultDeviceIds: string[];
  onGenerated: (profileName: string) => void;
}

/** Samsung sign-in, then author + distributor certificates registered as a security profile. */
export const TizenCertificates = ({
  defaultDeviceIds,
  onGenerated,
}: TizenCertificatesProps) => {
  const [signedIn, setSignedIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const loginAttempt = useRef(0);
  const [error, setError] = useState("");
  const [certPath, setCertPath] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [deviceIds, setDeviceIds] = useState(defaultDeviceIds.join("\n"));
  const [password, setPassword] = useState("");
  const [profileName, setProfileName] = useState("ctv-bridge");
  const [privilegeLevel, setPrivilegeLevel] =
    useState<PrivilegeLevel>("Public");
  const [developerType, setDeveloperType] =
    useState<DeveloperType>("Individual");

  const busy = signingIn || generating;
  const duids = deviceIds
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  const missing = [
    !EMAIL_PATTERN.test(email.trim()) && "a valid email",
    duids.length === 0 && "at least one DUID",
    !profileName.trim() && "a profile name",
  ].filter(Boolean);

  useEffect(
    () =>
      window.electron.tizen.onCertificateLog((line) => {
        setProgress(line);
        addLog(classifyLogLine(line), `[Certificates] ${line}`);
      }),
    []
  );

  const signIn = async () => {
    const attempt = ++loginAttempt.current;
    setSigningIn(true);
    setError("");
    const result = await window.electron.tizen.login();
    // Cancelled, or replaced by a newer attempt.
    if (attempt !== loginAttempt.current) return;
    setSigningIn(false);
    if (result.success) {
      setSignedIn(true);
      if (result.email) setEmail(result.email);
    } else if (!result.cancelled) {
      setError(result.message ?? "Samsung sign-in failed");
    }
  };

  const cancelSignIn = () => {
    loginAttempt.current++;
    setSigningIn(false);
    void window.electron.tizen.cancelLogin();
  };

  const signOut = async () => {
    await window.electron.tizen.logout();
    setSignedIn(false);
    setCertPath(null);
  };

  const generate = async () => {
    setGenerating(true);
    setError("");
    setCertPath(null);
    const name = profileName.trim();
    const result = await window.electron.tizen.generateCertificates({
      email: email.trim(),
      deviceIds: duids,
      password: password.trim() || undefined,
      privilegeLevel,
      developerType,
      profileName: name,
    });
    setGenerating(false);
    if (result.success) {
      setCertPath(result.path ?? null);
      notify.success(
        "Certificates created",
        `Signing profile "${name}" is ready.`
      );
      onGenerated(name);
    } else {
      setError(result.message ?? "Certificate generation failed");
    }
  };

  return (
    <div className="space-y-4">
      {!signedIn ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Sign in with your Samsung account in the browser. The certificate is
            then created and registered as a signing profile automatically.
          </p>
          <div className="flex gap-2">
            <Button onClick={signIn} disabled={busy}>
              {signingIn && <Loader2 className="h-4 w-4 animate-spin" />}
              {signingIn ? "Signing in…" : "Sign in with Samsung"}
            </Button>
            {signingIn && (
              <Button variant="outline" onClick={cancelSignIn}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Signed in to Samsung
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} disabled={busy}>
              Sign out
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cert-email">Samsung account email</Label>
              <Input
                id="cert-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-profile">Profile name</Label>
              <Input
                id="cert-profile"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cert-duids">TV DUIDs (one per line)</Label>
              <textarea
                id="cert-duids"
                className={`${FIELD_CLASSNAME} min-h-20`}
                value={deviceIds}
                onChange={(e) => setDeviceIds(e.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                {defaultDeviceIds.length > 0
                  ? "Pre-filled from the TVs you've connected. "
                  : "Connect to the TV first to fill this in automatically, or find it on the TV under Developer options. "}
                The app only installs on TVs listed here.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-privilege">Privilege level</Label>
              <select
                id="cert-privilege"
                className={`${FIELD_CLASSNAME} h-10`}
                value={privilegeLevel}
                onChange={(e) =>
                  setPrivilegeLevel(e.target.value as PrivilegeLevel)
                }
                disabled={busy}
              >
                {PRIVILEGE_LEVELS.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-developer-type">Developer type</Label>
              <select
                id="cert-developer-type"
                className={`${FIELD_CLASSNAME} h-10`}
                value={developerType}
                onChange={(e) =>
                  setDeveloperType(e.target.value as DeveloperType)
                }
                disabled={busy}
              >
                {DEVELOPER_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cert-password">Certificate password</Label>
              <PasswordInput
                id="cert-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Leave blank to use "${DEFAULT_PASSWORD}"`}
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={generate} disabled={busy || missing.length > 0}>
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              {generating ? "Creating…" : "Create certificate"}
            </Button>
            {missing.length > 0 && !busy && (
              <span className="text-xs text-muted-foreground">
                Needs {missing.join(", ")}.
              </span>
            )}
          </div>
        </>
      )}

      {busy && progress && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {progress}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {certPath && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.electron.showInFolder(certPath)}
        >
          <FolderOpen className="h-4 w-4" />
          Show certificate files
        </Button>
      )}
    </div>
  );
};
