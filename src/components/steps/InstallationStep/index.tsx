import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useGlobalLogs, validateSdkPaths } from "@/utils";
import { TizenSetup } from "./TizenSetup";
import { WebOSSetup } from "./WebOSSetup";

interface InstallationStepProps {
  onNext: () => void;
}

/**
 * Main InstallationStep component (refactored)
 * Orchestrates SDK installation and configuration
 */
export const InstallationStep = ({ onNext }: InstallationStepProps) => {
  const { addLog } = useGlobalLogs();

  // Platform selection
  const [platform, setPlatform] = useState<"tizen" | "webos">(
    (localStorage.getItem("platform") as "tizen" | "webos") || "tizen"
  );

  // SDK paths
  const [sdbPath, setSdbPath] = useState(localStorage.getItem("sdbPath") || "");
  const [tizenPath, setTizenPath] = useState(
    localStorage.getItem("tizenPath") || ""
  );
  const [aresPath, setAresPath] = useState(
    localStorage.getItem("aresPath") || ""
  );

  const handleNext = async () => {
    // Validate paths
    const validation = validateSdkPaths(platform, {
      sdbPath,
      tizenPath,
      aresPath,
    });

    if (!validation.valid) {
      const errorMessage = validation.errors.join(". ");
      toast.error(platform === "tizen" ? "Missing Paths" : "Missing Path", {
        description:
          platform === "tizen"
            ? "Please enter all required SDK paths before proceeding."
            : "Please enter the webOS CLI path before proceeding.",
      });
      addLog("error", `Validation failed: ${errorMessage}`);
      return;
    }

    // Save to localStorage (for renderer process)
    localStorage.setItem("platform", platform);
    localStorage.setItem("sdbPath", sdbPath);
    localStorage.setItem("tizenPath", tizenPath);
    localStorage.setItem("aresPath", aresPath);

    // Save to electron store (for main process)
    try {
      await window.electron.invoke("save-sdk-paths", {
        sdbPath,
        tizenPath,
        aresPath,
      });
    } catch (error) {
      console.error("Failed to save SDK paths to electron store:", error);
    }

    toast.success("SDK Configuration Saved", {
      description: "Your SDK paths have been configured successfully.",
    });
    addLog("step", "SDK configuration saved for platform: " + platform);
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          SDK Installation & Setup
        </CardTitle>
        <CardDescription>
          Choose your platform and configure the required development tools
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs
          value={platform}
          onValueChange={(value) => setPlatform(value as "tizen" | "webos")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tizen">Tizen (Samsung)</TabsTrigger>
            <TabsTrigger value="webos">webOS (LG)</TabsTrigger>
          </TabsList>

          <TabsContent value="tizen">
            <TizenSetup
              sdbPath={sdbPath}
              tizenPath={tizenPath}
              onSdbPathChange={setSdbPath}
              onTizenPathChange={setTizenPath}
            />
          </TabsContent>

          <TabsContent value="webos">
            <WebOSSetup aresPath={aresPath} onAresPathChange={setAresPath} />
          </TabsContent>
        </Tabs>

        <div className="pt-4">
          <Button onClick={handleNext} className="w-full">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Next: Configure TV Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
