import React, { useState } from "react";
import { Source } from "@/types/source";
import { SourcesPanel } from "./sources-panel";
import { cn } from "@/lib/utils";
import { BookOpen, FileText } from "lucide-react";

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
      <button
        onClick={() => setSheetOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/80 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors",
          className
        )}
        aria-label={`View ${sources.length} sources`}
        title={`View ${sources.length} sources`}
      >
        <div className="flex items-center">
          {displaySources.map((source, index) => (
            <div
              key={`${source.title}-${index}`}
              className={cn(
                "flex bg-primary items-center justify-center w-6 h-6 text-xs font-bold rounded-full",
                "bg-primary",
                index > 0 && "-ml-2"
              )}
              style={{ zIndex: 3 - index }}
            >
              <FileText className="w-3.5 h-3.5" />
            </div>
          ))}
          {hasMoreSources && (
            <div
              className="flex items-center justify-center w-6 h-6 -ml-2 text-xs font-bold border-2 rounded-full border-background bg-muted text-muted-foreground"
              style={{ zIndex: 0 }}
            >
              +{sources.length - 3}
            </div>
          )}
        </div>
        <span className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          Sources
        </span>
      </button>

      <SourcesPanel
        sources={sources}
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
} 