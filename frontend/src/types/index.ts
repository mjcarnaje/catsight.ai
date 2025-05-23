import { DocumentStatus } from "@/lib/document-status-config";
import { MARKDOWN_CONVERTERS } from "@/lib/markdown-converter";
import { Tag } from "./tags";
import { User } from "./user";
export * from "./llm";
export * from "./message";
export * from "./user";

export interface StatusHistory {
  id: number;
  status: DocumentStatus;
  changed_at: string | null;
}

export interface Document {
  id: number;
  title: string;
  file: string;
  file_name: string;
  file_type: string;
  summarization_model: string;
  summary: string;
  year?: number;
  tags: Tag[];
  no_of_chunks: number;
  page_count: number;
  status: DocumentStatus;
  markdown_converter: keyof typeof MARKDOWN_CONVERTERS;
  is_failed: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by?: User;
  status_history?: StatusHistory[];
  preview_image?: string;
  blurhash?: string;
  file_path?: string;
  file_size?: number;
}

export interface Chat {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  model_name?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources: {
    documentId: string | number;
    documentTitle: string;
    content: string;
    chunkIndexes?: number[];
    similarity?: number;
    pageNumber?: number;
  }[];
  grade?: {
    relevance: string;
    accuracy: string;
    score: number;
  };
}

export type ViewMode = "card" | "table";

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  num_pages: number;
  page: number;
  next: number | null;
  previous: number | null;
}

export interface SearchResultItem {
  chunk_index: number;
  text: string;
  snippet?: string;
  score: number;
}

export interface SearchResult {
  document_id: number;
  title: string;
  file_name: string;
  file_type: string;
  preview_image?: string;
  blurhash?: string;
  max_score: number;
  results: SearchResultItem[];
  created_at: string;
  updated_at: string;
  no_of_chunks?: number;
  markdown_converter: keyof typeof MARKDOWN_CONVERTERS;
  summary?: string;
  year?: number;
  tags?: string[];
}

export interface SearchResponse {
  count: number;
  num_pages: number;
  results: SearchResult[];
}

export interface DocumentFilters {
  status?: DocumentStatus | "all";
  tags?: string[];
  year?: string[];
  search?: string;
}

export interface StatisticsResponse {
  documents_count: number;
  chats_count: number;
  users_count: number;
  documents_by_status: Record<string, number>;
  avg_page_count: number;
  avg_chunks: number;
  years_distribution: {
    year: number;
    count: number;
  }[];
  documents_timeline: {
    month: string;
    count: number;
  }[];
}
