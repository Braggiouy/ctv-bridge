import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, CheckCircle2, ShieldCheck, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { TOAST_DURATION, useGlobalLogs, mergeClassNames } from "@/utils";
import { classifyCertLogLine } from "./tizenCertLog";

type Status = "idle" | "generating" | "success" | "error";
type LoginStatus = "signed-out" | "signing-in" | "signed-in";
type PrivilegeLevel = "Public" | "Partner" | "Platform";
type DeveloperType = "Individual" | "Corporation";

const STATUS_LINE_BUFFER = 5;
const DEFAULT_PASSWORD = "tizencert";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PRIVILEGE_LEVELS: PrivilegeLevel[] = ["Public", "Partner", "Platform"];
const DEVELOPER_TYPES: DeveloperType[] = ["Individual", "Corporation"];

const SELECT_CLASSNAME =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASSNAME =
  "flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const STEPS = [
  "Sign in with your Samsung account.",
  "Fill certificate values and generate PKCS12 files.",
] as const;

interface TizenCertificatesProps {
  onClose: () => void;
  onGenerated?: () => void;
}

/**
 * Guided Tizen certificate wizard (Device Setup step).
 */
export const TizenCertificates = ({
  onClose,
  onGenerated,
}: TizenCertificatesProps) => {
  const { addLog } = useGlobalLogs();

  const [email, setEmail] = useState("");
  const [deviceIds, setDeviceIds] = useState("");
  const [password, setPassword] = useState("");
  const [profileName, setProfileName] = useState("");
  const [privilegeLevel, setPrivilegeLevel] =
    useState<PrivilegeLevel>("Public");
  const [developerType, setDeveloperType] =
    useState<DeveloperType>("Individual");
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("signed-out");

  const [status, setStatus] = useState<Status>("idle");
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [certPath, setCertPath] = useState<string | null>(null);

  const isGenerating = status === "generating";
  const isSigningIn = loginStatus === "signing-in";
  const isBusy = isGenerating || isSigningIn;
  const isEmailValid = EMAIL_PATTERN.test(email.trim());
  const hasCommaSeparatedDeviceIds = deviceIds.includes(",");
  const hasNoDeviceIds = deviceIds.trim().length === 0;
  const isGenerateDisabled =
    isBusy ||
    (email.length > 0 && !isEmailValid) ||
    hasNoDeviceIds ||
    hasCommaSeparatedDeviceIds;

  const generateDisabledReason = (() => {
    if (isGenerating) return "Certificate generation is already in progress.";
    if (isSigningIn)
      return "Finish Samsung login before generating certificates.";
    if (email.length > 0 && !isEmailValid)
      return "Enter a valid Samsung account email to continue.";
    if (hasNoDeviceIds)
      return "Add at least 1 DUID. Use one Unique Device ID per line.";
    if (hasCommaSeparatedDeviceIds)
      return "Invalid DUID format. Use one Unique Device ID per line (no commas).";
    return "Complete required fields to continue.";
  })();

  useEffect(() => {
    const cleanup = window.electron.onTizenCertLog((log: string) => {
      setStatusLines((prev) => [...prev, log].slice(-STATUS_LINE_BUFFER));
      addLog(classifyCertLogLine(log), `[Certificates] ${log}`);
    });
    return cleanup;
  }, [addLog]);

  const handleSamsungLogin = async () => {
    setLoginStatus("signing-in");
    setStatusLines(["Starting Samsung login…"]);
    setErrorMessage("");

    try {
      const result = await window.electron.loginTizenCertificateSession();
      if (result.success) {
        setLoginStatus("signed-in");
        if (result.email) {
          setEmail(result.email);
        }
        toast.success("Samsung login successful", {
          description: result.email
            ? "Email was pre-filled from your Samsung session."
            : "Continue by entering your certificate details.",
          duration: TOAST_DURATION,
        });
      } else {
        setLoginStatus("signed-out");
        if (result.cancelled) {
          setErrorMessage("");
          toast("Samsung login cancelled", {
            description: "You can retry when ready.",
            duration: TOAST_DURATION,
          });
        } else {
          setErrorMessage(result.message || "Login failed");
          toast.error("Samsung login failed", {
            description: result.message,
            duration: TOAST_DURATION,
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setLoginStatus("signed-out");
      setErrorMessage(message);
      toast.error("Samsung login failed", { description: message });
    }
  };

  const handleCancelSamsungLogin = async () => {
    try {
      const result = await window.electron.cancelTizenCertificateLogin();
      if (!result.success && result.message) {
        toast(result.message, { duration: TOAST_DURATION });
      }
      setLoginStatus("signed-out");
      setStatusLines((prev) =>
        [...prev, "Cancelling Samsung login…"].slice(-5)
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to cancel login", { description: message });
    }
  };

  const handleSamsungLogout = async () => {
    try {
      await window.electron.logoutTizenCertificateSession();
      setLoginStatus("signed-out");
      setStatus("idle");
      setStatusLines([]);
      setCertPath(null);
      setErrorMessage("");
      toast.success("Signed out", {
        description: "Samsung session cleared.",
        duration: TOAST_DURATION,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to sign out", { description: message });
    }
  };

  const handleGenerate = async () => {
    if (loginStatus !== "signed-in") {
      toast.error("Samsung login required", {
        description: "Sign in with Samsung before generating certificates.",
        duration: TOAST_DURATION,
      });
      return;
    }

    if (!isEmailValid) {
      toast.error("Valid email required", {
        description: "Use the same email as your Samsung developer account.",
        duration: TOAST_DURATION,
      });
      return;
    }

    const normalizedDeviceIds = deviceIds
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (normalizedDeviceIds.length === 0) {
      toast.error("Unique Device ID required", {
        description:
          "Add at least one Unique Device ID to generate a deployable distributor certificate.",
        duration: TOAST_DURATION,
      });
      return;
    }

    if (deviceIds.includes(",")) {
      toast.error("Invalid Unique Device ID format", {
        description: "Use one Unique Device ID per line (no commas).",
        duration: TOAST_DURATION,
      });
      return;
    }

    setStatus("generating");
    setStatusLines(["Starting…"]);
    setErrorMessage("");
    setCertPath(null);
    addLog("step", "[Certificates] Starting certificate generation…");

    try {
      const result = await window.electron.generateTizenCertificates({
        email: email.trim(),
        deviceIds: normalizedDeviceIds,
        password: password.trim() || undefined,
        privilegeLevel,
        developerType,
        profileName: profileName.trim() || undefined,
      });

      if (result.success) {
        setCertPath(result.path ?? null);
        setStatus("success");
        toast.success("Certificates ready", {
          description: "author.p12 and distributor.p12 were created.",
          duration: TOAST_DURATION,
        });
        onGenerated?.();
      } else {
        setStatus("error");
        setErrorMessage(result.message || "Unknown error");
        toast.error("Generation failed", {
          description: result.message,
          duration: TOAST_DURATION,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus("error");
      setErrorMessage(message);
      toast.error("Generation failed", { description: message });
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded bg-card">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Tizen certificates</h3>
      </div>

      <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
        <p className="font-medium">Step 1: Samsung login</p>
        <p className="text-muted-foreground">
          Sign in once, then complete certificate details.
        </p>
        <div className="flex gap-2">
          {loginStatus !== "signed-in" && (
            <Button
              variant="default"
              onClick={handleSamsungLogin}
              disabled={isBusy}
            >
              {isSigningIn ? "Opening browser…" : "Sign in with Samsung"}
            </Button>
          )}
          {isSigningIn && (
            <Button variant="outline" onClick={handleCancelSamsungLogin}>
              Cancel login
            </Button>
          )}
          {loginStatus === "signed-in" && !isSigningIn && (
            <Button variant="outline" onClick={handleSamsungLogout}>
              Sign out
            </Button>
          )}
          {loginStatus === "signed-in" && (
            <div className="inline-flex items-center text-green-600">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Signed in
            </div>
          )}
        </div>
      </div>

      {loginStatus === "signed-in" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="cert-email">Samsung account email</Label>
            <Input
              id="cert-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={isBusy}
            />
            {email.length > 0 && !isEmailValid && (
              <p className="text-xs text-red-500">
                Enter a valid email address.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cert-device-ids">Unique Device ID(s)</Label>
            <textarea
              id="cert-device-ids"
              className={TEXTAREA_CLASSNAME}
              value={deviceIds}
              onChange={(e) => setDeviceIds(e.target.value)}
              placeholder={"One Unique Device ID per line"}
              disabled={isBusy}
            />
            <p className="text-xs text-muted-foreground">
              Required to install on physical TVs. Add at least one Unique
              Device ID. You can add 1 DUID per line (no commas). Find it on the
              TV under Developer options, or run{" "}
              <code className="font-mono text-[11px]">sdb duid</code> while the
              TV is connected.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cert-privilege">Privilege level</Label>
              <select
                id="cert-privilege"
                className={SELECT_CLASSNAME}
                value={privilegeLevel}
                onChange={(e) =>
                  setPrivilegeLevel(e.target.value as PrivilegeLevel)
                }
                disabled={isBusy}
              >
                {PRIVILEGE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-developer-type">Developer type</Label>
              <select
                id="cert-developer-type"
                className={SELECT_CLASSNAME}
                value={developerType}
                onChange={(e) =>
                  setDeveloperType(e.target.value as DeveloperType)
                }
                disabled={isBusy}
              >
                {DEVELOPER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cert-password">Certificate password</Label>
            <Input
              id="cert-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Leave blank to use "${DEFAULT_PASSWORD}"`}
              disabled={isBusy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cert-profile-name">
              Security profile name (recommended)
            </Label>
            <Input
              id="cert-profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g. ctv-bridge"
              disabled={isBusy}
            />
            <p className="text-xs text-muted-foreground">
              Registers a Tizen security profile so you can pick it when
              building a <code className="font-mono text-[11px]">.wgt</code> in
              a later step.
            </p>
          </div>
        </>
      )}

      {statusLines.length > 0 && isBusy && (
        <div className="rounded-md bg-muted/40 border p-3 space-y-1 text-xs text-muted-foreground">
          {statusLines.map((line, idx) => {
            const isLast = idx === statusLines.length - 1;
            return (
              <div
                key={`${idx}-${line}`}
                className={mergeClassNames(
                  "flex gap-2",
                  !isLast && "opacity-60"
                )}
              >
                {isLast ? (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span>{line}</span>
              </div>
            );
          })}
        </div>
      )}

      {status === "success" && certPath && (
        <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 space-y-2 text-xs">
          <div className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <div>
              <p className="font-medium text-green-600">Certificates created</p>
              <p className="text-muted-foreground break-all mt-1">{certPath}</p>
              <ul className="mt-2 list-disc list-inside text-muted-foreground space-y-0.5">
                <li>
                  <code className="font-mono">author.p12</code> — signs your app
                </li>
                <li>
                  <code className="font-mono">distributor.p12</code> — allows
                  install on device(s)
                </li>
              </ul>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.electron.showInFolder(certPath)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open folder
          </Button>
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
          {errorMessage}
        </div>
      )}

      {loginStatus !== "signed-in" && (
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          Complete Step 1 first. The certificate form unlocks after Samsung
          login.
        </div>
      )}

      {loginStatus === "signed-in" && (
        <div className="flex gap-2 pt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    className="w-full"
                  >
                    {isGenerating ? "Working…" : "Generate certificates"}
                  </Button>
                </span>
              </TooltipTrigger>
              {isGenerateDisabled && (
                <TooltipContent side="top">
                  <span>{generateDisabledReason}</span>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            {isBusy ? "Please wait…" : "Close"}
          </Button>
        </div>
      )}

      {loginStatus !== "signed-in" && (
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            {isBusy ? "Please wait…" : "Close"}
          </Button>
        </div>
      )}
    </div>
  );
};
