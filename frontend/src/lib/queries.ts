/** Query keys and the shared React Query hooks every page uses. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { configApi, dashboardApi, documentsApi, tagsApi } from "@/lib/api";
import type { Document, DocumentFilters } from "@/types";

export const keys = {
  config: ["config"] as const,
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  tags: ["tags"] as const,
  documents: (filters: DocumentFilters = {}) => ["documents", filters] as const,
  document: (id: number) => ["document", id] as const,
  documentText: (id: number) => ["document", id, "text"] as const,
  documentChunks: (id: number) => ["document", id, "chunks"] as const,
  chats: (q = "") => ["chats", q] as const,
  chat: (id: number) => ["chat", id] as const,
  search: (q: string, filters: object) => ["search", q, filters] as const,
};

/** True while a document is somewhere in the pipeline (not ready, not failed). */
export const isProcessing = (doc: Pick<Document, "status" | "is_failed">) =>
  doc.status !== "ready" && !doc.is_failed;

const POLL_MS = 2500;

export function useConfig() {
  return useQuery({ queryKey: keys.config, queryFn: configApi.get, staleTime: 30_000 });
}

export function useTags() {
  return useQuery({ queryKey: keys.tags, queryFn: tagsApi.list, staleTime: 60_000 });
}

export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: dashboardApi.get,
    // Keep the pipeline card live while anything is processing
    refetchInterval: (query) => (query.state.data?.active.some(isProcessing) ? POLL_MS : false),
  });
}

export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: keys.documents(filters),
    queryFn: () => documentsApi.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.results.some(isProcessing) ? POLL_MS : false),
  });
}

export function useDocument(id: number) {
  return useQuery({
    queryKey: keys.document(id),
    queryFn: () => documentsApi.get(id),
    enabled: Number.isFinite(id),
    refetchInterval: (query) => (query.state.data && isProcessing(query.state.data) ? POLL_MS : false),
  });
}
