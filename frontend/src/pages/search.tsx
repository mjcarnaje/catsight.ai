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
import { documentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
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
                disabled={!query.trim()}
              >
                <SearchIcon className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Switch
                id="accurate-mode"
                checked={isAccurate}
                onCheckedChange={setIsAccurate}
              />
              <label htmlFor="accurate-mode" className="cursor-pointer select-none">
                Use accurate mode{" "}
                <span className="text-xs">
                  (may take longer but provides more precise results)
                </span>
              </label>
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
                    Try using different keywords or more general terms
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
