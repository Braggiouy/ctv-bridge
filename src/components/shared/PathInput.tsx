import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PathInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Pick a directory instead of a file. */
  directory?: boolean;
  extensions?: string[];
  disabled?: boolean;
}

/** Text input with a native file/folder picker next to it. */
export const PathInput = ({
  id,
  value,
  onChange,
  placeholder,
  directory,
  extensions,
  disabled,
}: PathInputProps) => {
  const browse = async () => {
    const selected = directory
      ? await window.electron.selectDirectory()
      : await window.electron.selectFile(extensions);
    if (selected) onChange(selected);
  };

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="font-mono text-sm"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={browse}
        disabled={disabled}
        aria-label={directory ? "Choose folder" : "Choose file"}
        title={directory ? "Choose folder" : "Choose file"}
      >
        <FolderOpen className="h-4 w-4" />
      </Button>
    </div>
  );
};
