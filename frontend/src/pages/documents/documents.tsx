import axios from "axios";
import { AlertCircle, ChevronLeft, ChevronRight, FileText, SearchX, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DocumentFilterBar } from "@/components/documents/document-filter-bar";
import { DocumentRow, DocumentRowSkeleton } from "@/components/documents/document-row";
import { PAGE_SIZE } from "@/components/documents/filter-params";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { useDocumentFilters } from "@/components/documents/use-document-filters";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { useDashboard, useDocuments, useUploadsEnabled } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * The document library: a filterable, paginated list. Filters live in the URL
 * (`/documents?tags=3&status=failed`), so other pages can link to a prepared view.
 * Opening it with `state: { upload: true }` shows the upload dialog straight away.
 */
export default function DocumentsPage() {
  const state = useDocumentFilters();
  const { filters, page, activeCount, update, clear } = state;
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = useUploadsEnabled();

  const dashboard = useDashboard();
  const documents = useDocuments({ ...filters, page_size: PAGE_SIZE });
  const { data, isPending, isError, isPlaceholderData, error, refetch } = documents;

  // Another page asked for the upload dialog; open it once and clear the state so a refresh doesn't
  const wantsUpload = (location.state as { upload?: boolean } | null)?.upload === true;
  useEffect(() => {
    if (!wantsUpload) return;
    if (canUpload) setUploadOpen(true);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [wantsUpload, canUpload, navigate, location.pathname, location.search]);

  // A page that no longer exists (documents were deleted, or the filters changed) goes back to page 1
  const pageGone = isError && page > 1 && axios.isAxiosError(error) && error.response?.status === 404;
  useEffect(() => {
    if (pageGone) update({ page: undefined }, { replace: true });
  }, [pageGone, update]);

  // Land at the top of the list after paging
  const listRef = useRef<HTMLElement>(null);
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current !== page) listRef.current?.scrollIntoView({ block: "start" });
    previousPage.current = page;
  }, [page]);

  const library = dashboard.data?.library;
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        description={
          library ? `${plural(library.documents, "document")} · ${plural(library.pages, "page")} indexed` : undefined
        }
        actions={
          canUpload && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload />
              Upload
            </Button>
          )
        }
      />

      <DocumentFilterBar state={state} />

      <section ref={listRef} aria-label="Documents" aria-busy={documents.isFetching} className="flex scroll-mt-4 flex-col gap-3">
        {isPending || pageGone ? (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card" aria-label="Loading documents">
            {Array.from({ length: 6 }, (_, i) => (
              <DocumentRowSkeleton key={i} />
            ))}
          </ul>
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load documents"
            description={errorMessage(error)}
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : total === 0 ? (
          activeCount > 0 ? (
            <EmptyState
              icon={SearchX}
              title="No documents match"
              description="Try a different search, or remove some of the filters."
              action={
                <Button variant="outline" size="sm" onClick={clear}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description={
                canUpload
                  ? "Upload scanned PDFs and they'll be read, catalogued and made searchable."
                  : "The library is being prepared. Check back soon."
              }
              action={
                canUpload && (
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload />
                    Upload documents
                  </Button>
                )
              }
            />
          )
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {first}-{last} of {total.toLocaleString()}
            </p>
            <ul
              className={cn(
                "divide-y overflow-hidden rounded-lg border bg-card transition-opacity",
                isPlaceholderData && "opacity-60"
              )}
            >
              {data.results.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </ul>
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.previous || isPlaceholderData}
                    onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : undefined })}
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.next || isPlaceholderData}
                    onClick={() => update({ page: String(page + 1) })}
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>

      {canUpload && <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />}
    </PageContainer>
  );
}
