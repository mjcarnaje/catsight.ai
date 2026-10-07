import { useSidebar } from "@/components/ui/sidebar";
import { useConfig, useUploadsEnabled } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { UsageCounter } from "@/types";

/** Today's demo allowance, shown only to visitors who have limits. */
export function UsageMeter() {
  const { data: config } = useConfig();
  const { state } = useSidebar();
  const canUpload = useUploadsEnabled();
  const usage = config?.usage;
  if (!usage?.limited || state === "collapsed") return null;

  return (
    <div className="mx-2 mb-1 flex flex-col gap-2.5 rounded-lg border bg-sidebar-accent/40 p-3 [@media(max-height:640px)]:hidden">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Today's demo allowance</p>
      <Meter label="Questions" counter={usage.messages} />
      {canUpload && <Meter label="Uploads" counter={usage.uploads} />}
    </div>
  );
}

function Meter({ label, counter }: { label: string; counter: UsageCounter }) {
  if (!counter.limit) return null;
  const left = Math.max(counter.limit - counter.used, 0);
  const ratio = Math.min(counter.used / counter.limit, 1);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("tabular-nums", left === 0 && "text-destructive")}>
          {left} of {counter.limit} left
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", left === 0 ? "bg-destructive" : "bg-foreground/70")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
