import { DocumentCardSkeleton } from "@/components/document-card-skeleton";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import SourceCard from "@/components/ui/source-card";
import { documentsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useState<{ query: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get("query");
    if (queryParam) {
      setQuery(queryParam);
      setSearchParams({ query: queryParam });
    }
  }, [location.search]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", searchParams],
    queryFn: () => documentsApi.search(searchParams!),
    enabled: !!searchParams?.query,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = { query: query.trim() };
    setSearchParams(newParams);
    // Update URL with search parameters
    const urlParams = new URLSearchParams();
    urlParams.set("query", query.trim());
    navigate({ pathname: location.pathname, search: urlParams.toString() });
  };

  return (
    <div className="container max-w-3xl py-8 mx-auto">
      <div className="flex flex-col items-center mb-12">
        <h1 className="mb-3 text-4xl font-bold text-center">
          Document Search
        </h1>
        <p className="max-w-2xl text-center text-muted-foreground">
          Search across your entire document collection with advanced semantic searching
        </p>
      </div>
      <Card className="mb-8 border-0 bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1 group">
              <SearchIcon className="absolute w-5 h-5 transition-colors transform -translate-y-1/2 left-3 top-1/2 text-muted-foreground group-focus-within:text-primary" />
              <Input
                placeholder="Search documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 pl-10 transition-all focus-visible:ring-2 focus-visible:ring-primary"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="h-12 px-6 transition-all shadow-md"
            >
              <SearchIcon className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="space-y-8">
          {/* Skeleton for summary */}
          <Card className="mb-8 border-0 bg-card/50 backdrop-blur">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-40 h-6 rounded" />
              </div>
              <Skeleton className="w-3/4 h-5 mb-2" />
              <Skeleton className="w-2/3 h-4 mb-2" />
              <Skeleton className="w-1/2 h-4" />
            </CardContent>
          </Card>
          {/* Skeletons for results */}
          <div className="grid grid-cols-1 gap-8">
            {[...Array(3)].map((_, idx) => (
              <DocumentCardSkeleton key={idx} />
            ))}
          </div>
        </div>
      ) : (
        results && (
          <div className="transition-all">
            {/* Render summary */}
            {results.summary && (
              <Card className="mb-8 border-0 shadow-md bg-gradient-to-r from-primary/10 to-secondary/10">
                <CardContent className="flex items-start gap-4 pt-6">
                  <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-full bg-primary/20">
                    <SearchIcon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="mb-2 text-2xl font-semibold text-primary">Summary</h2>
                    <Markdown content={results.summary} className="prose prose-p:mb-2 prose-p:mt-0 prose-p:leading-snug" />
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Render sources */}
            {results.sources && results.sources.length > 0 ? (
              <div className="grid grid-cols-1 gap-8 animate-fadeIn">
                {results.sources.map((source) => (
                  <SourceCard key={source.id} source={source} />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center border-dashed">
                <div className="flex flex-col items-center">
                  <SearchIcon className="w-12 h-12 mb-4 text-muted-foreground" />
                  <h3 className="mb-2 text-xl font-medium">No results found</h3>
                  <p className="text-muted-foreground">
                    Try using different keywords or more general terms
                  </p>
                </div>
              </Card>
            )}
          </div>
        )
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(155, 155, 155, 0.5);
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
