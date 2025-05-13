import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Source } from "@/types/message";
import { format } from "date-fns";
import { FileText, ExternalLink } from "lucide-react";
import { getDocumentPreviewUrl, getDocumentUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SourcesPanelProps {
  sources: Source[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SourcesPanel({
  sources,
  isOpen,
  onOpenChange,
}: SourcesPanelProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="p-0 overflow-y-auto bg-card text-card-foreground sm:max-w-4xl">
        <SheetHeader className="p-4 pb-4 border-b border-border">
          <SheetTitle className="text-xl font-medium">Sources</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-4 p-4">
          {sources.map((source) => (
            <SourceItem key={source.id} source={source} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SourceItemProps {
  source: Source;
}

function SourceItem({ source }: SourceItemProps) {
  const [showContent, setShowContent] = useState(false);

  return (
    <div
      key={source.id}
      className="transition-shadow border rounded-lg shadow-sm border-border hover:shadow-md bg-background group"
      tabIndex={0}
      aria-label={`Source: ${source.title}`}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/40 border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 overflow-hidden rounded-full bg-muted">
            {source.preview_image ? (
              <img
                src={getDocumentPreviewUrl(source.preview_image)}
                alt={source.title}
                className="object-cover w-full h-full"
              />
            ) : (
              <FileText className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="text-base font-bold line-clamp-1 text-foreground">
              {source.title}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(source.updated_at), "MMM d, yyyy")}
            </div>
          </div>
        </div>
        <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide">
          {source.file_type}
        </span>
      </div>

      {/* Content Section */}
      <div className="p-4">
        <div className="mb-2 text-sm font-medium">
          <Markdown
            content={source.summary}
            className="text-sm font-medium !my-0 !p-0 !bg-transparent !border-none"
          />
        </div>
        <div className={`transition-all duration-300 ${showContent ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
          aria-hidden={!showContent}
        >
          {showContent && (
            <ScrollArea className="w-full h-60">
              {source.contents && source.contents.length > 0 && (
                <div className="space-y-2">
                  {source.contents.map((content, idx) => (
                    <blockquote
                      key={idx}
                      className="pl-2 italic border-l-2 border-primary/50"
                    >
                      <Markdown
                        content={content.snippet}
                        className="!my-0 !p-0 !bg-transparent !border-none"
                      />
                    </blockquote>
                  ))}
                  {source.contents.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      + {source.contents.length - 2} more relevant sections
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate max-w-[120px]" title={source.file_name}>{source.file_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="px-2 text-xs h-7"
              aria-expanded={showContent}
              aria-controls={`source-content-${source.id}`}
              onClick={() => setShowContent((prev) => !prev)}
            >
              {showContent ? 'Show Less' : 'Show More'}
            </Button>
            <Button
              size="sm"
              variant="default"
              className="px-3 text-xs font-semibold h-7"
              onClick={() => window.open(getDocumentUrl(source.id), "_blank")}
              title="Open the full document in a new tab"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Document
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
