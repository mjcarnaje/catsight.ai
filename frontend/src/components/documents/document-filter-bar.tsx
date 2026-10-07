import { CalendarDays, Search, Tag, X } from "lucide-react";
import { useMemo } from "react";

import { FacetFilter } from "@/components/documents/facet-filter";
import { SORT_LABELS, SORT_OPTIONS, STATUS_OPTIONS } from "@/components/documents/filter-params";
import type { DocumentFilterState } from "@/components/documents/use-document-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDashboard, useTags } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATUS_LABELS = { all: "All", ready: "Ready", processing: "Processing", failed: "Failed" } as const;

/** Search, status, tags, years, ownership and sort for the library list. */
export function DocumentFilterBar({ state }: { state: DocumentFilterState }) {
  const { filters, search, setSearch, update, clear, activeCount } = state;
  const tags = useTags();
  const dashboard = useDashboard();

  const tagOptions = useMemo(
    () => (tags.data ?? []).map((t) => ({ value: String(t.id), label: t.name, count: t.document_count })),
    [tags.data]
  );
  const yearOptions = useMemo(() => {
    const counts = new Map((dashboard.data?.by_year ?? []).map((y) => [y.year, y.count]));
    // Keep a year that was linked to even if the library has nothing for it
    (filters.year ?? []).forEach((year) => counts.has(year) || counts.set(year, 0));
    return [...counts]
      .sort((a, b) => b[0] - a[0])
      .map(([year, count]) => ({ value: String(year), label: String(year), count }));
  }, [dashboard.data, filters.year]);

  const status = filters.status ?? "all";

  return (
    <div className="flex flex-col gap-3" role="search" aria-label="Filter documents">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Label htmlFor="document-search" className="sr-only">
            Search documents
          </Label>
          <Input
            id="document-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, reference or summary"
            autoComplete="off"
            className="h-8 pl-8 pr-8 text-sm shadow-none [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div role="group" aria-label="Status" className="inline-flex h-8 w-fit items-center rounded-md border p-0.5">
          {(["all", ...STATUS_OPTIONS] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={status === option}
              onClick={() => update({ status: option === "all" ? undefined : option })}
              className={cn(
                "h-6 rounded-sm px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                status === option ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FacetFilter
          label="Tags"
          icon={<Tag />}
          options={tagOptions}
          selected={(filters.tags ?? []).map(String)}
          onChange={(selected) => update({ tags: selected.join(",") || undefined })}
          searchPlaceholder="Search tags"
          emptyMessage="No tags found."
          disabled={tags.isPending}
        />
        <FacetFilter
          label="Year"
          icon={<CalendarDays />}
          options={yearOptions}
          selected={(filters.year ?? []).map(String)}
          onChange={(selected) => update({ year: selected.join(",") || undefined })}
          searchPlaceholder="Search years"
          emptyMessage="No years found."
        />

        <div className="flex items-center gap-2">
          <Switch
            id="only-mine"
            checked={Boolean(filters.mine)}
            onCheckedChange={(checked) => update({ mine: checked ? "1" : undefined })}
          />
          <Label htmlFor="only-mine" className="cursor-pointer text-xs font-normal text-muted-foreground">
            Only my uploads
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
              <X />
              Clear filters
            </Button>
          )}
          <Select value={filters.sort ?? "newest"} onValueChange={(value) => update({ sort: value === "newest" ? undefined : value })}>
            <SelectTrigger aria-label="Sort documents" className="h-8 w-44 text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option} className="text-xs">
                  {SORT_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
