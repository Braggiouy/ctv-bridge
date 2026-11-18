import { Check } from "lucide-react";
import { cn } from "@/utils";
import { STEPS } from "@/lib/workflow";

interface StepIndicatorProps {
  currentStep: number;
  /** Steps up to this one are clickable. */
  furthestStep: number;
  onStepClick: (step: number) => void;
}

export const StepIndicator = ({
  currentStep,
  furthestStep,
  onStepClick,
}: StepIndicatorProps) => (
  <nav aria-label="Progress">
    <ol className="flex items-center">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isDone = step.id < currentStep || step.id < furthestStep;
        const isReachable = step.id <= furthestStep;
        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => onStepClick(step.id)}
              disabled={!isReachable || isActive}
              aria-current={isActive ? "step" : undefined}
              className="group flex items-center gap-2 rounded-md px-1 py-1 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  isActive &&
                    "border-primary text-primary ring-4 ring-primary/10",
                  !isActive &&
                    isDone &&
                    "border-primary bg-primary text-primary-foreground",
                  !isActive && !isDone && "border-border text-muted-foreground",
                  isReachable &&
                    !isActive &&
                    "group-hover:ring-4 group-hover:ring-primary/10"
                )}
              >
                {isDone && !isActive ? <Check className="h-4 w-4" /> : step.id}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.name}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1",
                  step.id < furthestStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
