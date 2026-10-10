/** Types mirroring the Django API (backend/app/serializers.py and views). */

// --- Accounts ---------------------------------------------------------------------
/** Platform-wide role. What someone may do inside an organization is their OrgRole. */
export type Role = "guest" | "user" | "super_admin";

/** admin: members, invitations, tags, AI provider, every document; member: uploads and own documents; guest: read and ask. */
export type OrgRole = "admin" | "member" | "guest";

export interface OrganizationRef {
  id: number;
  slug: string;
  name: string;
}

export interface Membership {
  organization: OrganizationRef;
  role: OrgRole;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  avatar: string;
  is_guest: boolean;
  /** Creates organizations; sees no organization's data without a membership. */
  is_super_admin: boolean;
  /** Oldest first; the first is used when no organization was chosen. */
  memberships: Membership[];
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

export type Provider = "openrouter" | "openai" | "ollama";

/** The organization the request acted in (X-Organization header), as /api/config/ reports it. */
export interface ConfigOrganization extends OrganizationRef {
  role: OrgRole;
  /** False: read-only until an admin adds a provider (Settings → AI provider). */
  ai_configured: boolean;
  /** Why the provider can't be used, when ai_configured is false. */
  ai_error: string;
}

export interface AppConfig {
  demo_mode: boolean;
  /** Whether this member may upload: not guests, only with a working provider, admins even when uploads are off. */
  uploads_enabled: boolean;
  guest_access: boolean;
  allowed_email_domains: string[];
  /** Signed in and in an organization; null otherwise. */
  organization: ConfigOrganization | null;
  /** The organization's provider ("" when it has none). */
  provider: Provider | "";
  /** The organization's models; null without a working provider. reranker is "" when off. */
  models: { chat: string; ocr: string; embedding: string; reranker: string } | null;
  /** The default converter ("" when none can run), and whether Marker refines hard regions with the OCR model. */
  extraction: { default: Extractor | ""; marker_llm: boolean };
  limits: Limits;
  guest_ttl_hours: number;
  // Signed-in only
  usage?: Usage;
  extractors?: { default: Extractor | ""; options: Extractor[] };
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

// --- Organization administration (org admins) ------------------------------------------
export interface OrganizationDetail extends OrganizationRef {
  role: OrgRole;
  member_count: number;
  created_at: string;
}

export interface Member {
  /** The membership's id (used in /organization/members/<id>/). */
  id: number;
  user: { id: number; email: string; first_name: string; last_name: string; avatar: string; is_guest: boolean };
  role: OrgRole;
  created_at: string;
  is_you: boolean;
}

export type InvitationStatus = "pending" | "accepted" | "expired";

export interface Invitation {
  id: number;
  email: string;
  role: Exclude<OrgRole, "guest">;
  status: InvitationStatus;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

/** Returned when an invitation is created or re-sent: the only time its link is shown. */
export interface IssuedInvitation {
  invitation: Invitation;
  link: string;
  /** False when email isn't set up or sending failed: share the link yourself. */
  email_sent: boolean;
}

/** GET /api/invitations/<token>/ (no sign-in needed). */
export interface InvitationPreview {
  organization: { name: string; slug: string };
  email: string;
  role: Exclude<OrgRole, "guest">;
  status: InvitationStatus;
  invited_by_name: string | null;
  account_exists: boolean;
}

// --- AI provider (org admins) -------------------------------------------------------------
export type ModelRole = "chat_model" | "fast_model" | "ocr_model" | "embedding_model" | "reranker_model";
export type ModelChoices = Record<ModelRole, string>;

export interface AISettings {
  provider: Provider | "";
  has_key: boolean;
  key_last4: string;
  /** What the admin saved: "" means the provider's default, "none" turns the reranker or OCR model off. */
  models: ModelChoices;
  /** The models actually used (defaults filled in); null without a provider. */
  effective: ModelChoices | null;
  defaults: Record<Provider, ModelChoices>;
  providers: { value: Provider; label: string; needs_key: boolean; available: boolean }[];
  embedding_dimensions: number;
  /** Ready documents whose vectors came from another embedding model (re-embedding pending). */
  documents_to_reindex: number;
}

export interface AISettingsUpdate {
  provider: Provider | "";
  /** Omit to keep the saved key; required when switching between hosted providers. */
  api_key?: string;
  models: Partial<ModelChoices>;
  /** Required (true) when the embedding model changes and documents must be re-embedded. */
  confirm_reindex?: boolean;
}

// --- Platform administration (super admin) ---------------------------------------------
export type TagPreset = "general" | "msu-iit";

export interface AdminOrganization extends OrganizationRef {
  created_at: string;
  member_count: number;
  document_count: number;
  ai_provider: Provider | "";
  ollama_allowed: boolean;
}

export interface AdminOrganizationCreate {
  name: string;
  slug?: string;
  preset: TagPreset;
  /** Invite this address as the organization's first admin. */
  admin_email?: string;
  /** Make the super admin an admin of the new organization. */
  add_me?: boolean;
}

export interface AdminOrganizationCreated {
  organization: AdminOrganization;
  /** Present when admin_email was given. */
  invitation?: IssuedInvitation;
}
