import type { ReactNode } from "react";

/** A settings block: a mono label and a short note on the left, the controls in a card on the right. */
export function SettingsSection({
  id,
  label,
  description,
  children,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4 py-8 first:pt-0 last:pb-0 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </h2>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 rounded-lg border bg-card">{children}</div>
    </section>
  );
}
