import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Source } from "@/types/source";
import { format } from "date-fns";
import { FileText } from "lucide-react";

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

        <div className="p-4 space-y-6">
          {sources.map((source) => (
            <div key={source.id} className="pb-6 border-b border-border">
              <div className="mb-1 text-sm text-muted-foreground">
                {format(new Date(source.created_at), "LLLL d")} — {source.description}
              </div>

              <div className="flex items-start gap-3 mt-3">
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 overflow-hidden rounded-full text-primary-foreground bg-primary">
                  <FileText className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1">
                  <div className="text-sm font-semibold uppercase text-muted-foreground">
                    {source.title}
                  </div>
                  <h3 className="mt-1 text-base font-medium">
                    {source.description}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format(new Date(source.updated_at), "LLLL d")} — {source.file_name}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
} 