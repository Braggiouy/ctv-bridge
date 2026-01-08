import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import DeploymentWorkflow from "./pages/DeploymentWorkflow";
import { UpdateNotification } from "./components/shared/UpdateNotification";

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <TooltipProvider>
      <Toaster closeButton position="top-right" richColors />
      <UpdateNotification />
      <DeploymentWorkflow />
    </TooltipProvider>
  </ThemeProvider>
);

export default App;
