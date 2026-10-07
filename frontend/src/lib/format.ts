import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function timeAgo(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
}

export function formatDate(iso: string | null | undefined, pattern = "MMM d, yyyy") {
  return iso ? format(parseISO(iso), pattern) : "";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** "google/gemini-3.1-flash-lite" -> "Gemini 3.1 Flash Lite" */
export function modelName(id: string) {
  const name = id.split("/").pop() ?? id;
  return name
    .split(/[-:]/)
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
    .replace(/^Bge /, "BGE-")
    .replace(/^Gpt /, "GPT-");
}
