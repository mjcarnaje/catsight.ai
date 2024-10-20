export type Document = {
  id: number;
  title: string;
  file: string;
  ocr_file: string | null;
  description: string | null;
  status: "pending" | "uploaded" | "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
};
