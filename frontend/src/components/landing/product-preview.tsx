import { motion, useInView } from "framer-motion";
import {
  ArrowUp,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { Fragment, useRef } from "react";

import { CatMark } from "@/components/brand/cat-mark";
import { useTypewriter } from "@/hooks/use-typewriter";
import { cn } from "@/lib/utils";

// A static, faithful mock of the CATSight chat screen used as the landing hero.
// Content is illustrative; the layout mirrors the real app (sidebar, chat,
// sources panel with page numbers).

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: FileText, label: "Documents" },
  { icon: Tag, label: "Tags" },
  { icon: Search, label: "Search" },
  { icon: MessageSquare, label: "Chat", active: true },
];

const RECENT = ["Travel per diem", "Office lease renewal", "Board resolutions 2023"];

const QUESTION = "What per diem do we get for a day trip?";
const ANSWER =
  "Day trips are paid at the destination's per diem rate [1]. Claims go in with the approved travel order and original receipts within 30 days of return [2].";

const SOURCES = [
  {
    n: 1,
    title: "Travel Policy",
    page: 3,
    section: "Per diem allowances",
    before: "Day trips are paid the ",
    match: "per diem rate set for the destination",
    after: " in the annual schedule.",
    score: 0.88,
  },
  {
    n: 2,
    title: "Claims Procedure",
    page: 2,
    section: "Liquidation",
    before: "",
    match: "Claims go in with the approved travel order and original receipts",
    after: " within 30 days of return.",
    score: 0.79,
  },
];

/** Renders `[n]` markers in streamed text as citation chips. */
function WithCitations({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[\d\])/).map((part, i) =>
        /^\[\d\]$/.test(part) ? (
          <span
            key={i}
            className="mx-0.5 inline-grid h-4 min-w-4 place-items-center rounded bg-foreground/10 px-1 align-[1px] font-mono text-[10px] text-foreground/80"
          >
            {part.slice(1, -1)}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

export function ProductPreview({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const { output, done } = useTypewriter(ANSWER, { enabled: inView, startDelay: 700, speed: 60 });

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-left shadow-[0_0_0_1px_hsl(var(--foreground)/0.03),0_30px_80px_-20px_rgb(0_0_0/0.6)]",
        className
      )}
    >
      <div className="flex h-[30rem] sm:h-[34rem]">
        {/* sidebar */}
        <aside className="hidden w-52 shrink-0 flex-col gap-6 border-r bg-background/40 p-3 md:flex">
          <div className="flex items-center gap-2 px-2 pt-1">
            <CatMark className="size-5" sparkle={false} />
            <span className="text-sm font-medium">CATSight</span>
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ icon: Icon, label, active }) => (
              <span
                key={label}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px]",
                  active ? "bg-accent text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </span>
            ))}
          </nav>
          <div className="flex flex-col gap-0.5">
            <span className="px-2 pb-1 text-[11px] text-muted-foreground/70">Recent</span>
            {RECENT.map((title, i) => (
              <span
                key={title}
                className={cn(
                  "truncate rounded-md px-2 py-1.5 text-[13px]",
                  i === 0 ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {title}
              </span>
            ))}
          </div>
        </aside>

        {/* chat */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-11 shrink-0 items-center gap-3 border-b px-4">
            <span className="truncate text-[13px] font-medium">Travel per diem</span>
            <span className="ml-auto hidden rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              hybrid search · cited
            </span>
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-hidden px-4 py-6 sm:px-8">
            <p className="ml-auto max-w-md rounded-lg bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed">
              {QUESTION}
            </p>

            <div className="flex max-w-xl flex-col gap-3">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <CatMark className="size-4" sparkle={false} />
                CATSight
              </span>
              <p className="min-h-[4.5rem] text-[13px] leading-relaxed text-foreground/90">
                <WithCitations text={output} />
                {inView && !done && (
                  <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-caret bg-foreground" />
                )}
              </p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: done ? 1 : 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-wrap gap-1.5"
              >
                {SOURCES.map((s) => (
                  <span
                    key={s.n}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    <span className="font-mono text-foreground/80">{s.n}</span>
                    {s.title} · p. {s.page}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>

          <div className="shrink-0 p-3 sm:px-8 sm:pb-5">
            <div className="flex items-center gap-2 rounded-lg border bg-background/40 py-1.5 pl-2 pr-1.5">
              <span className="grid size-6 place-items-center rounded text-muted-foreground">
                <Plus className="size-3.5" />
              </span>
              <span className="flex-1 truncate text-[13px] text-muted-foreground">Ask a follow-up…</span>
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <ArrowUp className="size-3.5" />
              </span>
            </div>
          </div>
        </section>

        {/* sources panel */}
        <aside className="hidden w-72 shrink-0 flex-col border-l lg:flex">
          <header className="flex h-11 shrink-0 items-center justify-between border-b px-4">
            <span className="text-[13px] font-medium">Sources</span>
            <span className="font-mono text-[11px] text-muted-foreground">{SOURCES.length}</span>
          </header>
          <div className="flex flex-col gap-3 p-3">
            {SOURCES.map((s) => (
              <motion.article
                key={s.n}
                initial={{ opacity: 0, y: 6 }}
                animate={done ? { opacity: 1, y: 0 } : { opacity: 0.35, y: 0 }}
                transition={{ duration: 0.4, delay: done ? s.n * 0.1 : 0 }}
                className="flex flex-col gap-2 rounded-lg border bg-background/40 p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-px grid size-4 shrink-0 place-items-center rounded bg-foreground/10 font-mono text-[10px]">
                    {s.n}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-medium">{s.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      p. {s.page} · {s.section}
                    </span>
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {s.before}
                  <mark className="rounded-sm bg-gold/15 px-0.5 text-foreground">{s.match}</mark>
                  {s.after}
                </p>
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border">
                    <span className="block h-px bg-foreground/50" style={{ width: `${s.score * 100}%` }} />
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.score.toFixed(2)}</span>
                </div>
              </motion.article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
