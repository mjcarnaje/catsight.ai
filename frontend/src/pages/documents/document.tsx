import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ArrowLeft, ExternalLink, FileX, Lock, MessageSquare, Pencil } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { DocumentMenu } from "@/components/documents/document-menu";
import { EditDocumentDialog } from "@/components/documents/edit-document-dialog";
import { OverviewTab } from "@/components/documents/overview-tab";
import { PassagesTab } from "@/components/documents/passages-tab";
import { PdfTab } from "@/components/documents/pdf-tab";
import { PipelineStepper } from "@/components/documents/pipeline-stepper";
import { TextTab } from "@/components/documents/text-tab";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import { isProcessing, keys, useDocument } from "@/lib/queries";
import type { DocumentDetail } from "@/types";

const TABS = ["overview", "pdf", "text", "passages"] as const;
type TabName = (typeof TABS)[number];

const tabTrigger =
  "rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-1.5 text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

/**
 * One document: its catalogue details, pipeline status, summary, PDF, extracted text and passages.
 * Links can open a tab or a PDF page: `/documents/12?tab=text` and `/documents/12?page=3`.
 */
export default function DocumentPage() {
  const { id } = useParams();
  const documentId = Number(id);
  // Keyed by id so moving between documents starts from a clean state
  return <DocumentView key={id} documentId={documentId} />;
}

function DocumentView({ documentId }: { documentId: number }) {
  const valid = Number.isInteger(documentId) && documentId > 0;
  const query = useDocument(valid ? documentId : Number.NaN);
  const queryClient = useQueryClient();
  const doc = query.data;

  // When processing ends the extracted text and passages may have changed
  const processingNow = doc ? isProcessing(doc) : undefined;
  const wasProcessing = useRef(false);
  useEffect(() => {
    if (processingNow === undefined) return;
    if (wasProcessing.current && !processingNow) {
      queryClient.invalidateQueries({ queryKey: keys.documentText(documentId) });
      queryClient.invalidateQueries({ queryKey: keys.documentChunks(documentId) });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
    }
    wasProcessing.current = processingNow;
  }, [processingNow, documentId, queryClient]);

  const notFound = !valid || (query.isError && axios.isAxiosError(query.error) && query.error.response?.status === 404);

  if (notFound) {
    return (
      <PageContainer>
        <BackLink />
        <EmptyState
          icon={FileX}
          title="This document doesn't exist or isn't shared with you"
          description="It may have been deleted, or it's a private upload from someone else."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/documents">Back to documents</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (query.isError) {
    return (
      <PageContainer>
        <BackLink />
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load this document"
          description={errorMessage(query.error)}
          action={
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!doc) return <DocumentSkeleton />;

  return <DocumentDetailView doc={doc} />;
}

function BackLink() {
  return (
    <Link
      to="/documents"
      className="inline-flex w-fit items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Documents
    </Link>
  );
}

function DocumentDetailView({ doc }: { doc: DocumentDetail }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);

  const title = doc.title || doc.file_name;
  const processing = isProcessing(doc);
  // Askable once something is indexed, even if a later re-run is in progress or failed
  const askable = (doc.status === "ready" && !doc.is_failed) || doc.chunk_count > 0;

  const pageParam = Number.parseInt(params.get("page") ?? "", 10);
  const pdfPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : undefined;
  const requested = params.get("tab");
  const tab: TabName = TABS.find((t) => t === requested) ?? (pdfPage ? "pdf" : "overview");

  const changeTab = (next: string) =>
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        if (next === "overview") updated.delete("tab");
        else updated.set("tab", next);
        if (next !== "pdf") updated.delete("page");
        return updated;
      },
      { replace: true }
    );

  const facts: ReactNode[] = [
    doc.issued_on ? `Issued ${formatDate(doc.issued_on)}` : doc.year ? String(doc.year) : null,
    doc.page_count > 0 ? plural(doc.page_count, "page") : null,
    doc.is_private ? (
      <span className="inline-flex items-center gap-1" title="Only you can see this document">
        <Lock className="size-3.5" aria-hidden />
        Only you
      </span>
    ) : null,
  ].filter(Boolean);

  return (
    <PageContainer>
      <BackLink />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
          {doc.reference_number && <p className="break-words font-mono text-xs text-muted-foreground">{doc.reference_number}</p>}
          {facts.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {facts.map((fact, index) => (
                <Fragment key={index}>
                  {index > 0 && <span aria-hidden>·</span>}
                  {fact}
                </Fragment>
              ))}
            </p>
          )}
          {doc.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {doc.tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    to={`/documents?tags=${tag.id}`}
                    className="inline-block rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            disabled={!askable}
            title={askable ? undefined : "Available once the document has been read and indexed"}
            onClick={() => navigate("/chat", { state: { documents: [{ id: doc.id, title }] } })}
          >
            <MessageSquare />
            Ask about this document
          </Button>
          {doc.file_url ? (
            <Button asChild variant="outline" className="shadow-none">
              <a href={doc.file_url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open PDF
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled className="shadow-none">
              <ExternalLink />
              Open PDF
            </Button>
          )}
          {doc.can_edit && (
            <>
              <Button variant="outline" className="shadow-none" onClick={() => setEditOpen(true)}>
                <Pencil />
                Edit details
              </Button>
              <DocumentMenu doc={doc} />
            </>
          )}
        </div>
      </header>

      {(processing || doc.is_failed) && <PipelineStepper doc={doc} />}

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="overview" className={tabTrigger}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="pdf" className={tabTrigger}>
            PDF
          </TabsTrigger>
          <TabsTrigger value="text" className={tabTrigger}>
            Text
          </TabsTrigger>
          <TabsTrigger value="passages" className={tabTrigger}>
            Passages
            {doc.chunk_count > 0 && (
              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{doc.chunk_count.toLocaleString()}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab doc={doc} />
        </TabsContent>
        <TabsContent value="pdf" className="mt-6">
          <PdfTab url={doc.file_url} page={pdfPage} />
        </TabsContent>
        <TabsContent value="text" className="mt-6">
          <TextTab doc={doc} />
        </TabsContent>
        <TabsContent value="passages" className="mt-6">
          <PassagesTab documentId={doc.id} processing={processing} />
        </TabsContent>
      </Tabs>

      {doc.can_edit && <EditDocumentDialog doc={doc} open={editOpen} onOpenChange={setEditOpen} />}
    </PageContainer>
  );
}

function DocumentSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-4 w-20" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </PageContainer>
  );
}
