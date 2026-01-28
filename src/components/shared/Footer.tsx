import packageJson from "../../../package.json";

export const Footer = () => {
  return (
    <footer className="mt-auto py-6 border-t border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
            <span>Version {packageJson.version}</span>
            <span>
              &copy; {new Date().getFullYear()}{" "}
              <a
                href="https://github.com/Braggiouy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors inline-block"
              >
                Braggiouy
              </a>
            </span>
            <a
              href="https://github.com/Braggiouy/ctv-bridge"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              MIT License
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
