import { mergeClassNames } from "@/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={mergeClassNames(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
