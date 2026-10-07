import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { activeFilterCount, parseFilters, withParams } from "@/components/documents/filter-params";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The library filters, kept in the URL query string so views can be linked to and survive
 * a refresh. The search box keeps its own state and reaches the URL after a short pause.
 */
export function useDocumentFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const urlQuery = params.get("q") ?? "";

  const [search, setSearch] = useState(urlQuery);
  const pushedQuery = useRef(urlQuery);

  /** Change URL params. Anything but `page` goes back to page 1. */
  const update = useCallback(
    (changes: Record<string, string | undefined>, options: { replace?: boolean } = {}) =>
      setParams((prev) => withParams(prev, changes), { replace: options.replace }),
    [setParams]
  );

  // URL -> input: someone linked here with ?q=, or "clear filters" was pressed
  useEffect(() => {
    if (urlQuery.trim() !== pushedQuery.current.trim()) {
      pushedQuery.current = urlQuery;
      setSearch(urlQuery);
    }
  }, [urlQuery]);

  // Input -> URL, debounced
  useEffect(() => {
    const next = search.trim();
    if (next === pushedQuery.current.trim()) return;
    const timer = setTimeout(() => {
      pushedQuery.current = next;
      update({ q: next || undefined }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, update]);

  const clear = useCallback(() => {
    pushedQuery.current = "";
    setSearch("");
    setParams({}, { replace: false });
  }, [setParams]);

  return {
    filters,
    page: filters.page ?? 1,
    search,
    setSearch,
    update,
    clear,
    activeCount: activeFilterCount(filters),
  };
}

export type DocumentFilterState = ReturnType<typeof useDocumentFilters>;
