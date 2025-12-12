import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import DeploymentWorkflow from "./pages/DeploymentWorkflow";
import NotFound from "./pages/NotFound";
import { UpdateNotification } from "./components/shared/UpdateNotification";

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UpdateNotification />
      <HashRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/" element={<DeploymentWorkflow />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </ThemeProvider>
);

export default App;
