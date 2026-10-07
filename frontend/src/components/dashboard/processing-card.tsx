import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { countByStage } from "@/lib/document-stages";
import type { StatisticsResponse } from "@/types";

/** Where every document is in the processing pipeline. */
export function ProcessingCard({ statistics, isLoading }: { statistics?: StatisticsResponse; isLoading: boolean }) {
  const stages = countByStage(statistics?.documents_by_status);
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const ready = stages.find((s) => s.key === "ready")?.count ?? 0;
  const inProgress = total - ready;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-medium">Processing</CardTitle>
        <CardDescription>
          {isLoading
            ? "Loading…"
            : inProgress > 0
              ? `${inProgress} document${inProgress === 1 ? "" : "s"} still being read`
              : "Everything is indexed and searchable"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        {isLoading ? (
          <Skeleton className="h-2 w-full" />
        ) : (
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Documents by processing stage">
            {stages
              .filter((s) => s.count > 0)
              .map((s) => (
                <span key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} />
              ))}
          </div>
        )}
        <ul className="flex flex-col gap-2.5 text-sm">
          {stages.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">{isLoading ? "–" : s.count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
