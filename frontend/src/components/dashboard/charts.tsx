import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatisticsResponse } from "@/types";

const documentsConfig = {
  count: { label: "Documents", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
} as const;

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function GrowthChart({ statistics, isLoading }: { statistics?: StatisticsResponse; isLoading: boolean }) {
  const data = statistics?.documents_timeline ?? [];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Library growth</CardTitle>
        <CardDescription>Documents added per month</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        {isLoading ? (
          <Skeleton className="size-full" />
        ) : data.length === 0 ? (
          <ChartEmpty message="No uploads yet" />
        ) : (
          <ChartContainer config={documentsConfig} className="size-full">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" {...axisProps} tickMargin={8} minTickGap={24} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={1.5}
                fill="url(#growthFill)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function YearsChart({ statistics, isLoading }: { statistics?: StatisticsResponse; isLoading: boolean }) {
  const data = statistics?.years_distribution ?? [];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">By issuance year</CardTitle>
        <CardDescription>Year detected in each document</CardDescription>
      </CardHeader>
      <CardContent className="h-[220px]">
        {isLoading ? (
          <Skeleton className="size-full" />
        ) : data.length === 0 ? (
          <ChartEmpty message="No years detected yet" />
        ) : (
          <ChartContainer config={documentsConfig} className="size-full">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="year" {...axisProps} tickMargin={8} minTickGap={8} />
              <YAxis {...axisProps} allowDecimals={false} width={40} />
              <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent hideIndicator />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
