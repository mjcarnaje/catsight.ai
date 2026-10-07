/** Types mirroring the Django API (backend/app/serializers.py and views). */

// --- Accounts ---------------------------------------------------------------------
export type Role = "guest" | "user" | "admin" | "super_admin";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  avatar: string;
  is_guest: boolean;
  is_admin: boolean;
  date_joined: string;
}

export interface AuthResponse {
  user: User;
  tokens: { access: string; refresh: string };
}

// --- App config / usage --------------------------------------------------------------
export interface Limits {
  uploads_per_day: number; // 0 = unlimited
  messages_per_day: number;
  library_pages: number;
  max_file_mb: number;
  max_pages_per_file: number;
}

export interface UsageCounter {
  used: number;
  limit: number;
  resets_at?: string | null;
}

export interface Usage {
  limited: boolean;
  uploads: UsageCounter;
  messages: UsageCounter;
  library_pages: UsageCounter;
}

export type Extractor = "vision" | "marker" | "docling" | "markitdown";

export interface AppConfig {
  demo_mode: boolean;
  /** Whether this visitor may upload (admins always can). */
  uploads_enabled: boolean;
  guest_access: boolean;
  allowed_email_domains: string[];
  provider: "openrouter" | "ollama";
  models: { chat: string; ocr: string; embedding: string; reranker: string };
  limits: Limits;
  guest_ttl_hours: number;
  // Signed-in only
  usage?: Usage;
  extractors?: { default: Extractor; options: Extractor[] };
}

// --- Documents -------------------------------------------------------------------------
export type DocumentStatus = "queued" | "extracting" | "summarizing" | "indexing" | "ready";

export interface TagRef {
  id: number;
  name: string;
}

export interface Tag extends TagRef {
  description: string | null;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  title: string;
  file_name: string;
  reference_number: string;
  year: number | null;
  issued_on: string | null;
  tags: TagRef[];
  status: DocumentStatus;
  is_failed: boolean;
  error_message: string;
  progress_done: number;
  progress_total: number;
  page_count: number;
  chunk_count: number;
  file_size: number;
  preview_url: string;
  blurhash: string;
  is_private: boolean;
  uploaded_by: { id: number; name: string; is_guest: boolean } | null;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export interface StatusEvent {
  status: DocumentStatus;
  is_failed: boolean;
  changed_at: string;
}

export interface DocumentDetail extends Document {
  summary: string;
  questions: string[];
  extractor: Extractor | "";
  summarization_model: string;
  status_history: StatusEvent[];
  file_url: string;
}

export interface DocumentUpdate {
  title?: string;
  summary?: string;
  reference_number?: string;
  year?: number | null;
  issued_on?: string | null;
  tag_ids?: number[];
}

export interface Chunk {
  id: number;
  index: number;
  page: number | null;
  section: string;
  text: string;
}

export type UploadStatus = "queued" | "duplicate" | "rejected";

export interface UploadResult {
  file_name: string;
  status: UploadStatus;
  document_id?: number;
  detail?: string;
  code?: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DocumentFilters {
  q?: string;
  status?: "ready" | "processing" | "failed";
  year?: number[];
  tags?: number[];
  mine?: boolean;
  sort?: "newest" | "oldest" | "issued" | "title";
  page?: number;
  page_size?: number;
}

// --- Search ---------------------------------------------------------------------------
export interface SearchPassage {
  chunk_id: number;
  page: number | null;
  section: string;
  text: string;
  matched: ("vector" | "keyword")[];
}

export interface SearchResult {
  document: Document;
  score: number;
  passages: SearchPassage[];
}

export interface SearchResponse {
  query: string;
  is_question: boolean;
  results: SearchResult[];
  took_ms: number;
}

export interface SearchAnswer {
  answer: string;
  citations: { n: number; document_id: number; title: string; page: number | null }[];
}

// --- Chat -------------------------------------------------------------------------------
export interface Chat {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SourcePassage {
  chunk_id: number;
  page: number | null;
  section: string;
  text: string;
}

/** A document cited in an answer; `n` is the number used in [n] citations. */
export interface Source {
  n: number;
  id: number;
  title: string;
  reference_number: string;
  year: number | null;
  file_name: string;
  preview_image: string;
  page_count: number;
  passages: SourcePassage[];
}

export interface UserMessage {
  id: string;
  role: "user";
  content: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  content: string;
  searches: string[];
  sources: Source[];
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface ChatHistory {
  chat: Chat;
  messages: ChatMessage[];
  scope: { id: number; title: string; file_name: string }[];
}

// --- Dashboard ----------------------------------------------------------------------
export interface Dashboard {
  library: {
    documents: number;
    ready: number;
    pages: number;
    passages: number;
    tags: number;
    years: [number, number] | null;
  };
  pipeline: Record<DocumentStatus | "failed", number>;
  active: Document[];
  by_year: { year: number; count: number }[];
  by_tag: { id: number; name: string; count: number }[];
  timeline: { month: string; count: number }[];
  questions: { question: string; document_id: number }[];
  activity: { chats: number; questions_30d: number };
}
