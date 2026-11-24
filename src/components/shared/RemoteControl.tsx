import { useState, type KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CornerUpLeft,
  Ellipsis,
  FastForward,
  Pause,
  Play,
  Rewind,
  Square,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ColorKey, DigitKey, MediaKey, RemoteKey } from "@/types";
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
  ...Object.fromEntries(
    [..."0123456789"].map((digit) => [digit, digit as DigitKey])
  ),
};

const COLOR_KEYS: { key: ColorKey; className: string }[] = [
  { key: "red", className: "bg-red-500" },
  { key: "green", className: "bg-green-500" },
  { key: "yellow", className: "bg-yellow-400" },
  { key: "blue", className: "bg-blue-500" },
];

const MEDIA_KEYS: { key: MediaKey; label: string; icon: LucideIcon }[] = [
  { key: "rewind", label: "Rewind", icon: Rewind },
  { key: "play", label: "Play", icon: Play },
  { key: "pause", label: "Pause", icon: Pause },
  { key: "stop", label: "Stop", icon: Square },
  { key: "fastForward", label: "Fast-forward", icon: FastForward },
];

const DIGITS = [..."1234567890"] as DigitKey[];

const press = async (key: RemoteKey) => {
  const result = await window.electron.remote.press(key);
  if (!result.success) notify.error("Remote key failed", result.message);
};

const buttonClass =
  "flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

/**
 * Remote buttons and a screenshot button for the app being debugged. Arrow
 * keys, Enter, Backspace and digits work while it has focus. `expanded`
 * toggles the RemoteKeypad, which the caller renders.
 */
export const RemoteControl = ({
  disabled,
  expanded,
  onExpandedChange,
}: {
  disabled: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) => {
  const [capturing, setCapturing] = useState(false);

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
        title="TV remote: click here to use the arrow keys, Enter, Backspace and digits"
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
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onExpandedChange(!expanded)}
          className={cn(
            buttonClass,
            expanded && "bg-background text-foreground"
          )}
          aria-pressed={expanded}
          title="Colour, media and number keys"
          aria-label="More keys"
        >
          <Ellipsis className="h-3.5 w-3.5" />
        </button>
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

/** Colour, media and number keys, shown under the console header. */
export const RemoteKeypad = ({ disabled }: { disabled: boolean }) => (
  <div
    role="group"
    aria-label="More TV remote keys"
    title="Sent straight to the app. Tizen apps must still register these keys (tizen.tvinputdevice.registerKey) to get them from a real remote."
    className={cn(
      "flex flex-wrap items-center gap-3 border-b px-4 py-1",
      disabled && "opacity-50"
    )}
  >
    <div className="flex items-center gap-1">
      {COLOR_KEYS.map(({ key, className }) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => press(key)}
          className={cn(buttonClass, "w-6")}
          title={key[0].toUpperCase() + key.slice(1)}
          aria-label={`${key} key`}
        >
          <span className={cn("h-2.5 w-4 rounded-sm", className)} />
        </button>
      ))}
    </div>
    <div className="flex items-center gap-1">
      {MEDIA_KEYS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => press(key)}
          className={buttonClass}
          title={label}
          aria-label={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
    <div className="flex items-center gap-0.5">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => press(digit)}
          className={cn(buttonClass, "font-mono")}
          aria-label={`Number ${digit}`}
        >
          {digit}
        </button>
      ))}
    </div>
  </div>
);
