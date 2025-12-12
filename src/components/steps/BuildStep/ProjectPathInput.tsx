import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FolderOpen, Bookmark, Info } from "lucide-react";
import { TIZEN_CONFIG, WEBOS_CONFIG } from "@/utils";

interface ProjectPathInputProps {
  platform: "tizen" | "webos";
  projectPath: string;
  onPathChange: (path: string) => void;
  onBrowse: () => void;
  onSavePath: () => void;
  savedPathsCount: number;
}

/**
 * Project path input with browse and save functionality
 */
export const ProjectPathInput = ({
  platform,
  projectPath,
  onPathChange,
  onBrowse,
  onSavePath,
  savedPathsCount,
}: ProjectPathInputProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="projectPath">
        {platform === "tizen" ? "Tizen" : "webOS"} Project Path
      </Label>
      <div className="flex gap-2">
        <Input
          id="projectPath"
          placeholder={`/path/to/your/${platform}/project`}
          value={projectPath}
          onChange={(e) => onPathChange(e.target.value)}
          className="font-mono text-sm flex-1"
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onBrowse}
                aria-label="Select directory"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span>Select a directory from your filesystem</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onSavePath}
                disabled={!projectPath || savedPathsCount >= 3}
                aria-label="Save path"
              >
                <Bookmark className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span>Save the current path for quick access</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-xs text-muted-foreground">
        Path to your pre-built {platform === "tizen" ? "Tizen" : "webOS"}{" "}
        project directory.
      </p>
      <div className="flex items-center gap-2 mt-2 px-2 py-1 rounded bg-muted/40">
        <Info className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Tip:{" "}
          {platform === "tizen"
            ? TIZEN_CONFIG.BUILD_TIP
            : WEBOS_CONFIG.BUILD_TIP}
        </span>
      </div>
    </div>
  );
};
