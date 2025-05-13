import React, { useState } from "react";
import { Source } from "@/types/message";
import { SourcesPanel } from "./sources-panel";
import { cn } from "@/lib/utils";
import { BookOpen, ExternalLink, ChevronDown } from "lucide-react";
import { getDocumentPreviewUrl, getDocumentUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SourcesButtonProps {
  sources: Source[];
  className?: string;
}

export function SourcesButton({ sources, className }: SourcesButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Take only the first 3 sources for display
  const displaySources = sources.slice(0, 3);
  const hasMoreSources = sources.length > 3;

  const openFirstDocument = () => {
    if (sources.length > 0) {
      window.open(getDocumentUrl(sources[0].id), '_blank');
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-8 gap-1.5 text-xs",
                className
              )}
              onClick={() => setSheetOpen(true)}
            >
              <div className="flex items-center mr-1">
                {displaySources.map((source, index) => (
                  <div
                    key={`${source.title}-${index}`}
                    className={cn(
                      "flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full overflow-hidden",
                      index > 0 && "-ml-1.5",
                      "border-[1.5px] border-white"
                    )}
                    style={{ zIndex: 3 - index }}
                  >
                    {source.preview_image ? (
                      <img
                        src={getDocumentPreviewUrl(source.preview_image)}
                        alt={source.title}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-white bg-pink-500">
                        {source.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {hasMoreSources && (
                  <div
                    className="flex items-center justify-center w-5 h-5 -ml-1.5 text-[10px] font-bold border-[1.5px] rounded-full border-white bg-gray-100 text-gray-600"
                    style={{ zIndex: 0 }}
                  >
                    +{sources.length - 3}
                  </div>
                )}
              </div>
              <BookOpen className="w-3 h-3" />
              <span>Sources</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View {sources.length} document {sources.length === 1 ? 'source' : 'sources'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SourcesPanel
        sources={sources}
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
} 