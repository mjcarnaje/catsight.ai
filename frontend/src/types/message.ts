export type Role = "user" | "assistant" | "tool";

export interface Source {
  id: number;
  title: string;
  summary: string;
  year: number;
  tags: string[];
  file_name: string;
  blurhash: string;
  preview_image: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  contents: {
    snippet: string;
    chunk_index: number;
  }[];
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  message_type: "message" | "tool_call";
  tool_call?: {
    name: string;
    query: string;
  };
  tool_result?: {
    sources: Source[];
  };
}
