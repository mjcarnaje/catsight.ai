import { FileText } from "lucide-react";
import { useState } from "react";
import { Blurhash } from "react-blurhash";

import { cn } from "@/lib/utils";

/** First-page preview with its blurhash while it loads; an icon when there is none. */
export function DocumentThumb({
  previewUrl,
  blurhash,
  className,
}: {
  previewUrl?: string;
  blurhash?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={cn("relative block overflow-hidden rounded-md border bg-muted", className)}>
      {blurhash && !loaded && (
        <Blurhash hash={blurhash} width="100%" height="100%" className="!absolute inset-0" />
      )}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cn("size-full object-cover object-top transition-opacity", loaded ? "opacity-100" : "opacity-0")}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <FileText className="size-4 text-muted-foreground" />
        </span>
      )}
    </span>
  );
}
