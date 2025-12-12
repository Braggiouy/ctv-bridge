import { Check, Circle, Info } from "lucide-react";
import { cn } from "@/utils";

interface Step {
  id: number;
  name: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export const StepIndicator = ({ steps, currentStep }: StepIndicatorProps) => {
  return (
    <nav aria-label="Progress" className="mb-6 px-2 w-full flex justify-center">
      <ol className="flex items-center w-full gap-0 sm:gap-2">
        {steps.map((step, stepIdx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isUpcoming = step.id > currentStep;
          return (
            <li
              key={step.id}
              className={cn(
                "relative flex flex-col items-center flex-grow min-w-0 group",
                stepIdx !== steps.length - 1 && ""
              )}
            >
              <div className="flex items-center w-full">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center px-4 py-3 rounded-2xl border transition-colors duration-300 min-w-[140px] min-h-[56px] bg-transparent",
                    isCompleted && "border-primary text-primary bg-transparent",
                    isActive && "border-primary text-primary bg-transparent",
                    isUpcoming &&
                      "border-border text-muted-foreground bg-transparent opacity-40"
                  )}
                  title={step.name}
                >
                  <span
                    className={cn(
                      "font-semibold text-base mb-1 whitespace-nowrap",
                      isCompleted
                        ? "text-primary"
                        : isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.id}. {step.name}
                  </span>
                  <span
                    className={cn(
                      "text-sm text-muted-foreground whitespace-nowrap truncate",
                      isCompleted
                        ? "text-primary/70"
                        : isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.description}
                  </span>
                </div>
                {/* Minimalist connector line */}
                {stepIdx !== steps.length - 1 && (
                  <div
                    className={cn(
                      "h-1 flex-1 mx-2 sm:mx-4 rounded bg-border transition-colors duration-300",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
