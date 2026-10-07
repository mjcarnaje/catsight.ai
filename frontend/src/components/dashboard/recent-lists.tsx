import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, FileText, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { chatsApi, documentsApi, getDocumentPreviewUrl } from "@/lib/api";
import { getDocumentStage } from "@/lib/document-stages";
import { cn } from "@/lib/utils";

function timeAgo(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
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

function EmptyState({ icon, title, action }: { icon: ReactNode; title: string; action: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}

function ListHeader({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
      <div className="flex flex-col gap-1.5">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      <Button asChild variant="ghost" size="sm" className="-mr-2 text-muted-foreground">
        <Link to={to}>View all</Link>
      </Button>
    </CardHeader>
  );
}

export function RecentDocuments() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["dashboard", "recent-documents"],
    queryFn: () => documentsApi.getAll(1, 5).then((res) => res.data.results),
  });

  return (
    <Card className="flex h-full flex-col">
      <ListHeader title="Recent documents" description="Latest uploads to the library" to="/documents" />
      <CardContent className="flex-1">
        {isLoading ? (
          <ListSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-4" />}
            title="No documents yet"
            action={
              <Button asChild size="sm">
                <Link to="/documents">Upload a document</Link>
              </Button>
            }
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {documents.map((doc) => {
              const stage = getDocumentStage(doc.status);
              const isReady = stage.key === "ready";
              return (
                <li key={doc.id}>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                  >
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                      {doc.preview_image ? (
                        <img
                          src={getDocumentPreviewUrl(doc.preview_image)}
                          alt=""
                          className="size-full object-cover object-top"
                          loading="lazy"
                        />
                      ) : (
                        <FileText className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{doc.title || doc.file_name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {timeAgo(doc.created_at)}
                        {doc.page_count ? ` · ${doc.page_count} pages` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "hidden items-center gap-1.5 text-xs sm:inline-flex",
                        isReady ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", !isReady && "animate-pulse")}
                        style={{ background: stage.color }}
                      />
                      {stage.label}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentChats() {
  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["dashboard", "recent-chats"],
    queryFn: () => chatsApi.getRecent(5).then((res) => res.data.results),
  });

  return (
    <Card className="flex h-full flex-col">
      <ListHeader title="Recent chats" description="Pick up where you left off" to="/chat" />
      <CardContent className="flex-1">
        {isLoading ? (
          <ListSkeleton />
        ) : chats.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-4" />}
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
                <Link
                  to={`/chat/${chat.id}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{chat.title || "Untitled chat"}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(chat.updated_at)}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
