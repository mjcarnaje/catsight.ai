import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { AnswerPanel } from "@/components/search/answer-panel";
import type { FilterOption } from "@/components/search/filter-popover";
import { queryTerms, termsPattern } from "@/components/search/query-text";
import { ResultCard, ResultCardSkeleton } from "@/components/search/result-card";
import { SearchBar } from "@/components/search/search-bar";
import { SearchIntro } from "@/components/search/search-intro";
import { Button } from "@/components/ui/button";
import { errorMessage, searchApi } from "@/lib/api";
import { plural } from "@/lib/format";
import { keys, useDashboard, useTags } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** "2023,2024" -> [2023, 2024]: sorted and unique so equal filters share one cache entry. */
function parseIds(value: string | null): number[] {
  if (!value) return [];
  const ids = value.split(",").map((part) => Number(part.trim())).filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Hybrid (keyword + meaning) search over the library. The query and filters live in the URL
 * (`?q=&year=2023,2024&tags=3`), so a search can be shared and back/forward steps through them.
 * Questions also get a short cited answer, requested separately because it uses a daily question.
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = params.get("q")?.trim() ?? "";
  const yearParam = params.get("year");
  const tagsParam = params.get("tags");
  const years = useMemo(() => parseIds(yearParam), [yearParam]);
  const tagIds = useMemo(() => parseIds(tagsParam), [tagsParam]);
  const filters = useMemo(() => ({ year: years, tags: tagIds }), [years, tagIds]);

  // The box can differ from the URL while typing; the URL is only updated on submit
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const dashboard = useDashboard();
  const tags = useTags();

  const search = useQuery({
    queryKey: keys.search(q, filters),
    queryFn: () => searchApi.search(q, filters),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  const go = useCallback(
    (next: { q?: string; year?: number[]; tags?: number[] }) => {
      const nextQ = next.q ?? q;
      const nextYears = next.year ?? years;
      const nextTags = next.tags ?? tagIds;
      const target = new URLSearchParams();
      if (nextQ) target.set("q", nextQ);
      if (nextYears.length) target.set("year", nextYears.join(","));
      if (nextTags.length) target.set("tags", nextTags.join(","));
      setParams(target);
    },
    [q, years, tagIds, setParams]
  );

  const submit = () => {
    const next = draft.trim();
    if (!next) return;
    if (next === q) void search.refetch();
    else go({ q: next });
  };

  const yearOptions = useMemo<FilterOption[]>(() => {
    const known = new Map((dashboard.data?.by_year ?? []).map((item) => [item.year, item.count]));
    // Keep years from a shared link selectable even if the library has none
    const all = new Set([...known.keys(), ...years]);
    return [...all]
      .sort((a, b) => b - a)
      .map((year) => ({
        value: year,
        label: String(year),
        hint: known.has(year) ? String(known.get(year)) : undefined,
      }));
  }, [dashboard.data, years]);

  const tagOptions = useMemo<FilterOption[]>(
    () =>
      (tags.data ?? []).map((tag) => ({
        value: tag.id,
        label: tag.name,
        hint: String(tag.document_count),
      })),
    [tags.data]
  );

  const response = search.data;
  const stale = search.isPlaceholderData;
  const pattern = useMemo(() => termsPattern(queryTerms(response?.query ?? q)), [response?.query, q]);
  const hasFilters = years.length > 0 || tagIds.length > 0;

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Search" description="Finds exact words and related meaning across every page in the library." />

      <SearchBar
        value={draft}
        onValueChange={setDraft}
        onSubmit={submit}
        focusOnMount={!q}
        years={{
          options: yearOptions,
          selected: years,
          onChange: (value) => go({ year: value }),
          loading: dashboard.isPending && years.length === 0,
        }}
        tags={{
          options: tagOptions,
          selected: tagIds,
          onChange: (value) => go({ tags: value }),
          loading: tags.isPending && tagIds.length === 0,
        }}
      />

      {!q ? (
        <SearchIntro onPick={(query) => go({ q: query })} />
      ) : search.isError ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="break-words">{errorMessage(search.error, "The search failed. Try again.")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={search.isFetching}
              onClick={() => void search.refetch()}
            >
              Try again
            </Button>
          </div>
        </div>
      ) : !response || (stale && response.results.length === 0) ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Searching">
          <ResultCardSkeleton />
          <ResultCardSkeleton />
          <ResultCardSkeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {response.is_question && response.results.length > 0 && !stale && (
            <AnswerPanel
              // A new question starts a new panel; the same one reuses its cached answer
              key={JSON.stringify([q, filters])}
              q={q}
              filters={filters}
              onContinue={() => navigate("/chat", { state: { prompt: q } })}
            />
          )}

          <p className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {plural(response.results.length, "document")} · {response.took_ms} ms
          </p>

          {response.results.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={`Nothing found for "${response.query}"`}
              description={
                <>
                  Try fewer or different words, a reference number such as 01592-2023, or ask it as a question.
                  {hasFilters && " The year and tag filters narrow the results too."}
                </>
              }
              action={
                hasFilters ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => go({ year: [], tags: [] })}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ol
              aria-label="Search results"
              aria-busy={stale}
              className={cn("flex flex-col gap-4 transition-opacity", stale && "opacity-60")}
            >
              {response.results.map((result) => (
                <li key={result.document.id}>
                  <ResultCard result={result} pattern={pattern} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </PageContainer>
  );
}
