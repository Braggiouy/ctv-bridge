import { useState } from "react";
import { Tv2, Github } from "lucide-react";
import { StepIndicator } from "@/components/shared/StepIndicator";
import { InstallationStep } from "@/components/steps/InstallationStep";
import { DeviceSetupStep } from "@/components/steps/DeviceSetupStep";
import { BuildStep } from "@/components/steps/BuildStep";
import { DeployStep } from "@/components/steps/DeployStep";
import { LogViewer } from "@/components/shared/LogViewer";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { UpdateButton } from "@/components/shared/UpdateButton";
import { Footer } from "@/components/shared/Footer";

const steps = [
  { id: 1, name: "Installation", description: "Setup SDK tools" },
  { id: 2, name: "Device Setup", description: "Connect to your TV" },
  { id: 3, name: "Build", description: "Generate package" },
  { id: 4, name: "Deploy", description: "Launch on TV" },
];

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="group relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-105">
                <Tv2 className="h-7 w-7 text-primary-foreground transition-transform duration-300 group-hover:scale-110" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-3">
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    CTV Bridge
                  </h1>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20 transition-colors hover:bg-primary/20">
                      Electron
                    </span>
                    <span className="inline-flex items-center rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20 transition-colors hover:bg-accent/20">
                      React
                    </span>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border transition-colors hover:bg-muted/80">
                      TypeScript
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Deploy Tizen & webOS applications to Connected TVs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/Braggiouy/ctv-bridge"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent hover:bg-accent hover:text-accent-foreground transition-colors"
                title="View on GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <UpdateButton />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <StepIndicator steps={steps} currentStep={currentStep} />

          {currentStep === 1 && (
            <InstallationStep onNext={() => setCurrentStep(2)} />
          )}

          {currentStep === 2 && (
            <DeviceSetupStep
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <BuildStep
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && <DeployStep onBack={() => setCurrentStep(3)} />}

          <LogViewer />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
