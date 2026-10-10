import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import type {
  AdminOrganization,
  AdminOrganizationCreate,
  AdminOrganizationCreated,
  AISettings,
  AISettingsUpdate,
  AppConfig,
  AuthResponse,
  Chat,
  ChatHistory,
  Chunk,
  Dashboard,
  Document,
  DocumentDetail,
  DocumentFilters,
  DocumentStatus,
  DocumentUpdate,
  Extractor,
  Invitation,
  InvitationPreview,
  IssuedInvitation,
  Member,
  Membership,
  OrganizationDetail,
  OrgRole,
  Paginated,
  SearchAnswer,
  SearchResponse,
  Tag,
  UploadResult,
  User,
} from "@/types";

// --- Tokens ----------------------------------------------------------------------------
const ACCESS = "access_token";
const REFRESH = "refresh_token";

export const tokens = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

// --- Organization ------------------------------------------------------------------------
const ORGANIZATION = "organization";

/**
 * The slug of the organization the app acts in, sent as X-Organization on every request.
 * The organization context keeps it in step with the user's memberships.
 */
export const currentOrganization = {
  get: () => localStorage.getItem(ORGANIZATION),
  set: (slug: string) => localStorage.setItem(ORGANIZATION, slug),
  clear: () => localStorage.removeItem(ORGANIZATION),
};

/** Headers every API request carries: the token and the organization. */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const access = tokens.access();
  if (access) headers.Authorization = `Bearer ${access}`;
  const organization = currentOrganization.get();
  if (organization) headers["X-Organization"] = organization;
  return headers;
}

/** Fired when the session can't be refreshed; the session context signs out. */
export const SESSION_EXPIRED = "catsight:session-expired";

export const api = axios.create({ baseURL: "/api", timeout: 60_000 });

api.interceptors.request.use((config) => {
  // Django routes end with a slash; add it so every call matches
  if (config.url && !config.url.endsWith("/") && !config.url.includes("?")) config.url += "/";
  for (const [name, value] of Object.entries(authHeaders())) config.headers[name] = value;
  return config;
});

let refreshing: Promise<string | null> | null = null;

/** Exchange the refresh token for a new access token (one request at a time). */
export function refreshAccessToken(): Promise<string | null> {
  const refresh = tokens.refresh();
  if (!refresh) return Promise.resolve(null);
  refreshing ??= axios
    .post<{ access: string; refresh?: string }>("/api/auth/token/refresh/", { refresh })
    .then(({ data }) => {
      tokens.set(data.access, data.refresh);
      return data.access;
    })
    .catch(() => {
      tokens.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED));
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && original && !original._retried && tokens.refresh()) {
    original._retried = true;
    const access = await refreshAccessToken();
    if (access) {
      original.headers.Authorization = `Bearer ${access}`;
      return api(original);
    }
  }
  return Promise.reject(error);
});

/** A readable message from an API error (DRF `detail` or field errors). */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | string | undefined;
    if (typeof data === "string" && data.length < 200) return data;
    if (data && typeof data === "object") {
      if (typeof data.detail === "string") return data.detail;
      const first = Object.values(data).flat()[0];
      if (typeof first === "string") return first;
    }
    if (error.code === "ECONNABORTED") return "The server took too long to answer.";
    if (!error.response) return "Can't reach the server. Check your connection.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Turns filters into the query string the documents endpoint expects. */
function documentParams(filters: DocumentFilters) {
  return {
    q: filters.q || undefined,
    status: filters.status,
    year: filters.year?.length ? filters.year.join(",") : undefined,
    tags: filters.tags?.length ? filters.tags.join(",") : undefined,
    mine: filters.mine ? "1" : undefined,
    sort: filters.sort,
    page: filters.page,
    page_size: filters.page_size,
  };
}

// --- Endpoints ---------------------------------------------------------------------------
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login/", { email, password }).then((r) => r.data),
  /** `invite`: an invitation token; joins its organization and lifts the email-domain restriction. */
  register: (data: { email: string; password: string; first_name: string; last_name: string; invite?: string }) =>
    api.post<AuthResponse>("/auth/register/", data).then((r) => r.data),
  guest: () => api.post<AuthResponse>("/auth/guest/").then((r) => r.data),
  me: () => api.get<User>("/auth/me/").then((r) => r.data),
  updateMe: (data: FormData | Partial<Pick<User, "first_name" | "last_name">>) =>
    api.patch<User>("/auth/me/", data).then((r) => r.data),
};

export const configApi = {
  get: () => api.get<AppConfig>("/config/").then((r) => r.data),
};

export const dashboardApi = {
  get: () => api.get<Dashboard>("/dashboard/").then((r) => r.data),
};

