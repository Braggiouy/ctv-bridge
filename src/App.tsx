import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import Workspace from "./pages/Workspace";

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <TooltipProvider>
      <Toaster closeButton position="top-right" richColors />
      <Workspace />
    </TooltipProvider>
  </ThemeProvider>
);

export default App;
