import type { DocumentFilters } from "@/types";

/**
 * The /documents URL contract. Other pages link here, e.g. `/documents?tags=3`
 * or `/documents?status=failed&year=2023,2024&mine=1`.
 *
 *   q      text search over title, reference and summary
 *   status ready | processing | failed
 *   tags   comma-separated tag ids
 *   year   comma-separated years
 *   mine   "1" for only my uploads
 *   sort   newest | oldest | issued | title
 *   page   1-based page number
 */
export const STATUS_OPTIONS = ["ready", "processing", "failed"] as const;
export const SORT_OPTIONS = ["newest", "oldest", "issued", "title"] as const;

export const SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  newest: "Newest uploaded",
  oldest: "Oldest uploaded",
  issued: "Recently issued",
  title: "Title A to Z",
};

export const PAGE_SIZE = 20;

function ints(value: string | null): number[] {
  if (!value) return [];
  const parsed = value
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n));
  return [...new Set(parsed)];
}

export function parseFilters(params: URLSearchParams): DocumentFilters {
  const status = params.get("status");
  const sort = params.get("sort");
  const page = Number.parseInt(params.get("page") ?? "", 10);
  const years = ints(params.get("year"));
  const tags = ints(params.get("tags"));
  return {
    q: params.get("q")?.trim() || undefined,
    status: STATUS_OPTIONS.find((s) => s === status),
    year: years.length ? years : undefined,
    tags: tags.length ? tags : undefined,
    mine: params.get("mine") === "1" || undefined,
    sort: SORT_OPTIONS.find((s) => s === sort),
    page: Number.isFinite(page) && page > 1 ? page : undefined,
  };
}

/** Number of filters narrowing the list (page and sort don't count). */
export function activeFilterCount(filters: DocumentFilters) {
  return [filters.q, filters.status, filters.year, filters.tags, filters.mine].filter(Boolean).length;
}

/** A copy of `params` with `changes` applied; `undefined` or empty removes a key. Resets the page unless it is set. */
export function withParams(params: URLSearchParams, changes: Record<string, string | undefined>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  if (!("page" in changes)) next.delete("page");
  return next;
}
