import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDocumentPreviewUrl, getDocumentUrl } from "@/lib/api";
import { Source } from "@/types/message";
import { BookOpen, Calendar, ChevronRight, FileText, Tag } from "lucide-react";
import React, { useState } from "react";
import { Blurhash } from "react-blurhash";

interface SourceCardProps {
  source: Source;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow duration-200 border shadow-sm md:flex-row group bg-background/80 backdrop-blur-md hover:shadow-lg">
      {/* Preview Section */}
      <div className="relative flex items-center justify-center w-[100px] h-[120px] sm:w-[120px] sm:h-[140px] aspect-[210/297] bg-muted/40 ">
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
              className={`w-full h-full object-cover rounded-none transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'} group-hover:scale-[1.03] transition-transform duration-700`}
              style={{ aspectRatio: '210/297' }}
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-muted/30 aspect-[210/297]">
            <FileText className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
      </div>
      {/* Details Section */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 p-6">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-bold truncate transition-colors duration-150 group-hover:text-primary">
            {source.title}
          </h3>
          <Badge variant="outline" className="ml-2 px-2 py-0.5 text-xs font-medium shadow-sm whitespace-nowrap">
            {source.file_type}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{source.year}</span>
          </div>
          <span className="mx-1">·</span>
          <span title={source.file_name} className="truncate max-w-[120px] md:max-w-[200px]">{source.file_name}</span>
          {source.tags && source.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-2">
              {source.tags.slice(0, 3).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5">
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
        <div className="mb-2">
          <Markdown content={source.summary} className="text-sm font-medium !my-0 !p-0 !bg-transparent !border-none prose-p:mb-1 prose-p:mt-0 prose-p:leading-snug" />
        </div>
        <div className="pr-2 space-y-2 overflow-x-auto max-h-48 custom-scrollbar">
          {source.contents && source.contents.length > 0 ? (
            source.contents.map((content, idx) => (
              <div key={idx} className="p-2 transition-colors border rounded-lg bg-muted/20 hover:bg-muted/40">
                <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
                  <span>Chunk #{content.chunk_index}</span>
                </div>
                <blockquote className="pl-2 italic border-l-2 border-primary/40">
                  <Markdown content={content.snippet} className="!my-0 !p-0 !bg-transparent !border-none prose-p:mb-0 prose-p:mt-0 prose-p:leading-tight" />
                </blockquote>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No relevant chunks found.</div>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 transition-colors hover:bg-primary hover:text-primary-foreground"
            onClick={() => window.open(getDocumentUrl(source.id), "_blank")}
          >
            <BookOpen className="w-4 h-4" />
            View full document
            <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Export default for compatibility
export default SourceCard; 