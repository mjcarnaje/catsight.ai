export interface Source {
  id: string | number;
  title: string;
  description: string;
  file_name: string;
  blurhash: string;
  preview_image: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  contents: {
    snippet: string;
    score: number;
    chunk_index: number;
  }[];
}
