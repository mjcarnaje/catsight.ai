import type { Extractor } from "@/types";

/** How each text extractor is named in the UI. */
export const EXTRACTOR_LABELS: Record<Extractor, string> = {
  vision: "Vision model",
  marker: "Marker",
  docling: "Docling",
  markitdown: "MarkItDown",
};

export function extractorLabel(extractor: string) {
  return EXTRACTOR_LABELS[extractor as Extractor] ?? extractor;
}
