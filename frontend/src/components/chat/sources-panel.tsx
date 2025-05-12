import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Source } from "@/types/message";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import { getDocumentPreviewUrl } from "@/lib/api";

interface SourcesPanelProps {
  sources: Source[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SourcesPanel({ sources, isOpen, onOpenChange }: SourcesPanelProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="p-0 overflow-y-auto bg-card text-card-foreground sm:max-w-md">
        <SheetHeader className="p-4 pb-4 border-b border-border">
          <SheetTitle className="text-xl font-medium">Sources</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-4 p-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="overflow-hidden border rounded-lg shadow-sm border-border"
            >
              {/* Header Section */}
              <div className="flex items-center justify-between p-3 border-b bg-muted/30 border-border">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 overflow-hidden rounded-full bg-muted">
                    {source.preview_image ? (
                      <img
                        src={getDocumentPreviewUrl(source.preview_image)}
                        alt={source.title}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold line-clamp-1">{source.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(source.updated_at), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Section */}
              <div className="p-3">
                <div className="mb-2 text-sm font-medium">{source.description}</div>

                <div className="p-3 text-sm rounded-md bg-muted/50">
                  {source.contents && source.contents.length > 0 && (
                    <div className="space-y-2">
                      {source.contents.slice(0, 2).map((content, idx) => (
                        <blockquote key={idx} className="pl-2 italic border-l-2 border-primary/50">
                          {content.snippet}
                        </blockquote>
                      ))}
                      {source.contents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          + {source.contents.length - 2} more relevant sections
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                  <span>{source.file_name}</span>
                  <span>{source.file_type.toUpperCase()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
} 