export const documentsApi = {
  list: (filters: DocumentFilters = {}) =>
    api.get<Paginated<Document>>("/documents/", { params: documentParams(filters) }).then((r) => r.data),
  get: (id: number) => api.get<DocumentDetail>(`/documents/${id}/`).then((r) => r.data),
  update: (id: number, data: DocumentUpdate) =>
    api.patch<DocumentDetail>(`/documents/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/documents/${id}/`),
  upload: (
    files: File[],
    options: { extractor?: Extractor; private?: boolean } = {},
    onProgress?: (percent: number) => void
  ) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    if (options.extractor) form.append("extractor", options.extractor);
    if (options.private) form.append("private", "true");
    return api
      .post<{ results: UploadResult[] }>("/documents/", form, {
        timeout: 300_000,
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      })
      .then((r) => r.data.results);
  },
  text: (id: number) => api.get<{ markdown: string }>(`/documents/${id}/text/`).then((r) => r.data.markdown),
  saveText: (id: number, markdown: string) => api.put(`/documents/${id}/text/`, { markdown }),
  chunks: (id: number) => api.get<Chunk[]>(`/documents/${id}/chunks/`).then((r) => r.data),
  reprocess: (id: number, options: { from?: Exclude<DocumentStatus, "queued" | "ready">; extractor?: Extractor } = {}) =>
    api.post<{ status: string; from: DocumentStatus }>(`/documents/${id}/reprocess/`, options).then((r) => r.data),
};

export const searchApi = {
  search: (q: string, filters: { year?: number[]; tags?: number[] } = {}) =>
    api
      .get<SearchResponse>("/search/", {
        params: { q, year: filters.year?.join(",") || undefined, tags: filters.tags?.join(",") || undefined },
      })
      .then((r) => r.data),
  answer: (q: string, filters: { year?: number[]; tags?: number[] } = {}) =>
    api
      .post<SearchAnswer>("/search/answer/", { q, year: filters.year?.join(","), tags: filters.tags?.join(",") })
      .then((r) => r.data),
};

export const chatsApi = {
  list: (params: { q?: string; page?: number; page_size?: number } = {}) =>
    api.get<Paginated<Chat>>("/chats/", { params }).then((r) => r.data),
  messages: (id: number) => api.get<ChatHistory>(`/chats/${id}/messages/`).then((r) => r.data),
  rename: (id: number, title: string) => api.patch<Chat>(`/chats/${id}/`, { title }).then((r) => r.data),
  remove: (id: number) => api.delete(`/chats/${id}/`),
};

export const tagsApi = {
  list: () => api.get<Tag[]>("/tags/").then((r) => r.data),
  create: (data: { name: string; description?: string }) => api.post<Tag>("/tags/", data).then((r) => r.data),
  update: (id: number, data: { name?: string; description?: string }) =>
    api.patch<Tag>(`/tags/${id}/`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/tags/${id}/`),
};

/** The current organization (X-Organization), for its admins. */
export const organizationApi = {
  get: () => api.get<OrganizationDetail>("/organization/").then((r) => r.data),
  rename: (name: string) => api.patch<OrganizationDetail>("/organization/", { name }).then((r) => r.data),
  members: () => api.get<Member[]>("/organization/members/").then((r) => r.data),
  setRole: (membershipId: number, role: OrgRole) =>
    api.patch<Member>(`/organization/members/${membershipId}/`, { role }).then((r) => r.data),
  /** Remove a member (or yourself, to leave the organization). */
  removeMember: (membershipId: number) => api.delete(`/organization/members/${membershipId}/`),
  invitations: () => api.get<Invitation[]>("/organization/invitations/").then((r) => r.data),
  invite: (email: string, role: Exclude<OrgRole, "guest">) =>
    api.post<IssuedInvitation>("/organization/invitations/", { email, role }).then((r) => r.data),
  resendInvitation: (id: number) =>
    api.post<IssuedInvitation>(`/organization/invitations/${id}/resend/`).then((r) => r.data),
  revokeInvitation: (id: number) => api.delete(`/organization/invitations/${id}/`),
};

/** The current organization's AI provider (org admins). The key is write-only. */
export const aiSettingsApi = {
  get: () => api.get<AISettings>("/organization/ai/").then((r) => r.data),
  // Saving checks the key and models with real (small) calls to the provider: allow time
  save: (data: AISettingsUpdate) =>
    api.put<AISettings & { reindexing?: number }>("/organization/ai/", data, { timeout: 90_000 }).then((r) => r.data),
};

/** Invitation links (/invite/:token): preview without signing in, accept as the invited address. */
export const invitationsApi = {
  preview: (token: string) => api.get<InvitationPreview>(`/invitations/${token}/`).then((r) => r.data),
  accept: (token: string) =>
    api.post<{ membership: Membership }>(`/invitations/${token}/accept/`).then((r) => r.data),
};

/** Platform administration (super admin only). */
export const adminApi = {
  organizations: () => api.get<AdminOrganization[]>("/admin/organizations/").then((r) => r.data),
  createOrganization: (data: AdminOrganizationCreate) =>
    api.post<AdminOrganizationCreated>("/admin/organizations/", data).then((r) => r.data),
  updateOrganization: (id: number, data: { name?: string; ollama_allowed?: boolean }) =>
    api.patch<AdminOrganization>(`/admin/organizations/${id}/`, data).then((r) => r.data),
  /** Deletes the organization with its documents and chats; `confirm` must be its slug. */
  deleteOrganization: (id: number, confirm: string) =>
    api.delete(`/admin/organizations/${id}/`, { params: { confirm } }),
};

