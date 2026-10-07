import { SettingsSection } from "@/components/settings/section";
import { timeAgo } from "@/lib/format";
import { useConfig } from "@/lib/queries";
import { cn } from "@/lib/utils";

function resetsText(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).getTime() <= Date.now() ? "Resets any moment now" : `Resets ${timeAgo(iso)}`;
}

function Meter({
  label,
  used,
  limit,
  unit,
  note,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  note?: string | null;
}) {
  const full = used >= limit;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className={cn("font-mono text-xs tabular-nums", full ? "text-destructive" : "text-muted-foreground")}>
          {used.toLocaleString()} / {limit.toLocaleString()}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-[width]", full ? "bg-destructive" : "bg-foreground/70")}
          style={{ width: `${Math.min(used / limit, 1) * 100}%` }}
        />
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Today's demo allowance. Only rendered for visitors who actually have limits. */
export function UsageSection() {
  const { data: config } = useConfig();
  const usage = config?.usage;
  if (!config || !usage?.limited) return null;

  const { limits } = config;
  return (
    <SettingsSection
      id="settings-usage"
      label="Usage"
      description="The demo limits what each visitor can ask and upload over a rolling 24 hours."
    >
      <div className="flex flex-col gap-5 p-5">
        {usage.messages.limit > 0 && (
          <Meter
            label="Questions"
            used={usage.messages.used}
            limit={usage.messages.limit}
            note={usage.messages.used > 0 ? resetsText(usage.messages.resets_at) : null}
          />
        )}
        {config.uploads_enabled && usage.uploads.limit > 0 && (
          <Meter
            label="Uploads and re-runs"
            used={usage.uploads.used}
            limit={usage.uploads.limit}
            note={usage.uploads.used > 0 ? resetsText(usage.uploads.resets_at) : null}
          />
        )}
        {config.uploads_enabled && usage.library_pages.limit > 0 && (
          <Meter
            label="Library page budget"
            used={usage.library_pages.used}
            limit={usage.library_pages.limit}
            unit="pages"
            note="Shared by everyone using the demo. When it runs out, new uploads pause."
          />
        )}
        <p className="border-t pt-4 text-xs text-muted-foreground">
          Each file can be up to <span className="font-mono">{limits.max_file_mb} MB</span> and{" "}
          <span className="font-mono">{limits.max_pages_per_file} pages</span>.
        </p>
      </div>
    </SettingsSection>
  );
}
