import { useId, type SVGProps } from "react";

/**
 * The CATSight.AI logo mark: a gem-faceted cat head with negative-space eyes —
 * a slit-pupil cat eye ("sight") and an AI spark (the mascot's wink).
 * Eyes are cut with a mask, so the mark sits cleanly on any background.
 * Mirrors public/logo.svg — keep the two in sync.
 */
interface CatMarkProps extends SVGProps<SVGSVGElement> {
  /** `gradient` = tabby→gold brand fill (the mascot's colours); `mono` = currentColor. */
  variant?: "gradient" | "mono";
  /** The small companion sparkle; drop it at tiny sizes. */
  sparkle?: boolean;
  title?: string;
}

export function CatMark({ variant = "gradient", sparkle = true, title, ...props }: CatMarkProps) {
  // Unique ids per instance: duplicated ids break when one copy is display:none.
  const uid = useId().replace(/:/g, "");
  const maskId = `cs-cut-${uid}`;
  const gradId = `cs-grad-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradId} x1="9" y1="5" x2="55" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BA5C2C" />
          <stop offset="0.5" stopColor="#E08A2C" />
          <stop offset="1" stopColor="#FBBF24" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          {/* head */}
          <path
            d="M13.2 5.2 26.5 16.5Q32 15.2 37.5 16.5L50.8 5.2 53.6 24 56 34 45 51.5 32 57.5 19 51.5 8 34 10.4 24Z"
            fill="#fff"
            stroke="#fff"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* cat eye (sight) with slit pupil */}
          <path d="M15.8 31.6C19 27.6 25.8 28.4 28.8 34.6 24.6 37.6 18.4 37 15.8 31.6Z" fill="#000" />
          <path d="M22.6 28.6C24.3 31.3 24.3 34.7 22.6 37.4 20.9 34.7 20.9 31.3 22.6 28.6Z" fill="#fff" />
          {/* AI spark (the wink) */}
          <path
            d="M41.5 24.6C42.3 30.3 43.5 31.6 49.2 32.6 43.5 33.6 42.3 34.9 41.5 40.6 40.7 34.9 39.5 33.6 33.8 32.6 39.5 31.6 40.7 30.3 41.5 24.6Z"
            fill="#000"
          />
          {sparkle && (
            <path
              d="M49.4 22.2C49.7 24 50.1 24.4 51.9 24.7 50.1 25 49.7 25.4 49.4 27.2 49.1 25.4 48.7 25 46.9 24.7 48.7 24.4 49.1 24 49.4 22.2Z"
              fill="#000"
            />
          )}
          {/* nose */}
          <path d="M29.8 42.4H34.2L32 45.2Z" fill="#000" stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <rect width="64" height="64" fill={variant === "mono" ? "currentColor" : `url(#${gradId})`} />
        {/* gem facets, lit from the top-left */}
        <path d="M0 0H32V42L8 22Z" fill="#fff" fillOpacity="0.16" />
        <path d="M8 22 32 42V60L16 54 4 34Z" fill="#fff" fillOpacity="0.07" />
        <path d="M60 22 32 42V60L48 54 60 34Z" fill="#000" fillOpacity="0.12" />
        <path d="M14.6 9.4 23.2 16.4 12.6 20.8ZM49.4 9.4 40.8 16.4 51.4 20.8Z" fill="#000" fillOpacity="0.18" />
      </g>
    </svg>
  );
}
