import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Lock, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { DocumentStatusBadge } from "@/components/documents/document-status";
import { DocumentThumb } from "@/components/documents/document-thumb";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { chatsApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useDocuments } from "@/lib/queries";

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListCard({ title, description, to, children }: { title: string; description: string; to: string; children: ReactNode }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="-mr-2 text-muted-foreground">
          <Link to={to}>View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

export function RecentDocuments({ onUpload }: { onUpload: () => void }) {
  const { data, isLoading } = useDocuments({ page_size: 5 });
  const documents = data?.results ?? [];

  return (
    <ListCard title="Recently added" description="Newest documents in the library" to="/documents">
      {isLoading ? (
        <ListSkeleton />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload a PDF and watch it get read, catalogued and indexed."
          action={<Button size="sm" onClick={onUpload}>Upload a PDF</Button>}
        />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link to={`/documents/${doc.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                <DocumentThumb previewUrl={doc.preview_url} blurhash={doc.blurhash} className="size-9 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{doc.title || doc.file_name}</span>
                  <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {doc.is_private && <Lock className="size-3" aria-label="Only you" />}
                    {[doc.reference_number, doc.year, timeAgo(doc.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <DocumentStatusBadge doc={doc} className="hidden sm:inline-flex" />
                <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}

export function RecentChats() {
  const { data, isLoading } = useQuery({
    queryKey: ["chats", "recent"],
    queryFn: () => chatsApi.list({ page_size: 5 }),
  });
  const chats = data?.results ?? [];

  return (
    <ListCard title="Your chats" description="Pick up where you left off" to="/chat">
      {isLoading ? (
        <ListSkeleton />
      ) : chats.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/chat">Start a chat</Link>
            </Button>
          }
        />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link to={`/chat/${chat.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{chat.title || "New chat"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(chat.updated_at)}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}
