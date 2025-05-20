import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { documentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  FileSearch,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "../ui/scroll-area";

interface DocumentSelectorProps {
  selectedDocs: Document[];
  onSelect: (doc: Document) => void;
  onRemove: (docId: number) => void;
  disabled?: boolean;
  iconOnly?: boolean;
}

export function DocumentSelector({
  selectedDocs,
  onSelect,
  onRemove,
  disabled = false,
  iconOnly = false,
}: DocumentSelectorProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["document-search", searchQuery],
    queryFn: () =>
      documentsApi
        .standardSearch(searchQuery)
        .then((response) => response.data.sources),
    enabled: searchQuery.length > 2,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length < 3) {
      toast({
        title: "Search query too short",
        description: "Please enter at least 3 characters to search",
        variant: "destructive",
      });
      return;
    }
    refetch();
  };

  const toggleDocumentSelection = (doc: Document) => {
    const isSelected = selectedDocs.some((selected) => selected.id === doc.id);
    if (isSelected) {
      onRemove(doc.id);
    } else {
      onSelect(doc);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={iconOnly ? "ghost" : "outline"}
          size={iconOnly ? "icon" : "sm"}
          className={cn(
            iconOnly
              ? "w-8 h-8 text-gray-500 hover:text-primary"
              : "gap-1.5 text-gray-600 hover:text-primary",
            selectedDocs.length > 0 && "text-primary",
            selectedDocs.length > 0 && !iconOnly && "border-primary"
          )}
          disabled={disabled}
        >
          <FileSearch className="w-4 h-4" />
          {!iconOnly && (
            <span>
              {selectedDocs.length > 0
                ? `${selectedDocs.length} file${selectedDocs.length > 1 ? "s" : ""
                } selected`
                : "Select files"}
            </span>
          )}
          {iconOnly && selectedDocs.length > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-primary rounded-full">
              {selectedDocs.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[350px] p-3"
        align="start"
        alignOffset={-10}
        sideOffset={10}
      >
        <div className="flex flex-col gap-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={searchQuery.length < 3 || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </form>

          {selectedDocs.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-gray-500">
                Selected documents:
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedDocs.map((doc) => (
                  <Badge
                    key={doc.id}
                    variant="outline"
                    className="gap-1 px-2 py-1 text-xs bg-primary/5"
                  >
                    <span className="truncate max-w-[150px]">
                      {doc.title || doc.file_name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-3 h-3 p-0"
                      onClick={() => onRemove(doc.id)}
                    >
                      <X className="w-3 h-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-2 text-sm text-red-600 rounded bg-red-50">
              Failed to search documents. Please try again.
            </div>
          )}

          <ScrollArea className="flex flex-col h-[250px] -mx-1 px-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : searchResults?.length ? (
              <div className="space-y-2">
                {searchResults.map((doc) => {
                  const isSelected = selectedDocs.some(
                    (selected) => selected.id === doc.id
                  );
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-50",
                        isSelected && "bg-primary/5 hover:bg-primary/10"
                      )}
                      onClick={() => toggleDocumentSelection(doc)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="translate-y-1"
                        onCheckedChange={() => toggleDocumentSelection(doc)}
                      />
                      <div className="flex-1 space-y-1 text-sm">
                        <div className="font-medium">
                          {doc.title || doc.file_name}
                        </div>
                        {doc.summary && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {doc.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : searchQuery.length > 2 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-gray-500">
                <BookOpenCheck className="w-8 h-8 text-gray-300" />
                <div>
                  <p className="text-sm font-medium">No documents found</p>
                  <p className="text-xs">
                    Try a different search term or upload new documents
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-gray-500">
                <Search className="w-8 h-8 text-gray-300" />
                <div>
                  <p className="text-sm font-medium">Search for documents</p>
                  <p className="text-xs">
                    Enter at least 3 characters to search
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
} 