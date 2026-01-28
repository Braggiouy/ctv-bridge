import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Trash2 } from "lucide-react";

interface SavedPath {
  name: string;
  path: string;
}

interface SavedPathsListProps {
  platform: "tizen" | "webos";
  savedPaths: SavedPath[];
  setSavedPaths: React.Dispatch<React.SetStateAction<SavedPath[]>>;
  setProjectPath: (path: string) => void;
}

export const SavedPathsList = ({
  platform,
  savedPaths,
  setSavedPaths,
  setProjectPath,
}: SavedPathsListProps) => {
  const [editIdx, setEditIdx] = React.useState<number | null>(null);
  const [editValue, setEditValue] = React.useState("");

  const storageKey = `${platform}_savedBuildPaths`;

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditValue(savedPaths[idx].name);
  };

  const cancelEdit = () => {
    setEditIdx(null);
    setEditValue("");
  };

  const saveEdit = () => {
    if (editIdx === null) return;

    const trimmedValue = editValue.trim();
    if (
      !trimmedValue ||
      savedPaths.some((p, i) => i !== editIdx && p.name === trimmedValue)
    ) {
      return;
    }

    const updatedPaths = savedPaths.map((p, i) =>
      i === editIdx ? { ...p, name: trimmedValue } : p
    );
    setSavedPaths(updatedPaths);
    localStorage.setItem(storageKey, JSON.stringify(updatedPaths));
    cancelEdit();
  };

  const removePath = (idx: number) => {
    const updatedPaths = savedPaths.filter((_, i) => i !== idx);
    setSavedPaths(updatedPaths);
    localStorage.setItem(storageKey, JSON.stringify(updatedPaths));
  };

  return (
    <div className="flex flex-col gap-2 mt-1">
      {savedPaths.map((p, idx) => (
        <div
          key={`${p.name}-${p.path}-${idx}`}
          className="flex flex-col border rounded px-2 py-1 bg-muted/10 hover:bg-muted/20"
        >
          <div className="flex items-center gap-2">
            {editIdx === idx ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-sm font-medium bg-transparent border-0 focus:ring-0 focus:outline-none flex-1 h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:bg-green-50"
                  aria-label="Save title"
                  onClick={saveEdit}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:bg-muted"
                  aria-label="Cancel edit"
                  onClick={cancelEdit}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setProjectPath(p.path)}
                  className="flex items-center gap-1 flex-1 text-left hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
                  aria-label="Use this path"
                >
                  <span className="text-sm font-medium truncate">{p.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-muted"
                  aria-label="Edit title"
                  onClick={() => startEdit(idx)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </>
            )}
            <button
              onClick={() => removePath(idx)}
              className="flex items-center gap-1 p-1 text-xs bg-muted/10 rounded hover:bg-muted/20 hover:text-red-600 text-muted-foreground transition-colors"
              aria-label="Delete path"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
          <div className="text-xs text-muted-foreground pl-2 pt-0.5 break-all opacity-70">
            {p.path}
          </div>
        </div>
      ))}
    </div>
  );
};
