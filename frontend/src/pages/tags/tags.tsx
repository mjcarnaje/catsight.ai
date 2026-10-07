import { AlertCircle, Plus, Search, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { DeleteTagDialog } from "@/components/tags/delete-tag-dialog";
import { TagDialog } from "@/components/tags/tag-dialog";
import { TagRow, TagRowSkeleton } from "@/components/tags/tag-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/contexts/session-context";
import { errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { useTags } from "@/lib/queries";
import type { Tag } from "@/types";

const FILTER_FROM = 8;

/**
 * Every tag with how many documents carry it; each opens the documents page filtered by it.
 * Admins can also create, edit and delete tags.
 */
export default function TagsPage() {
  const { user } = useSession();
  const isAdmin = Boolean(user?.is_admin);
  const tags = useTags();

  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const all = tags.data;
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!all || !needle) return all ?? [];
    return all.filter((tag) => `${tag.name} ${tag.description ?? ""}`.toLowerCase().includes(needle));
  }, [all, filter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setFormOpen(true);
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Tags"
        description={
          <>
            Tags are assigned automatically when a document is catalogued: the AI reads it and picks the tags that
            fit, guided by each tag's description.
            {!isAdmin && " Only admins can change them."}
          </>
        }
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <Plus />
              New tag
            </Button>
          )
        }
      />

      {tags.isPending ? (
        <ul className="divide-y rounded-lg border" role="status" aria-label="Loading tags">
          {Array.from({ length: 5 }, (_, index) => (
            <TagRowSkeleton key={index} />
          ))}
        </ul>
      ) : tags.isError ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="break-words">{errorMessage(tags.error, "Couldn't load the tags.")}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={tags.isFetching}
              onClick={() => void tags.refetch()}
            >
              Try again
            </Button>
          </div>
        </div>
      ) : tags.data.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No tags yet"
          description={
            isAdmin
              ? "Create the first tag. New documents are checked against every tag when they are catalogued."
              : "Tags will appear here once an admin creates them."
          }
          action={
            isAdmin ? (
              <Button size="sm" onClick={openCreate}>
                <Plus />
                New tag
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {filter.trim() ? `${shown.length} of ${plural(tags.data.length, "tag")}` : plural(tags.data.length, "tag")}
            </p>
            {tags.data.length >= FILTER_FROM && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  aria-label="Filter tags"
                  placeholder="Filter tags"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No tag matches "{filter.trim()}".
            </p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {shown.map((tag) => (
                <TagRow key={tag.id} tag={tag} canEdit={isAdmin} onEdit={openEdit} onDelete={setDeleting} />
              ))}
            </ul>
          )}
        </div>
      )}

      {isAdmin && (
        <>
          <TagDialog open={formOpen} onOpenChange={setFormOpen} tag={editing} />
          <DeleteTagDialog tag={deleting} onClose={() => setDeleting(null)} />
        </>
      )}
    </PageContainer>
  );
}
