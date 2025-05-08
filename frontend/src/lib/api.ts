import axios from "axios";
import { DocumentStatus } from "./document-status";
import { Document, PaginatedResponse, Chat } from "@/types";

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

    console.log(`API error:`, {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.message,
    });

    // Only try to refresh token if:
    // 1. Response is a 401 (unauthorized)
    // 2. We haven't tried to refresh for this request yet
    // 3. The request is not already trying to refresh tokens
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/token/refresh")
    ) {
      console.log("Token appears to be expired, attempting to refresh...");
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) {
          console.error("No refresh token available");
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
          console.log("Token refreshed successfully");
          // Store the new tokens
          localStorage.setItem("access_token", tokenResponse.data.access);

          // Update the auth header and retry the original request
          originalRequest.headers.Authorization = `Bearer ${tokenResponse.data.access}`;
          return axios(originalRequest);
        } else {
          console.error("Invalid token response format", tokenResponse.data);
          throw new Error("Invalid token response format");
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
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
  grade?: {
    relevance: string;
    accuracy: string;
    score: number;
  };
}

export interface SearchResult {
  document_id: number;
  chunk_index: number;
  text: string;
  score: number;
  snippet: string;
}

export const chatsApi = {
  getRecent: (limit: number = 5) => {
    console.log(`Fetching recent chats with limit: ${limit}`);
    return api
      .get<Chat[]>("/chats/recent", {
        params: { limit },
      })
      .then((response) => {
        console.log(`Received ${response.data.length} chats`);
        return response;
      })
      .catch((error) => {
        console.error("Error fetching recent chats:", error);
        throw error;
      });
  },

  getOne: (id: number) => {
    console.log(`Fetching chat with ID: ${id}`);
    return api
      .get<Chat>(`/chats/${id}`)
      .then((response) => {
        console.log(`Retrieved chat ${id} successfully`);
        return response;
      })
      .catch((error) => {
        console.error(`Error fetching chat ${id}:`, error);
        throw error;
      });
  },

  getHistory: (chatId: number) => {
    console.log(`Fetching chat history from LangGraph for chat ID: ${chatId}`);
    return api
      .get(`/chats/${chatId}/history`)
      .then((response) => response)
      .catch((error) => {
        console.error(`Error fetching chat history for ${chatId}:`, error);
        throw error;
      });
  },

  getMessages: (chatId: number) => api.get(`/chats/${chatId}/messages`),

  create: (data: { title: string; document_id?: number }) =>
    api.post<Chat>("/chats/create", data),

  update: (id: number, data: { title: string }) =>
    api.patch<Chat>(`/chats/${id}/update`, data),

  delete: (id: number) => api.delete(`/chats/${id}/delete`),
};

export const documentsApi = {
  getAll: (page: number = 1, pageSize: number = 9) =>
    api.get<PaginatedResponse<Document>>("/documents", {
      params: {
        page,
        page_size: pageSize,
      },
    }),
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
  delete: (id: string) => api.delete(`/documents/${id}/delete`),
  chat: (query: string) => api.post<ChatResponse>("/documents/chat", { query }),
  getRecentChats: (limit: number = 5) => chatsApi.getRecent(limit),
  search: (params: {
    query: string;
    title?: string;
    limit?: number;
    page?: number;
    page_size?: number;
  }) =>
    api.get<PaginatedResponse<SearchResult>>("/documents/search", { params }),
};

interface LLMModel {
  id: number;
  name: string;
  code: string;
  description: string;
  logo: string;
}

export const llmApi = {
  getAll: () => api.get<LLMModel[]>("/llm-models").then((res) => res.data),
  getOne: (id: number) =>
    api.get<LLMModel>(`/llm-models/${id}`).then((res) => res.data),
  updateFavorites: (modelCodes: string[]) =>
    api
      .patch(
        "/auth/profile",
        {
          favorite_llm_models: modelCodes,
        },
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      )
      .then((res) => res.data),
};
