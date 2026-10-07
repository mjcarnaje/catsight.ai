import { Link } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dashboard } from "@/types";

/** The library by topic and type, from the tags the cataloguer assigned. */
export function CollectionsCard({ data, isLoading }: { data?: Dashboard; isLoading: boolean }) {
  const tags = data?.by_tag ?? [];
  const max = Math.max(1, ...tags.map((t) => t.count));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-medium">Collections</CardTitle>
        <CardDescription>Tagged automatically when each document is catalogued</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Collections appear once documents are catalogued.</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  to={`/documents?tags=${tag.id}`}
                  className="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <span className="w-28 shrink-0 truncate text-muted-foreground group-hover:text-foreground">{tag.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-foreground/60 transition-colors group-hover:bg-foreground"
                      style={{ width: `${(tag.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{tag.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
