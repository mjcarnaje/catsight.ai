import { NumberTicker } from "@/components/magic/number-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dashboard } from "@/types";

export function LibraryStats({ data, isLoading }: { data?: Dashboard; isLoading: boolean }) {
  const library = data?.library;
  const stats = [
    {
      label: "Documents",
      value: library?.ready ?? 0,
      hint: library && library.documents > library.ready ? `${library.documents - library.ready} still processing` : "Searchable now",
    },
    { label: "Pages read", value: library?.pages ?? 0, hint: "OCR'd page by page" },
    { label: "Passages indexed", value: library?.passages ?? 0, hint: "Semantic + keyword search" },
    {
      label: "Years covered",
      text: library?.years ? (library.years[0] === library.years[1] ? `${library.years[0]}` : `${library.years[0]}–${library.years[1]}`) : "—",
      hint: library?.tags ? `${library.tags} topics` : "By issuance date",
    },
  ];

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
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
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums tracking-tight">
            {isLoading ? (
              <Skeleton className="my-1 h-6 w-16" />
            ) : "text" in stat ? (
              stat.text
            ) : (
              <NumberTicker value={stat.value ?? 0} />
            )}
          </dd>
          <dd className="truncate text-xs text-muted-foreground">{isLoading ? " " : stat.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
