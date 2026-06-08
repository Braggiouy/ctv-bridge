import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Package,
  Bookmark,
  Info,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Check,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { TOAST_DURATION, useGlobalLogs } from "@/utils";
import { SavedPathsList } from "./SavedPathsList";
import { ProjectPathInput } from "./ProjectPathInput";
import { BuildOutput } from "./BuildOutput";
import { useBuildProcess } from "@/hooks/steps/useBuildProcess";
import { TizenCertificates } from "../DeviceSetupStep/TizenCertificates";

interface SavedPath {
  name: string;
  path: string;
}

interface BuildStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Main BuildStep component (refactored)
 * Orchestrates the build process
 */
export const BuildStep = ({ onNext, onBack }: BuildStepProps) => {
  const { addLog } = useGlobalLogs();
  const platform =
    (localStorage.getItem("platform") as "tizen" | "webos" | "android") ||
    "tizen";
  const savedPathsEnabled = platform !== "tizen";
  const projectPathStorageKey = `${platform}_projectPath`;
  const savedPathsStorageKey = `${platform}_savedBuildPaths`;
  const selectedProfileStorageKey = `${platform}_selectedProfile`;

  // Project path state
  const [projectPath, setProjectPath] = useState(
    localStorage.getItem(projectPathStorageKey) || ""
  );

  // Saved paths state
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>(() => {
    if (!savedPathsEnabled) {
      return [];
    }

    try {
      return JSON.parse(localStorage.getItem(savedPathsStorageKey) || "[]");
    } catch {
      return [];
    }
  });

  // Build process hook
  const {
    building,
    isPackageGenerated,
    generatedPackageInfo,
    lastBuildMessage,
    tizenProfiles,
    fetchTizenProfiles,
    deleteTizenProfile,
    executeBuild,
  } = useBuildProcess(platform);

  const [selectedProfile, setSelectedProfile] = useState(
    localStorage.getItem(selectedProfileStorageKey) || ""
  );
  const [refreshingProfiles, setRefreshingProfiles] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<string | null>(null);
  const [showCertManager, setShowCertManager] = useState(false);
  const [pendingDeleteProfile, setPendingDeleteProfile] = useState<
    string | null
  >(null);

  const refreshProfiles = useCallback(async () => {
    if (platform !== "tizen") return;
    setRefreshingProfiles(true);
    try {
      await fetchTizenProfiles();
    } finally {
      setRefreshingProfiles(false);
    }
  }, [platform, fetchTizenProfiles]);

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  // Keep selected profile valid and deterministic when profile list changes
  useEffect(() => {
    if (platform !== "tizen") return;

    if (tizenProfiles.length === 0) {
      setSelectedProfile("");
      localStorage.removeItem(selectedProfileStorageKey);
      return;
    }

    const selectedStillExists = tizenProfiles.some(
      (profile) => profile.name === selectedProfile
    );
    if (selectedProfile && selectedStillExists) return;

    const active = tizenProfiles.find((profile) => profile.active);
    const fallback = active?.name || tizenProfiles[0].name;
    setSelectedProfile(fallback);
    localStorage.setItem(selectedProfileStorageKey, fallback);
  }, [tizenProfiles, selectedProfile, selectedProfileStorageKey, platform]);

  const handleDeleteProfile = async (profileName: string) => {
    setDeletingProfile(profileName);
    try {
      await deleteTizenProfile(profileName);
      toast.success("Profile deleted", {
        description: `${profileName} was removed.`,
        duration: TOAST_DURATION,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete profile";
      toast.error("Delete failed", {
        description: message,
        duration: TOAST_DURATION,
      });
    } finally {
      setDeletingProfile(null);
      setPendingDeleteProfile(null);
    }
  };

  const handleExecuteBuild = () => {
    if (platform === "tizen" && !selectedProfile) {
      toast.error("Certificate profile required", {
        description:
          "Create or select a Tizen certificate profile before generating a WGT.",
        duration: TOAST_DURATION,
      });
      return;
    }

    executeBuild(
      projectPath,
      platform === "tizen" ? selectedProfile : undefined
    );
    if (platform === "tizen" && selectedProfile) {
      localStorage.setItem(selectedProfileStorageKey, selectedProfile);
    }
  };

  const handleSavePath = () => {
    if (!savedPathsEnabled) return;
    if (!projectPath || savedPaths.length >= 3) return;

    const name = projectPath;
    if (savedPaths.some((p) => p.name === name)) {
      toast.error("Duplicate path", {
        description: "This path is already saved.",
        duration: TOAST_DURATION,
      });
      return;
    }

    const updated = [...savedPaths, { name, path: projectPath }];
    setSavedPaths(updated);
    localStorage.setItem(savedPathsStorageKey, JSON.stringify(updated));
    toast.success("Path saved", {
      description: `Saved as '${name}'`,
      duration: TOAST_DURATION,
    });
  };

  const handleSelectDirectory = async () => {
    try {
      let selectedPath;
      if (platform === "android") {
        selectedPath = await window.electron.invoke("select-file", [
          { name: "APK", extensions: ["apk"] },
        ]);
      } else {
        selectedPath = await window.electron.selectDirectory();
      }

      if (selectedPath) {
        setProjectPath(selectedPath);
        addLog("step", `Project path selected: ${selectedPath}`);
      }
    } catch (error: unknown) {
      const msg = `Error selecting path: ${
        error instanceof Error
          ? error.message
          : "An error occurred during the build process"
      }`;
      toast.error("Error", {
        description:
          (error as Error).message || "An error occurred during selection",
        duration: TOAST_DURATION,
      });
      addLog("error", msg);
    }
  };

  const handleNext = () => {
    if (!isPackageGenerated) {
      toast.error("Generate Package First", {
        description: "Please generate the WGT package before proceeding.",
        duration: TOAST_DURATION,
      });
      return;
    }
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Build Application
        </CardTitle>
        <CardDescription>
          {platform === "android"
            ? "Select your pre-built Android package (APK)"
            : `Generate a ${platform === "tizen" ? "WGT" : "IPK"} package from your pre-built ${platform} project`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {savedPathsEnabled && (
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-2 rounded bg-muted/60 px-3 py-2 border border-muted-foreground/10">
                <Bookmark className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  Your saved build paths will appear here. You can rename or
                  delete them. You can save up to 3 paths.
                </span>
              </div>
              {savedPaths.length > 0 && (
                <div>
                  <Label>Saved Build Paths</Label>
                  <div className="flex flex-col gap-2 mt-1">
                    <SavedPathsList
                      platform={platform}
                      savedPaths={savedPaths}
                      setSavedPaths={setSavedPaths}
                      setProjectPath={setProjectPath}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <ProjectPathInput
            platform={platform}
            projectPath={projectPath}
            onPathChange={setProjectPath}
            onBrowse={handleSelectDirectory}
            onSavePath={handleSavePath}
            savedPathsCount={savedPathsEnabled ? savedPaths.length : 0}
            savedPathsEnabled={savedPathsEnabled}
          />
        </div>

        {platform === "tizen" && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="profile-select" className="text-sm font-semibold">
                Samsung Certificates
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowCertManager((prev) => !prev)}
                  disabled={building}
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  {showCertManager ? "Hide generator" : "Generate certificates"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={refreshProfiles}
                  disabled={building || refreshingProfiles}
                >
                  {refreshingProfiles ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Refreshing
                    </>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
            </div>

            {refreshingProfiles ? (
              <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking certificate profiles...
              </div>
            ) : tizenProfiles.length === 0 ? (
              <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                No certificate profiles found.
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background px-3 py-2 text-xs flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {tizenProfiles.length === 1
                  ? "Certificate profile ready"
                  : `${tizenProfiles.length} certificate profiles ready`}
              </div>
            )}

            {tizenProfiles.length > 0 && (
              <div className="space-y-2">
                <div className="space-y-2 rounded-md border border-border bg-background p-2">
                  {tizenProfiles.map((profile) => {
                    const isSelected = selectedProfile === profile.name;

                    return (
                      <div
                        key={profile.name}
                        className="flex items-center justify-between rounded border border-border px-2 py-1.5"
                      >
                        <div className="text-xs">
                          <p className="font-medium text-foreground">
                            {profile.name}
                          </p>
                          <p className="text-muted-foreground">
                            {profile.active ? "Active" : "Available"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedProfile(profile.name)}
                            disabled={building || refreshingProfiles}
                          >
                            {isSelected ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Selected
                              </>
                            ) : (
                              "Use"
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() =>
                              setPendingDeleteProfile(profile.name)
                            }
                            disabled={
                              deletingProfile === profile.name || building
                            }
                            title={`Delete ${profile.name}`}
                          >
                            {deletingProfile === profile.name ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showCertManager && (
              <TizenCertificates
                onClose={() => setShowCertManager(false)}
                onGenerated={() => {
                  setShowCertManager(false);
                  void refreshProfiles();
                }}
              />
            )}

            {tizenProfiles.length > 0 && selectedProfile && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Using {selectedProfile} for signing.
              </p>
            )}
          </div>
        )}

        {isPackageGenerated && (
          <BuildOutput
            packageInfo={generatedPackageInfo}
            message={lastBuildMessage}
          />
        )}

        <div className="flex gap-3 pt-4">
          <Button onClick={onBack} variant="outline">
            <span className="mr-2">&lt;</span> Back
          </Button>
          <Button
            onClick={handleExecuteBuild}
            disabled={building}
            variant="outline"
            className="flex-1"
          >
            {building && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {platform === "android"
              ? "Verify APK"
              : `Generate ${platform === "tizen" ? "WGT" : "IPK"} Package`}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    onClick={handleNext}
                    className="w-full"
                    disabled={!isPackageGenerated}
                  >
                    Next: Deploy
                  </Button>
                </span>
              </TooltipTrigger>
              {!isPackageGenerated && (
                <TooltipContent side="top">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span>
                      Generate a {platform === "tizen" ? "WGT" : "IPK"} package
                      before deploying.
                    </span>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        <AlertDialog
          open={pendingDeleteProfile !== null}
          onOpenChange={(open) => {
            if (!open && !deletingProfile) {
              setPendingDeleteProfile(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Certificate Profile?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDeleteProfile
                  ? `This will remove "${pendingDeleteProfile}" from your Tizen security profiles.`
                  : "This will remove the selected profile."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingProfile}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={(event) => {
                  if (!pendingDeleteProfile) return;
                  event.preventDefault();
                  void handleDeleteProfile(pendingDeleteProfile);
                }}
                disabled={!!deletingProfile}
              >
                {deletingProfile ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
