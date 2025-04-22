import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import MarkdownPreview from "@/components/markdown-preview";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChunkViewer({ chunks, chunk_index, highlight }: { chunks: string[], chunk_index?: string, highlight?: string }) {
  const [current, setCurrent] = useState(chunk_index ? parseInt(chunk_index) : 0);
  if (!chunks) return <Skeleton className="w-full h-full" />;
  if (chunks.length === 0) {
    return <Card className="h-full"><CardContent><p className="text-muted-foreground">No chunks</p></CardContent></Card>;
  }
  return (
    <Card className="flex flex-col h-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-sm">Chunk {current + 1} of {chunks.length}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <MarkdownPreview content={chunks[current]} highlight={highlight} />
      </CardContent>
      <CardFooter>
        <div className="flex justify-between w-full">
          <Button variant="outline" size="sm" onClick={() => setCurrent((i) => Math.max(i - 1, 0))} disabled={current === 0}>
            <ChevronLeft /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrent((i) => Math.min(i + 1, chunks.length - 1))} disabled={current === chunks.length - 1}>
            Next <ChevronRight />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
