import { useEffect, useState } from "react";
import { Bug, ExternalLink, Github, ScrollText, Tv2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AUTHOR,
  AUTHOR_URL,
  NEW_ISSUE_URL,
  REPO_URL,
  releaseUrl,
} from "../../../shared/links";

const Logo = ({ size }: { size: "sm" | "lg" }) => (
  <div
    className={
      size === "sm"
        ? "flex h-7 w-7 items-center justify-center rounded-md bg-primary"
        : "flex h-10 w-10 items-center justify-center rounded-lg bg-primary"
    }
  >
    <Tv2
      className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"} text-primary-foreground`}
    />
  </div>
);

const Link = ({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Bug;
  children: React.ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
  >
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="flex-1">{children}</span>
    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
  </a>
);

/** The app's name and version in the header; opens who made it and where to get help. */
export const AppTitle = () => {
  const [version, setVersion] = useState<string>();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void window.electron.updater.getVersion().then(setVersion);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-mx-1 flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-accent"
        aria-label="About CTV Bridge"
        title="About CTV Bridge"
      >
        <Logo size="sm" />
        <span className="font-semibold">CTV Bridge</span>
        {version && (
          <span className="text-xs text-muted-foreground">v{version}</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="flex items-center gap-3 space-y-0">
            <Logo size="lg" />
            <div>
              <DialogTitle>CTV Bridge</DialogTitle>
              <DialogDescription>
                {version ? `Version ${version}` : "Version unknown"}
              </DialogDescription>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deploy and debug apps on Samsung, LG and Android TVs. Made by{" "}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {AUTHOR}
            </a>
            .
          </p>
          <nav className="-mx-2 flex flex-col">
            {version && (
              <Link href={releaseUrl(version)} icon={ScrollText}>
                What's new in {version}
              </Link>
            )}
            <Link href={NEW_ISSUE_URL} icon={Bug}>
              Report a bug or request a feature
            </Link>
            <Link href={REPO_URL} icon={Github}>
              Source code on GitHub
            </Link>
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
};
