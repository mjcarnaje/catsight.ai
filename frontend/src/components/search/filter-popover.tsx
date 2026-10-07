import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: number;
  label: string;
  /** Small trailing text, e.g. how many documents match. */
  hint?: string;
}

/** A compact multi-select: a small trigger with a count, and a checklist in a popover. */
export function FilterPopover({
  label,
  options,
  selected,
  onChange,
  loading = false,
  searchable = false,
  emptyMessage = "Nothing to choose from.",
}: {
  label: string;
  options: FilterOption[];
  selected: number[];
  onChange: (selected: number[]) => void;
  loading?: boolean;
  searchable?: boolean;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (value: number) =>
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          aria-label={selected.length ? `${label} filter, ${selected.length} selected` : `${label} filter`}
          className="gap-1.5 font-normal"
        >
          {label}
          {selected.length > 0 && (
            <span className="rounded-sm bg-accent px-1 font-mono text-[10px] tabular-nums text-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="!size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          {searchable && <CommandInput placeholder={`Find a ${label.toLowerCase()}...`} />}
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-sm border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      )}
                    >
                      {checked && <Check className="!size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint && (
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{option.hint}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal text-muted-foreground"
              onClick={() => onChange([])}
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
