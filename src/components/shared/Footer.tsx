import { Github } from "lucide-react";
import packageJson from "../../../package.json";

export const Footer = () => {
  return (
    <footer className="border-t bg-card/30 mt-auto">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <span>{packageJson.version}</span>
          <span>•</span>
          <span>
            by{" "}
            <a
              href="https://github.com/Braggiouy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              @Braggiouy
            </a>
          </span>
          <span>•</span>
          <span>MIT License</span>
          <span>•</span>
          <a
            href="https://github.com/Braggiouy/ctv-bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-muted-foreground transition-colors"
          >
            <Github className="h-3 w-3" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
};
