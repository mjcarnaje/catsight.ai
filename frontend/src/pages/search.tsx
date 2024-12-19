import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [limit, setLimit] = useState("10");
  const [searchParams, setSearchParams] = useState<{
    query: string;
    title?: string;
    limit?: number;
  } | null>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", searchParams],
    queryFn: () => documentsApi.search(searchParams!),
    enabled: !!searchParams?.query,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearchParams({
      query: query.trim(),
      ...(title && { title: title.trim() }),
      ...(limit && { limit: parseInt(limit) }),
    });
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <Input
              placeholder="Enter your search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-white/5 border-white/10 text-white"
            />
            <Input
              placeholder="Filter by title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="md:w-64 bg-white/5 border-white/10 text-white"
            />
            <Input
              type="number"
              placeholder="Limit results..."
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="md:w-32 bg-white/5 border-white/10 text-white"
            />
            <Button type="submit" className="gap-2">
              <SearchIcon className="h-4 w-4" />
              Search
            </Button>
          </div>
        </form>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : (
          results && (
            <div className="grid gap-6">
              {results.data.map((result) => (
                <div
                  key={result.document_id}
                  className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-all hover:border-white/20 hover:bg-white/10"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white">
                      {result.document_title}
                    </h3>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-400">
                      <span>
                        Created {format(new Date(result.created_at), "PP")}
                      </span>
                      <span>
                        Score: {(result.similarity_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {result.chunks.map((chunk) => (
                      <div
                        key={chunk.chunk_index}
                        className="rounded-lg bg-white/5 p-4"
                      >
                        <div className="mb-2 text-xs text-gray-400">
                          Chunk {chunk.chunk_index + 1} •{" "}
                          {(chunk.similarity_score * 100).toFixed(1)}% match
                        </div>
                        <Markdown content={chunk.content} className="text-xs" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
