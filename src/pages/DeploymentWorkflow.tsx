import { useState } from "react";
import { Tv2, Github, House } from "lucide-react";
import { StepIndicator } from "@/components/shared/StepIndicator";
import { InstallationStep } from "@/components/steps/InstallationStep";
import { DeviceSetupStep } from "@/components/steps/DeviceSetupStep";
import { BuildStep } from "@/components/steps/BuildStep";
import { DeployStep } from "@/components/steps/DeployStep";
import { LogViewer } from "@/components/shared/LogViewer";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { UpdateButton } from "@/components/shared/UpdateButton";
import { Footer } from "@/components/shared/Footer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const steps = [
  { id: 1, name: "Installation", description: "Setup SDK tools" },
  { id: 2, name: "Device Setup", description: "Connect to your TV" },
  { id: 3, name: "Build", description: "Generate package" },
  { id: 4, name: "Deploy", description: "Launch on TV" },
];

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="min-h-screen bg-background flex flex-col pt-4">
      <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(1)}
              disabled={currentStep === 1}
              className="bg-card/50 backdrop-blur-sm"
            >
              <House className="h-4 w-4" />
              Home
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Back to step 1</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="https://github.com/Braggiouy/ctv-bridge"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-card/50 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="bottom">View on GitHub</TooltipContent>
        </Tooltip>
        <UpdateButton />
        <ThemeToggle />
      </div>

      <main className="container mx-auto px-4 py-4 flex-1">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-sm">
              <Tv2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">CTV Bridge</h1>
          </div>
          <StepIndicator steps={steps} currentStep={currentStep} />

          {currentStep === 1 && (
            <InstallationStep onNext={() => setCurrentStep(2)} />
          )}

          {currentStep === 2 && (
            <DeviceSetupStep
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
              onHome={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <BuildStep
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
              onHome={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 4 && (
            <DeployStep
              onBack={() => setCurrentStep(3)}
              onHome={() => setCurrentStep(1)}
            />
          )}

          <LogViewer />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
