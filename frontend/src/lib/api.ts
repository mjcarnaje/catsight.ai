import {
  Chat,
  Document,
  LLMModel,
  PaginatedResponse,
  Source,
  StatisticsResponse,
} from "@/types";
import { Tag } from "@/types/tags";
import axios from "axios";

const API_PREFIX = "/api";

export const getDocumentPreviewUrl = (
  previewPath: string | undefined
): string => {
  return `/media/${previewPath}`;
};

export const getDocumentUrl = (documentId: number): string => {
  return `/documents/${documentId}`;
};

export const api = axios.create({
  baseURL: API_PREFIX,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  // Add trailing slash to the URL if it's missing

  if (!config.url?.endsWith("/")) {
    config.url = config.url + "/";
  }

  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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

        const tokenResponse = await axios.post(
          `${API_PREFIX}/auth/token/refresh`,
          {
            refresh: refreshToken,
          }
        );

        if (tokenResponse.data.access) {
          console.log("Token refreshed successfully");
          localStorage.setItem("access_token", tokenResponse.data.access);

          originalRequest.headers.Authorization = `Bearer ${tokenResponse.data.access}`;
          return axios(originalRequest);
        } else {
          console.error("Invalid token response format", tokenResponse.data);
          throw new Error("Invalid token response format");
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.dispatchEvent(new Event("storage"));
        return Promise.reject(error);
      }
    }

    if (error.response?.data) {
      if (typeof error.response.data === "object") {
        const errorMessage = Object.entries(error.response.data)
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return `${key}: ${value.join(", ")}`;
            }
            return `${key}: ${value}`;
          })
          .join("; ");
        error.message = errorMessage;
      } else if (typeof error.response.data === "string") {
        error.message = error.response.data;
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

export interface SearchApiResponse {
  summary: string;
  sources: Source[];
}

export const chatsApi = {
  getCount: () => {
    return api
      .get<{ count: number }>("/chats/count")
      .then((response) => {
        return response.data.count;
      })
      .catch((error) => {
        console.error("Error fetching chat count:", error);
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

  getRecent: (pageSize: number = 10, page: number = 1) =>
    api.get<PaginatedResponse<Chat>>("/chats/recent/", {
      params: {
        page_size: pageSize.toString(),
        page: page.toString(),
      },
    }),
};

export const documentsApi = {
  getAll: (
    page: number = 1,
    pageSize: number = 9,
    additionalParams: Record<string, string | number> = {}
  ) => {
    const params = {
      page,
      page_size: pageSize,
      ...additionalParams,
    };
    return api.get<PaginatedResponse<Document>>("/documents", { params });
  },
  getOne: (id: number) => api.get<Document>(`/documents/${id}`),
  getRaw: (id: number) => api.get<Document>(`/documents/${id}/raw`),
  getMarkdown: (id: number) => api.get<Document>(`/documents/${id}/markdown`),
  getGraph: () =>
    api.get<{ mermaid: string; format: string; message: string }>(
      "/documents/graph"
    ),
  getGraphImageUrl: () => `${API_PREFIX}/documents/graph/image`,
  retry: (id: number) => api.post(`/documents/${id}/retry/`),
  regeneratePreview: (id: number) =>
    api.post<{
      status: string;
      message: string;
      preview_image: string;
      blurhash: string | null;
    }>(`/documents/${id}/regenerate-preview`),
  regenerateSummary: (id: number, summarization_model?: string) =>
    api.post<{
      status: string;
      message: string;
    }>(
      `/documents/${id}/regenerate-summary`,
      summarization_model ? { summarization_model } : undefined
    ),
  reextract: (id: number, markdown_converter: string) =>
    api.post<{
      status: string;
      message: string;
    }>(`/documents/${id}/reextract`, { markdown_converter }),
  upload: (
    files: File[],
    markdown_converter?: string,
    summarization_model?: string,
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    if (markdown_converter) {
      formData.append("markdown_converter", markdown_converter);
    }

    if (summarization_model) {
      formData.append("summarization_model", summarization_model);
    }

    return api.post("/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },
  delete: (id: string) => api.delete(`/documents/${id}/delete`),
  chat: (query: string) => api.post<ChatResponse>("/documents/chat", { query }),
  getRecentChats: (limit: number = 5) => chatsApi.getRecent(limit),
  search: (params: {
    query: string;
    accurate?: boolean;
    year?: string;
    tags?: string;
  }) =>
    api
      .get<SearchApiResponse>(
        params.accurate ? "/documents/search" : "/documents/standard-search",
        { params }
      )
      .then((res) => res.data),
  getCount: () => {
    return api
      .get<{ count: number }>("/documents/count")
      .then((response) => {
        return response.data.count;
      })
      .catch((error) => {
        console.error("Error fetching document count:", error);
        throw error;
      });
  },
  getChunks: (id: number) => {
    return api.get(`/documents/${id}/chunks`);
  },
  updateMarkdown: (id: number, markdown: string) => {
    return api.put(`/documents/${id}/update`, { markdown });
  },
  getAllTags: () => {
    return api.get<string[]>("/documents/get_all_tags").then((res) => res.data);
  },
  getAllYears: () => {
    return api
      .get<string[]>("/documents/get_all_years")
      .then((res) => res.data);
  },
  getStatistics: () => {
    return api
      .get<{
        documents_count: number;
        chats_count: number;
        users_count: number;
        documents_by_status: Record<string, number>;
      }>("/statistics")
      .then((response) => response.data)
      .catch((error) => {
        console.error("Error fetching statistics:", error);
        throw error;
      });
  },
};

export const llmApi = {
  getAll: (instruct: boolean = false) =>
    api
      .get<LLMModel[]>("/llm-models", {
        params: { instruct: instruct.toString() },
      })
      .then((res) => res.data),
  getOne: (id: number) =>
    api.get<LLMModel>(`/llm-models/${id}`).then((res) => res.data),
};

export const tagsApi = {
  getAll: () => api.get<Tag[]>("/tags").then((res) => res.data),

  getOne: (id: number) => api.get<Tag>(`/tags/${id}`).then((res) => res.data),

  create: (data: { name: string; description?: string }) =>
    api.post<Tag>("/tags/create", data),

  update: (id: number, data: { name?: string; description?: string }) =>
    api.patch<Tag>(`/tags/${id}/update`, data),

  delete: (id: number) => api.delete(`/tags/${id}/delete`),
};

export const statisticsApi = {
  getStatistics: () =>
    api.get<StatisticsResponse>("/statistics").then((res) => res.data),
};
