import React, { useState } from "react";
import { Source } from "@/types/message";
import { SourcesPanel } from "./sources-panel";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";
import { getDocumentPreviewUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setSheetOpen(true)}
              size="sm"
              variant="outline"
              className={cn(
                "h-8 gap-1.5 text-xs",
                className
              )}
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
                      <div className="flex items-center justify-center w-full h-full bg-pink-500 text-white">
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