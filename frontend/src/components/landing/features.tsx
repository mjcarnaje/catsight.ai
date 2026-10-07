import { Check, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

function FeatureRow({
  label,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  label: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <Reveal className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
      <div className={cn("flex flex-col gap-5", flip && "lg:order-2")}>
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <h3 className="text-balance text-3xl font-medium tracking-[-0.03em] sm:text-4xl">{title}</h3>
        <p className="max-w-md leading-relaxed text-muted-foreground">{body}</p>
        <ul className="flex flex-col gap-2.5 pt-2 text-sm">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(flip && "lg:order-1")}>{visual}</div>
    </Reveal>
  );
}

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card p-5 sm:p-6", className)}>{children}</div>;
}

/* A page of a source document with the cited passage highlighted. */
function SourcePageVisual() {
  return (
    <Frame className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="text-foreground">Scholarship Guidelines.pdf</span>
        <span className="font-mono">p. 3 / 12</span>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border bg-background/50 p-5 text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">IV. Renewal of grants</span>
        <p>
          Section 1. Grants are reviewed at the end of each semester using the grades certified by the
          Office of the Registrar.
        </p>
        <p>
          Section 2. Grantees who wish to continue must{" "}
          <mark className="rounded-sm bg-gold/15 px-0.5 text-foreground ring-1 ring-gold/30">
            maintain the required GWA and enroll in a regular load
          </mark>{" "}
          for every semester covered by the grant.
        </p>
        <p className="opacity-50">Section 3. Requests for reconsideration are filed with the committee…</p>
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">Cited as [1] in your answer</span>
    </Frame>
  );
}

/* Meaning-based search results. */
function SearchVisual() {
  const results = [
    { title: "Guidelines on Official Travel", snippet: "…liquidation of travel expenses must be filed within…", score: 0.91 },
    { title: "Memo: Reimbursement Forms", snippet: "…attach original receipts and the approved travel order…", score: 0.84 },
    { title: "Accounting Office FAQ", snippet: "…cash advances for trips are settled after return…", score: 0.72 },
  ];
  return (
    <Frame className="flex flex-col gap-1">
      <div className="mb-3 flex items-center gap-2.5 rounded-lg border bg-background/50 px-3 py-2.5 text-[13px]">
        <Search className="size-4 text-muted-foreground" />
        how do I get paid back for a work trip
      </div>
      {results.map((r) => (
        <div key={r.title} className="flex items-start gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[13px] font-medium">{r.title}</span>
            <span className="truncate text-xs text-muted-foreground">{r.snippet}</span>
          </div>
          <span className="pt-0.5 font-mono text-[11px] text-muted-foreground">{r.score.toFixed(2)}</span>
        </div>
      ))}
    </Frame>
  );
}

/* A processed document card: summary, year, tags and pipeline status. */
function CatalogVisual() {
  const stages = ["Extract", "Summarize", "Embed", "Ready"];
  return (
    <Frame className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium">Library Services Advisory</span>
          <span className="text-xs text-muted-foreground">Uploaded scan · 4 pages</span>
        </div>
        <span className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">2024</span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Announces extended library hours during the examination period and new rules for reserving
        discussion rooms online.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {["library", "advisory", "students"].map((t) => (
          <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 border-t pt-4">
        {stages.map((s) => (
          <div key={s} className="flex flex-col gap-1.5">
            <span className="h-1 rounded-full bg-foreground/60" />
            <span className="text-[11px] text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 px-4 pb-24 sm:px-6 sm:pb-36">
      <div className="mx-auto flex max-w-6xl flex-col gap-28 sm:gap-36">
        <FeatureRow
          label="Cited answers"
          title="Every answer shows its work."
          body="Answers stream in word by word with numbered markers. Each one opens the exact page it came from, so you can read it in context before you act on it."
          points={["Document and page on every claim", "Passages chosen for relevance, not repetition", "Chat history saved across sessions"]}
          visual={<SourcePageVisual />}
        />
        <FeatureRow
          flip
          label="Semantic search"
          title="Find the memo without remembering its title."
          body="Search understands what you mean, not just the words you typed — and it works the same in English, Filipino and Cebuano."
          points={["Multilingual bge-m3 embeddings", "Filter by year and tags", "Jump straight to the matching passage"]}
          visual={<SearchVisual />}
        />
        <FeatureRow
          label="Automatic cataloguing"
          title="Every upload is read, dated and filed."
          body="OCR turns scans and image-only PDFs into clean text. CATSight then writes a summary and picks a title, year and tags — no manual data entry."
          points={["OCR for scanned and photocopied pages", "Summaries, titles, years and tags generated", "Live status while files are processed"]}
          visual={<CatalogVisual />}
        />
      </div>
    </section>
  );
}
