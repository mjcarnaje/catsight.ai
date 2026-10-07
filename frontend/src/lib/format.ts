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

/**
 * A stored passage for display: drops heading lines that repeat its `section`
 * (shown separately) and Markdown markers that would otherwise show as text.
 */
export function passageText(text: string, section?: string | null) {
  const repeated = (section ?? "").toLowerCase();
  const lines = text.trim().split("\n");
  while (lines.length && /^#{1,6}\s/.test(lines[0])) {
    const heading = lines[0].replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim().toLowerCase();
    if (!repeated.includes(heading)) break;
    lines.shift();
    while (lines.length && !lines[0].trim()) lines.shift();
  }
  return lines
    .join("\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/<!-- page:\d+ -->/g, "")
    .trim();
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** "qwen/qwen3-vl-30b-a3b-instruct" -> "Qwen3 VL 30B A3B Instruct", "baai/bge-m3" -> "BGE-M3" */
export function modelName(id: string) {
  const name = id.split("/").pop() ?? id;
  return name
    .split(/[-:]/)
    .map((part) => {
      if (/^a?\d+(\.\d+)?[bm]$/i.test(part) || /^vl$/i.test(part)) return part.toUpperCase(); // 30b, a3b, vl
      return /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ")
    .replace(/^Bge /, "BGE-")
    .replace(/^Gpt /, "GPT-");
}
