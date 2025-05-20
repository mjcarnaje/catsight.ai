import { Tag } from "./tags";

export interface SearchSource {
  id: number;
  title: string;
  summary: string;
  year: number;
  tags: Tag[];
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

export interface SearchResults {
  summary: string;
  sources: SearchSource[];
  query_time: number;
}

export interface SearchParams {
  query: string;
  accurate?: boolean;
  year?: string;
  tags?: string;
}
