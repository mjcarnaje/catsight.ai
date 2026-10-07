import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dashboard } from "@/types";

const config = { count: { label: "Documents", color: "hsl(var(--chart-1))" } } satisfies ChartConfig;
const axis = { tickLine: false, axisLine: false, tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } } as const;

/** Documents per issuance year, with empty years filled in so gaps are visible. */
export function CoverageChart({ data, isLoading }: { data?: Dashboard; isLoading: boolean }) {
  const byYear = data?.by_year ?? [];
  const series = byYear.length
    ? Array.from({ length: byYear[byYear.length - 1].year - byYear[0].year + 1 }, (_, i) => {
        const year = byYear[0].year + i;
        return { year, count: byYear.find((row) => row.year === year)?.count ?? 0 };
      })
    : [];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Coverage by year</CardTitle>
        <CardDescription>Issuance year the cataloguer found in each document</CardDescription>
      </CardHeader>
      <CardContent className="h-[220px]">
        {isLoading ? (
          <Skeleton className="size-full" />
        ) : series.length === 0 ? (
          <div className="grid size-full place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No dated documents yet
          </div>
        ) : (
          <ChartContainer config={config} className="size-full">
            <BarChart data={series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="year" {...axis} tickMargin={8} minTickGap={12} />
              <YAxis {...axis} allowDecimals={false} width={40} />
              <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent hideIndicator />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
