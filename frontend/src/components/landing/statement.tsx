import { Reveal } from "./reveal";

const STEPS = [
  {
    title: "Upload",
    body: "Drop in PDFs, scanned memos and forms — including ones that were never searchable.",
  },
  {
    title: "CATSight reads it",
    body: "OCR extracts the text, splits it at section headings, and writes a summary, title, year and tags for each file.",
  },
  {
    title: "Ask",
    body: "Chat or search in your own words. Answers stream in with the document and page they came from.",
  },
];

export function Statement() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-36">
      <div className="mx-auto flex max-w-6xl flex-col gap-20">
        <Reveal>
          <p className="max-w-4xl text-pretty text-[1.75rem] font-medium leading-[1.2] tracking-[-0.03em] sm:text-[2.5rem]">
            Built for the paperwork an organization runs on.{" "}
            <span className="text-muted-foreground">
              Memos, handbooks, guidelines and scanned forms become a knowledge base anyone in the organization can
              question — and check.
            </span>
          </p>
        </Reveal>

        <Reveal>
          <ol className="grid divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3 py-8 sm:px-8 sm:first:pl-0 sm:last:pr-0">
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
