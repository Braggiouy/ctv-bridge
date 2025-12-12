interface BuildOutputProps {
  packageInfo: {
    name: string;
    path: string;
  } | null;
  message: string;
}

/**
 * Display build success output
 */
export const BuildOutput = ({ packageInfo, message }: BuildOutputProps) => {
  return (
    <div className="border border-muted bg-muted p-3 rounded-lg text-muted-foreground text-sm flex flex-col gap-1 mt-2 shadow-sm">
      <span className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
        Success
      </span>
      {packageInfo ? (
        <div className="flex flex-col gap-1">
          <span>
            <span className="font-semibold">Built:</span>{" "}
            <span className="font-mono">{packageInfo.name}</span>
          </span>
          <span>
            <span className="font-semibold">Path:</span>{" "}
            <span className="font-mono break-all">{packageInfo.path}</span>
          </span>
        </div>
      ) : (
        <span>{message || "Your application is ready for deployment"}</span>
      )}
    </div>
  );
};
