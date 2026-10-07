import { Check, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FacetOption {
  value: string;
  label: string;
  /** Shown muted at the end of the row, e.g. a document count. */
  count?: number;
}

/**
 * A compact multi-select for the filter bar: a button that shows how many values are
 * picked and opens a searchable checklist.
 *
 * @example
 * <FacetFilter label="Tags" icon={<Tag />} options={options} selected={["3"]} onChange={setTags} />
 */
export function FacetFilter({
  label,
  icon,
  options,
  selected,
  onChange,
  searchPlaceholder = "Search...",
  emptyMessage = "Nothing found.",
  disabled,
}: {
  label: string;
  icon?: ReactNode;
  options: FacetOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={selected.length ? `${label}: ${selected.length} selected` : label}
          className={cn("gap-1.5 shadow-none", selected.length > 0 && "border-foreground/30")}
        >
          {icon}
          {label}
          {selected.length > 0 && (
            <span className="rounded-sm bg-accent px-1.5 font-mono text-[10px] leading-4 text-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="!size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command
          // Match on the label, not the id used as the item value
          filter={(_value, search, keywords) =>
            keywords?.join(" ").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    onSelect={() => toggle(option.value)}
                  >
                    <Check className={cn("mr-2 size-4 shrink-0", checked ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">{option.count}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => onChange([])}>
              Clear {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
