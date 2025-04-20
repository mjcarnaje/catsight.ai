import { DocumentStatus } from "@/lib/document-status";

export interface User {
  id: string | number;
  email: string;
  role: string;
  name?: string;
  avatar?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface StatusHistory {
  id: number;
  status: DocumentStatus;
  changed_at: string | null;
}

export interface Document {
  id: number;
  title: string;
  file: string;
  description: string;
  no_of_chunks: number;
  status: DocumentStatus;
  is_failed: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by?: User;
  status_history?: StatusHistory[];
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
