import { useState, type KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CornerUpLeft,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { RemoteKey } from "@/types";
import { addLog, cn, notify } from "@/utils";

const BUTTONS: { key: RemoteKey; label: string; icon?: LucideIcon }[] = [
  { key: "left", label: "Left", icon: ArrowLeft },
  { key: "up", label: "Up", icon: ArrowUp },
  { key: "down", label: "Down", icon: ArrowDown },
  { key: "right", label: "Right", icon: ArrowRight },
  { key: "enter", label: "OK" },
  { key: "back", label: "Back", icon: CornerUpLeft },
];

const KEYBOARD: Record<string, RemoteKey> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "enter",
  Backspace: "back",
  Escape: "back",
};

const buttonClass =
  "flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

/** Remote buttons and a screenshot button for the app being debugged. Arrow keys, Enter and Backspace work while it has focus. */
export const RemoteControl = ({ disabled }: { disabled: boolean }) => {
  const [capturing, setCapturing] = useState(false);

  const press = async (key: RemoteKey) => {
    const result = await window.electron.remote.press(key);
    if (!result.success) notify.error("Remote key failed", result.message);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const key = KEYBOARD[event.key];
    if (!key || disabled || event.target !== event.currentTarget) return;
    event.preventDefault();
    press(key);
  };

  const screenshot = async () => {
    setCapturing(true);
    const result = await window.electron.remote.screenshot();
    setCapturing(false);
    if (!result.success || !result.path) {
      notify.error("Screenshot failed", result.message);
      return;
    }
    const path = result.path;
    addLog("step", `Screenshot saved to ${path} and copied to the clipboard`);
    toast.success("Screenshot copied to the clipboard", {
      description: path,
      duration: 5000,
      action: {
        label: "Show",
        onClick: () => window.electron.showInFolder(path),
      },
    });
  };

  return (
    <div className="flex items-center gap-1">
      <div
        role="group"
        aria-label="TV remote"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        title="TV remote: click here to use the arrow keys, Enter and Backspace"
        className={cn(
          "flex items-center rounded-md bg-muted p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "opacity-50"
        )}
      >
        {BUTTONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => press(key)}
            className={cn(buttonClass, !Icon && "font-semibold")}
            title={label}
            aria-label={label}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || capturing}
        onClick={screenshot}
        className={cn(buttonClass, "h-7 w-7")}
        title="Screenshot of the app (saved to Pictures and copied)"
        aria-label="Take a screenshot of the app"
      >
        <Camera className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
