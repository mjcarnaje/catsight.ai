import { cn } from "@/lib/utils";
import { CatMark } from "./cat-mark";

const sizes = {
  sm: { mark: "size-7", text: "text-base" },
  md: { mark: "size-8", text: "text-lg" },
  lg: { mark: "size-11", text: "text-2xl" },
} as const;

interface BrandLogoProps {
  size?: keyof typeof sizes;
  /** Hide the wordmark, e.g. in a collapsed sidebar. */
  markOnly?: boolean;
  className?: string;
}

/** The CATSight.AI mark + wordmark. Use this everywhere the brand appears. */
export function BrandLogo({ size = "md", markOnly = false, className }: BrandLogoProps) {
  const s = sizes[size];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CatMark className={cn("shrink-0", s.mark)} />
      {markOnly ? (
        <span className="sr-only">CATSight.AI</span>
      ) : (
        <span className={cn("font-semibold tracking-tight text-foreground", s.text)}>
          CATSight<span className="text-muted-foreground">.AI</span>
        </span>
      )}
    </span>
  );
}
