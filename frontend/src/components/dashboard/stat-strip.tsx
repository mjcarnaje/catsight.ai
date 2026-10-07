import { NumberTicker } from "@/components/magic/number-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatisticsResponse } from "@/types";

interface Stat {
  label: string;
  value: number;
  decimals?: number;
  hint: string;
}

export function StatStrip({ statistics, isLoading }: { statistics?: StatisticsResponse; isLoading: boolean }) {
  const stats: Stat[] = [
    { label: "Documents", value: statistics?.documents_count ?? 0, hint: "In the library" },
    { label: "Conversations", value: statistics?.chats_count ?? 0, hint: "Chat sessions" },
    { label: "Members", value: statistics?.users_count ?? 0, hint: "Registered users" },
    {
      label: "Avg. pages",
      value: statistics?.avg_page_count ?? 0,
      decimals: 1,
      hint: `${Math.round(statistics?.avg_chunks ?? 0)} chunks per document`,
    },
  ];

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={[
            "flex flex-col gap-1 p-5",
            i % 2 === 1 ? "border-l" : "",
            i >= 2 ? "border-t lg:border-t-0" : "",
            i === 2 ? "lg:border-l" : "",
          ].join(" ")}
        >
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="text-2xl font-semibold tracking-tight">
            {isLoading ? (
              <Skeleton className="my-1 h-6 w-16" />
            ) : (
              <NumberTicker value={stat.value} decimalPlaces={stat.decimals ?? 0} />
            )}
          </dd>
          <dd className="truncate text-xs text-muted-foreground">{stat.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
