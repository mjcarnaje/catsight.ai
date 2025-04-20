import axios from "axios";
import { DocumentStatus } from "./document-status";

// Use environment variable for API URL with fallback
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";
// API endpoint prefix
const API_PREFIX = "/api";

export const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Setup response interceptor to refresh token if expired
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only try to refresh token if:
    // 1. Response is a 401 (unauthorized)
    // 2. We haven't tried to refresh for this request yet
    // 3. The request is not already trying to refresh tokens
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/token/refresh")
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        // Use axios directly to avoid triggering the interceptor again
        const tokenResponse = await axios.post(
          `${API_BASE_URL}/api/auth/token/refresh`,
          {
            refresh: refreshToken,
          }
        );

        // Check if we received the expected response format
        if (tokenResponse.data.access) {
          // Store the new tokens
          localStorage.setItem("access_token", tokenResponse.data.access);

          // Update the auth header and retry the original request
          originalRequest.headers.Authorization = `Bearer ${tokenResponse.data.access}`;
          return axios(originalRequest);
        } else {
          throw new Error("Invalid token response format");
        }
      } catch (error) {
        // If refresh fails, logout user
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

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

export interface SearchResult {
  document_id: number;
  document_title: string;
  created_at: string;
  similarity_score: number;
  chunks: {
    chunk_index: number;
    content: string;
    similarity_score: number;
  }[];
}

export const documentsApi = {
  getAll: () => api.get<Document[]>("/documents"),
  getOne: (id: number) => api.get<Document>(`/documents/${id}`),
  getRaw: (id: number) => api.get<Document>(`/documents/${id}/raw`),
  getMarkdown: (id: number) => api.get<Document>(`/documents/${id}/markdown`),
  retry: (id: number) => api.post(`/documents/${id}/retry/`),
  upload: (files: File[], markdown_converter: string) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("markdown_converter", markdown_converter);
    return api.post("/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  delete: (id: number) => api.delete(`/documents/${id}/delete`),
  chat: (query: string) => api.post<ChatResponse>("/documents/chat", { query }),
  search: (params: { query: string; title?: string; limit?: number }) =>
    api.get<SearchResult[]>("/documents/search", { params }),
};
