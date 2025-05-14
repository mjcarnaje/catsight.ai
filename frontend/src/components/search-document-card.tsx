import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDocumentPreviewUrl, getDocumentUrl } from "@/lib/api";
import { Source } from "@/types/message";
import { BookOpen, Calendar, ChevronRight, FileText, Tag } from "lucide-react";
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
      <Card className="flex flex-col overflow-hidden transition-all duration-200 border shadow-sm md:flex-row group bg-background/80 backdrop-blur-md hover:shadow-lg hover:border-primary/20">
        <div className="relative flex items-center justify-center w-[120px] h-[160px] sm:w-[140px] sm:h-[180px] aspect-[210/297] bg-muted/40">
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
                className={`w-full h-full object-cover rounded-none transition-all duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"
                  } group-hover:scale-[1.03]`}
                style={{ aspectRatio: "210/297" }}
                onLoad={() => setImageLoaded(true)}
              />
            </>
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-muted/30 aspect-[210/297] group-hover:bg-muted/40 transition-colors">
              <FileText className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}
        </div>
        {/* Details Section */}
        <div className="flex flex-col flex-1 min-w-0 gap-3 p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold truncate transition-colors duration-150 group-hover:text-primary">
              {source.title}
            </h3>
            <Badge
              variant="outline"
              className="px-2 py-0.5 text-xs font-medium shadow-sm whitespace-nowrap"
            >
              {source.file_type}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{source.year}</span>
            </div>
            <span className="mx-1">·</span>
            <span
              title={source.file_name}
              className="truncate max-w-[150px] md:max-w-[250px]"
            >
              {source.file_name}
            </span>
            {source.tags && source.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 ml-2">
                {source.tags.slice(0, 3).map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs px-2 py-0.5 bg-secondary/50"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {source.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    +{source.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="mt-1">
            <Markdown
              content={source.summary}
              className="text-sm font-medium !my-0 !p-0 !bg-transparent !border-none prose-p:mb-1 prose-p:mt-0 prose-p:leading-relaxed"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 mt-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 transition-all hover:bg-primary hover:text-primary-foreground"
              onClick={() => setShowPanel(true)}
            >
              <BookOpen className="w-4 h-4" />
              Related Chunks
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 transition-all hover:bg-primary hover:text-primary-foreground"
              onClick={() => window.open(getDocumentUrl(source.id), "_blank")}
            >
              <BookOpen className="w-4 h-4" />
              View full document
              <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
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
                  className="p-3 transition-all duration-200 border rounded-lg bg-muted/20 hover:bg-muted/40 hover:border-primary/20"
                >
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <span>Chunk #{content.chunk_index}</span>
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
              <div className="text-sm text-muted-foreground">
                No relevant chunks found.
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
    <Card className="flex flex-col overflow-hidden border shadow-sm md:flex-row bg-background/80 backdrop-blur-md">
      <div className="relative flex items-center justify-center w-[120px] h-[160px] sm:w-[140px] sm:h-[180px] bg-muted/40">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="flex flex-col flex-1 min-w-0 gap-4 p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-[200px]" />
          <Skeleton className="w-16 h-5" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="w-20 h-4" />
          <Skeleton className="w-32 h-4" />
          <div className="flex gap-2 ml-2">
            <Skeleton className="w-16 h-5" />
            <Skeleton className="w-16 h-5" />
            <Skeleton className="w-16 h-5" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-[90%] h-4" />
          <Skeleton className="w-[80%] h-4" />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 mt-auto">
          <Skeleton className="w-32 h-9" />
          <Skeleton className="w-40 h-9" />
        </div>
      </div>
    </Card>
  );
};


