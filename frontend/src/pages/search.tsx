import {
  SearchDocumentCard,
  SearchDocumentCardSkeleton,
} from "@/components/search-document-card";
import {
  SearchSummary,
  SearchSummarySkeleton,
} from "@/components/search-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { documentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isAccurate, setIsAccurate] = useState(false);
  const [searchParams, setSearchParams] = useState<{ query: string; accurate?: boolean } | null>(
    null
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get("query");
    const accurateParam = params.get("accurate") === "true";
    if (queryParam) {
      setQuery(queryParam);
      setIsAccurate(accurateParam);
      setSearchParams({ query: queryParam, accurate: accurateParam });
    }
  }, [location.search]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", searchParams],
    queryFn: () => documentsApi.search(searchParams!),
    enabled: !!searchParams?.query,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const newParams = { query: trimmedQuery, accurate: isAccurate };
    setSearchParams(newParams);
    // Update URL with search parameters
    const urlParams = new URLSearchParams();
    urlParams.set("query", trimmedQuery);
    urlParams.set("accurate", String(isAccurate));
    navigate({ pathname: location.pathname, search: urlParams.toString() });
  };

  return (
    <div className="container max-w-4xl py-8 mx-auto">
      <Card
        className={cn(
          "mb-8 border-0 shadow-md bg-white",
          "transition-all duration-300 hover:shadow-lg"
        )}
      >
        <CardContent className="pt-6">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1 group">
                <SearchIcon className="absolute w-5 h-5 transition-colors transform -translate-y-1/2 left-3 top-1/2 text-muted-foreground group-focus-within:text-primary" />
                <Input
                  placeholder={isAccurate ? "Ask any question about your documents..." : "Search for documents by title or summary..."}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn(
                    "h-12 pl-10 transition-all focus-visible:ring-2",
                    isAccurate ? "focus-visible:ring-primary border-primary/20" : "focus-visible:ring-primary"
                  )}
                  autoFocus
                />
                {isAccurate && (
                  <Badge variant="secondary" className="absolute flex items-center gap-1 px-2 -translate-y-1/2 text-primary bg-primary/10 right-3 top-1/2">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-xs">AI</span>
                  </Badge>
                )}
              </div>
              <Button
                type="submit"
                className={cn(
                  "h-12 px-6 transition-all shadow-md",
                )}
                disabled={!query.trim()}
              >
                <SearchIcon className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            <div className="flex items-center p-2 space-x-3 transition-colors rounded-md hover:bg-slate-50">
              <Switch
                id="accurate-mode"
                checked={isAccurate}
                onCheckedChange={setIsAccurate}
                className={isAccurate ? "data-[state=checked]:bg-primary" : ""}
              />
              <div className="flex-1 cursor-pointer select-none" onClick={() => setIsAccurate(!isAccurate)}>
                <div className="flex items-center gap-2">
                  <label htmlFor="accurate-mode" className="font-medium">
                    {isAccurate ? "AI-powered search enabled" : "AI-powered search"}
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>AI-powered search understands your questions and searches through the full text of all your documents. Standard search just looks for matches in titles and summaries.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Searches the full text of all documents and can answer specific questions. May take a few seconds longer.
                </p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-8">
          <SearchSummarySkeleton />
          <div className="grid grid-cols-1 gap-8">
            {[...Array(3)].map((_, idx) => (
              <SearchDocumentCardSkeleton key={idx} />
            ))}
          </div>
        </div>
      ) : (
        results && (
          <div className="space-y-8 transition-all">
            {results.summary && <SearchSummary summary={results.summary} />}

            {results.sources && results.sources.length > 0 ? (
              <div className="grid grid-cols-1 gap-8 animate-fadeIn">
                {results.sources.map((source) => (
                  <SearchDocumentCard key={source.id} source={source} />
                ))}
              </div>
            ) : searchParams?.query ? (
              <Card className="p-8 text-center border-dashed">
                <div className="flex flex-col items-center">
                  <SearchIcon className="w-12 h-12 mb-4 text-muted-foreground" />
                  <h3 className="mb-2 text-xl font-medium">No results found</h3>
                  <p className="text-muted-foreground">
                    Try using different keywords or {!isAccurate && (
                      <span>enable <span className="font-medium underline cursor-pointer decoration-dotted"
                        onClick={() => {
                          setIsAccurate(true);
                          if (query.trim()) {
                            handleSearch(new Event('submit') as any);
                          }
                        }}>
                        AI-powered search
                      </span> to search within document content</span>
                    )}
                  </p>
                </div>
              </Card>
            ) : null}
          </div>
        )
      )}
    </div>
  );
}
