import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { plural } from "@/lib/format";
import type { Tag } from "@/types";

/**
 * One tag in the list. The whole row opens the tag's documents; the admin buttons sit above
 * that link so they stay separate click targets.
 */
export function TagRow({
  tag,
  canEdit,
  onEdit,
  onDelete,
}: {
  tag: Tag;
  canEdit: boolean;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}) {
  const count = plural(tag.document_count, "document");
  return (
    <li className="relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/40 sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-sm font-medium">
          <Link
            to={`/documents?tags=${tag.id}`}
            className="break-words outline-none after:absolute after:inset-0 focus-visible:after:ring-1 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {tag.name}
          </Link>
        </h2>
        {tag.description ? (
          <p className="line-clamp-2 break-words text-sm text-muted-foreground">{tag.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground/70">No description</p>
        )}
        <p className="font-mono text-xs tabular-nums text-muted-foreground sm:hidden">{count}</p>
      </div>
      <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:block">{count}</span>
      {canEdit && (
        <div className="relative z-10 flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`Edit tag ${tag.name}`}
            onClick={() => onEdit(tag)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Delete tag ${tag.name}`}
            onClick={() => onDelete(tag)}
          >
            <Trash2 />
          </Button>
        </div>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
    </li>
  );
}

export function TagRowSkeleton() {
  return (
    <li className="flex items-center gap-4 px-4 py-3.5" aria-hidden="true">
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <Skeleton className="hidden h-3.5 w-20 sm:block" />
    </li>
  );
}
