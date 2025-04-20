import { DocumentStatus } from "@/lib/document-status";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "User" | "Admin" | "SuperAdmin";
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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources: {
    documentId: string;
    documentTitle: string;
    pageNumber: number;
    content: string;
  }[];
}
