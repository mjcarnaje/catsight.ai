import { Search, X } from "lucide-react";
import { useEffect, useRef, type FormEvent } from "react";

import { FilterPopover, type FilterOption } from "@/components/search/filter-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FilterProps {
  options: FilterOption[];
  selected: number[];
  onChange: (selected: number[]) => void;
  loading?: boolean;
}

/** The query box with the year and tag filters under it. Searching happens on submit. */
export function SearchBar({
  value,
  onValueChange,
  onSubmit,
  years,
  tags,
  focusOnMount = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  years: FilterProps;
  tags: FilterProps;
  focusOnMount?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, [focusOnMount]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSubmit();
  };

  const labelOf = (options: FilterOption[], id: number, fallback: string) =>
    options.find((option) => option.value === id)?.label ?? fallback;

  const chips = [
    ...years.selected.map((year) => ({
      key: `year-${year}`,
      label: String(year),
      remove: () => years.onChange(years.selected.filter((item) => item !== year)),
    })),
    ...tags.selected.map((id) => ({
      key: `tag-${id}`,
      label: labelOf(tags.options, id, `Tag ${id}`),
      remove: () => tags.onChange(tags.selected.filter((item) => item !== id)),
    })),
  ];

  const clearFilters = () => {
    years.onChange([]);
    tags.onChange([]);
  };

  return (
    <form role="search" onSubmit={submit} className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={input}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-label="Search the library"
          placeholder="Search the library, or ask a question"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 pl-10 pr-28 text-base"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Clear search"
              onClick={() => {
                onValueChange("");
                input.current?.focus();
              }}
            >
              <X />
            </Button>
          )}
          <Button type="submit" disabled={!value.trim()}>
            Search
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPopover
          label="Year"
          options={years.options}
          selected={years.selected}
          onChange={years.onChange}
          loading={years.loading}
          emptyMessage="No years yet."
        />
        <FilterPopover
          label="Tag"
          options={tags.options}
          selected={tags.selected}
          onChange={tags.onChange}
          loading={tags.loading}
          searchable
          emptyMessage="No tag found."
        />
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.remove}
            aria-label={`Remove filter ${chip.label}`}
            className="inline-flex h-8 max-w-full items-center gap-1 rounded-md border bg-muted/40 pl-2.5 pr-1.5 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="truncate">{chip.label}</span>
            <X className="size-3 shrink-0 text-muted-foreground" />
          </button>
        ))}
        {chips.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </form>
  );
}
