import { useQuery } from "@tanstack/react-query";
import { Check, FileText } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { documentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface ScopedDocument {
  id: number;
  title: string;
}

/** Pick ready documents to limit the conversation to. */
export function DocumentPicker({
  selected,
  onChange,
  children,
}: {
  selected: ScopedDocument[];
  onChange: (documents: ScopedDocument[]) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["documents", { q: debounced, status: "ready", page_size: 20, picker: true }],
    queryFn: () => documentsApi.list({ q: debounced, status: "ready", page_size: 20 }),
    enabled: open,
  });
  const chosen = new Set(selected.map((d) => d.id));

  const toggle = (doc: ScopedDocument) =>
    onChange(chosen.has(doc.id) ? selected.filter((d) => d.id !== doc.id) : [...selected, doc]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Find a document…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{isFetching ? "Searching…" : "No ready documents match."}</CommandEmpty>
            <CommandGroup heading="Ask only about">
              {(data?.results ?? []).map((doc) => {
                const title = doc.title || doc.file_name;
                return (
                  <CommandItem key={doc.id} value={String(doc.id)} onSelect={() => toggle({ id: doc.id, title })} className="gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{title}</span>
                      {(doc.reference_number || doc.year) && (
                        <span className="truncate text-xs text-muted-foreground">{doc.reference_number || doc.year}</span>
                      )}
                    </span>
                    <Check className={cn("size-4 shrink-0", chosen.has(doc.id) ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
