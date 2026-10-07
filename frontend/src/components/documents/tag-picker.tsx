import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useTags } from "@/lib/queries";

/**
 * Chips for the picked tags plus an "Add tag" list of the rest.
 *
 * @example
 * <TagPicker value={tagIds} onChange={setTagIds} labelledBy="tags-label" />
 */
export function TagPicker({
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  labelledBy?: string;
  disabled?: boolean;
}) {
  const { data: tags, isPending, isError } = useTags();
  const [open, setOpen] = useState(false);

  if (isPending) return <Skeleton className="h-8 w-full" />;
  if (isError) return <p className="text-xs text-destructive">Couldn't load the tags.</p>;

  const byId = new Map(tags.map((tag) => [tag.id, tag.name]));
  const available = tags.filter((tag) => !value.includes(tag.id));

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pl-2 pr-1 text-xs">
          {byId.get(id) ?? `Tag ${id}`}
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove tag ${byId.get(id) ?? id}`}
            onClick={() => onChange(value.filter((v) => v !== id))}
            className="grid size-4 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled || tags.length === 0} className="h-7 gap-1 px-2 shadow-none">
            <Plus className="!size-3" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags" />
            <CommandList>
              <CommandEmpty>{tags.length ? "No more tags." : "No tags yet."}</CommandEmpty>
              <CommandGroup>
                {available.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.name} ${tag.id}`}
                    onSelect={() => {
                      onChange([...value, tag.id]);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">{tag.document_count}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
