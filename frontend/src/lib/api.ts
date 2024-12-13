import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface Document {
  id: number;
  title: string;
  file: string;
  description: string;
  no_of_chunks: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatResponse {
  answer: string;
  sources: {
    document_id: number;
    document_title: string;
    total_similarity: number;
    chunks: {
      chunk_index: number;
      content: string;
      similarity: number;
    }[];
  }[];
}

export const documentsApi = {
  getAll: () => api.get<Document[]>("/documents"),
  getOne: (id: number) => api.get<Document>(`/documents/${id}`),
  upload: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return api.post("/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  delete: (id: number) => api.delete(`/documents/${id}/delete`),
  chat: (query: string) => api.post<ChatResponse>("/documents/chat", { query }),
};
