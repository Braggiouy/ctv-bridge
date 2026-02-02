import React, { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/utils";

type AlertVariant = "blue" | "slate" | "amber";

interface SetupAlertProps {
  title: string;
  icon: LucideIcon;
  variant: AlertVariant;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const SetupAlert = ({
  title,
  icon: Icon,
  variant,
  children,
  defaultOpen = false,
}: SetupAlertProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const styles = {
    blue: {
      alert:
        "border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30",
      iconBox: "bg-blue-100 dark:bg-blue-900/60", // Adjusted to match generic structure
      icon: "text-blue-900 dark:text-blue-100", // Getting Started uses specific colors
      title: "text-blue-900 dark:text-blue-100",
    },
    slate: {
      alert:
        "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800",
      iconBox: "bg-slate-100 dark:bg-slate-800",
      icon: "text-slate-600 dark:text-slate-400",
      title: "text-slate-900 dark:text-slate-100",
    },
    amber: {
      alert:
        "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
      iconBox: "bg-amber-100 dark:bg-amber-900/60",
      icon: "text-amber-600 dark:text-amber-400",
      title: "text-amber-900 dark:text-amber-100",
    },
  };

  const currentStyle = styles[variant];

  // Specific override for blue variant (Getting Started) icon/text color logic if it varies
  // The original code had:
  // Info icon: text-blue-900
  // Title: text-blue-900
  // But no icon box background for blue in the original AndroidSetup?
  // Wait, AndroidSetup "Getting Started" didn't have a rounded icon box. It was just flex items-center gap-2.
  // The others (CLI Tools, Tips) have the rounded icon box.

  // To standardize, I will apply the rounded icon box to all, or handle the blue variant slightly differently.
  // Let's stick to the consistent rounded icon box design for all to be "accordion" like.

  return (
    <Alert className={cn("transition-all duration-200", currentStyle.alert)}>
      <AlertDescription className="space-y-0">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-1 rounded-full transition-colors",
                variant === "blue" ? "" : currentStyle.iconBox // Blue variant seemed to not have a box in original, but let's check.
                // Actually, for better clickability/visuals as an accordion, a box is nice.
                // Let's check the original code again.
                // Blue: <div className="flex items-center gap-2 font-semibold ..."> <Info .../> <span>Getting Started</span> </div>
                // Others: <div className="flex items-start gap-3"> <div className="mt-0.5 p-1 ... rounded-full">...</div> ... </div>
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  variant === "blue"
                    ? "text-blue-900 dark:text-blue-100"
                    : currentStyle.icon
                )}
              />
            </div>
            <span className={cn("font-semibold text-sm", currentStyle.title)}>
              {title}
            </span>
          </div>

          <div
            className={cn(
              "text-muted-foreground/50 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </div>
        </button>

        <div
          className={cn(
            "grid transition-all duration-200 ease-in-out",
            isOpen
              ? "grid-rows-[1fr] opacity-100 mt-4"
              : "grid-rows-[0fr] opacity-0 mt-0"
          )}
        >
          <div className="overflow-hidden">{children}</div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
