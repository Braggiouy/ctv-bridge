import { mergeClassNames } from "@/utils";

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
    <nav aria-label="Progress" className="mb-10 px-2 w-full">
      <ol className="flex items-center justify-between w-full relative">
        {/* Background line */}
        <div className="absolute top-4 left-0 w-full h-0.5 bg-border -z-10" />

        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <li
              key={step.id}
              className="relative flex flex-col items-center group flex-1"
            >
              <div
                className={mergeClassNames(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 bg-background",
                  isCompleted &&
                    "border-primary bg-primary text-primary-foreground",
                  isActive &&
                    "border-primary text-primary ring-4 ring-primary/10",
                  !isCompleted &&
                    !isActive &&
                    "border-border text-muted-foreground opacity-60"
                )}
              >
                {isCompleted ? (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="text-xs font-bold">{step.id}</span>
                )}
              </div>
              <div className="mt-2 flex flex-col items-center">
                <span
                  className={mergeClassNames(
                    "text-[11px] font-bold uppercase tracking-wider transition-colors duration-300",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground opacity-60"
                  )}
                >
                  {step.name}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
