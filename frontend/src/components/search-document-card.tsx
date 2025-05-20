import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDocumentPreviewUrl, getDocumentUrl } from "@/lib/api";
import { Source } from "@/types/message";
import { Calendar, ChevronRight, Eye, FileText, Layers, Tag } from "lucide-react";
import React, { useState } from "react";
import { Blurhash } from "react-blurhash";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Skeleton } from "./ui/skeleton";

interface SearchDocumentCardProps {
  source: Source;
}

export const SearchDocumentCard: React.FC<SearchDocumentCardProps> = ({ source }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      <Card className="flex flex-col overflow-hidden transition-all duration-200 border shadow-md rounded-xl md:flex-row group bg-gradient-to-b from-white to-muted/5 hover:shadow-lg hover:border-primary/20">
        <div className="relative flex items-center justify-center w-[120px] h-[160px] sm:w-[140px] sm:h-[180px] aspect-[210/297] bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden">
          {source.preview_image && source.blurhash ? (
            <>
              {!imageLoaded && source.blurhash && (
                <div className="absolute inset-0">
                  <Blurhash
                    hash={source.blurhash}
                    width="100%"
                    height="100%"
                    resolutionX={32}
                    resolutionY={32}
                    punch={1}
                  />
                </div>
              )}
              <img
                src={getDocumentPreviewUrl(source.preview_image)}
                alt={source.title}
                className={`w-full h-full object-cover rounded-none transition-all duration-500 ${imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  } group-hover:scale-[1.03]`}
                style={{ aspectRatio: "210/297" }}
                onLoad={() => setImageLoaded(true)}
              />
            </>
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-muted/30 to-muted/10 aspect-[210/297] group-hover:bg-muted/40 transition-colors">
              <FileText className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}
        </div>
        {/* Details Section */}
        <div className="flex flex-col flex-1 min-w-0 gap-4 p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold truncate transition-colors duration-150 group-hover:text-primary">
              {source.title}
            </h3>
            <Badge
              variant="outline"
              className="px-2.5 py-0.5 text-xs font-medium shadow-sm whitespace-nowrap rounded-full"
            >
              {source.file_type}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/30 shadow-sm backdrop-blur-sm">
              <Calendar className="w-3.5 h-3.5 text-primary/60" />
              <span>{source.year}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/30 shadow-sm backdrop-blur-sm max-w-[200px]">
              <FileText className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
              <span className="truncate" title={source.file_name}>
                {source.file_name}
              </span>
            </div>

            {source.tags && source.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 ml-2">
                {source.tags.slice(0, 3).map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs px-2.5 py-1 rounded-full gap-1.5 shadow-sm"
                  >
                    <Tag className="w-3 h-3" />
                    {tag.name}
                  </Badge>
                ))}
                {source.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full shadow-sm">
                    +{source.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="p-4 mt-1 bg-white rounded-lg shadow-sm">
            <Markdown
              content={source.summary}
              className="text-sm font-medium !my-0 !p-0 !bg-transparent !border-none prose-p:mb-1 prose-p:mt-0 prose-p:leading-relaxed"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 mt-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 transition-all rounded-full shadow-sm hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setShowPanel(true)}
                  >
                    <Layers className="w-4 h-4" />
                    <span className="hidden sm:inline">Chunks</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View related chunks</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 transition-all rounded-full shadow-sm hover:bg-primary hover:text-primary-foreground"
              onClick={() => window.open(getDocumentUrl(source.id), "_blank")}
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">View document</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </Card>
      <Sheet open={showPanel} onOpenChange={setShowPanel}>
        <SheetContent className="p-0 overflow-y-auto bg-card text-card-foreground sm:max-w-4xl">
          <SheetHeader className="p-6 pb-4 border-b border-border">
            <SheetTitle className="text-xl font-medium">
              Chunks from {source.title}
            </SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-1 gap-4 p-6">
            {source.contents && source.contents.length > 0 ? (
              source.contents.map((content, idx) => (
                <div
                  key={idx}
                  className="p-4 transition-all duration-200 border rounded-lg shadow-sm bg-gradient-to-br from-white to-muted/5 hover:bg-muted/10 hover:border-primary/20"
                >
                  <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/30 shadow-sm backdrop-blur-sm w-fit">
                      <Layers className="w-3 h-3 text-primary/60" />
                      <span>Chunk #{content.chunk_index}</span>
                    </div>
                  </div>
                  <blockquote className="pl-3 italic border-l-2 border-primary/40">
                    <Markdown
                      content={content.snippet}
                      className="!my-0 !p-0 !bg-transparent !border-none prose-p:mb-0 prose-p:mt-0 prose-p:leading-relaxed"
                    />
                  </blockquote>
                </div>
              ))
            ) : (
              <div className="p-8 text-center border rounded-lg bg-muted/10">
                <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No relevant chunks found.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default SearchDocumentCard;

export const SearchDocumentCardSkeleton = () => {
  return (
    <Card className="flex flex-col overflow-hidden border shadow-md rounded-xl md:flex-row bg-gradient-to-b from-white to-muted/5">
      <div className="relative flex items-center justify-center w-[120px] h-[160px] sm:w-[140px] sm:h-[180px] bg-gradient-to-br from-muted/30 to-muted/10">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="flex flex-col flex-1 min-w-0 gap-4 p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-[200px]" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="w-20 h-6 rounded-full" />
          <Skeleton className="w-32 h-6 rounded-full" />
          <div className="flex gap-2 ml-2">
            <Skeleton className="w-16 h-6 rounded-full" />
            <Skeleton className="w-16 h-6 rounded-full" />
            <Skeleton className="w-16 h-6 rounded-full" />
          </div>
        </div>
        <Skeleton className="w-full h-24 rounded-lg" />
        <div className="flex items-center justify-end gap-3 pt-2 mt-auto">
          <Skeleton className="w-32 rounded-full h-9" />
          <Skeleton className="w-40 rounded-full h-9" />
        </div>
      </div>
    </Card>
  );
};



