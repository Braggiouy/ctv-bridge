import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";

export const SavedPathsList = ({
  savedPaths,
  setSavedPaths,
  setProjectPath,
}) => {
  const [editIdx, setEditIdx] = React.useState(null);
  const [editValue, setEditValue] = React.useState("");

  const startEdit = (idx) => {
    setEditIdx(idx);
    setEditValue(savedPaths[idx].name);
  };

  const cancelEdit = () => {
    setEditIdx(null);
    setEditValue("");
  };

  const saveEdit = () => {
    if (
      !editValue.trim() ||
      savedPaths.some((p, i) => i !== editIdx && p.name === editValue.trim())
    ) {
      // Optionally show error toast here
      return;
    }
    const updatedPaths = savedPaths.map((p, i) =>
      i === editIdx ? { ...p, name: editValue.trim() } : p
    );
    setSavedPaths(updatedPaths);
    localStorage.setItem("savedBuildPaths", JSON.stringify(updatedPaths));
    cancelEdit();
  };

  return (
    <div className="flex flex-col gap-2 mt-1">
      {savedPaths.map((p, idx) => (
        <div
          key={p.name + p.path}
          className="flex flex-col border rounded px-2 py-1 bg-muted/10 hover:bg-muted/20"
        >
          <div className="flex items-center gap-2">
            {editIdx === idx ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-sm font-medium bg-transparent border-0 focus:ring-0 focus:outline-none flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-green-600 hover:bg-green-50"
                  aria-label="Save title"
                  onClick={saveEdit}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:bg-muted"
                  aria-label="Cancel edit"
                  onClick={cancelEdit}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
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
                  className="text-muted-foreground hover:bg-muted"
                  aria-label="Edit title"
                  onClick={() => startEdit(idx)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </>
            )}
            <button
              onClick={() => {
                const updatedPaths = savedPaths.filter((_, i) => i !== idx);
                setSavedPaths(updatedPaths);
                localStorage.setItem(
                  "savedBuildPaths",
                  JSON.stringify(updatedPaths)
                );
              }}
              className={
                "flex items-center gap-1 p-1 text-xs bg-muted/10 rounded hover:bg-muted/20 hover:text-red-600 text-muted-foreground"
              }
              aria-label="Delete path"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-3 h-3"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Delete
            </button>
          </div>
          <div className="text-xs text-muted-foreground pl-2 pt-1 break-all">
            {p.path}
          </div>
        </div>
      ))}
    </div>
  );
};
