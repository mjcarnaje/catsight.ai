import { Reveal } from "./reveal";

const FACTS = [
  { label: "Models", value: "Qwen 3 · bge-m3" },
  { label: "Runtime", value: "Ollama, self-hosted" },
  { label: "Storage", value: "PostgreSQL + pgvector" },
];

export function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-20 px-4 sm:px-6">
      <Reveal className="mx-auto grid max-w-6xl gap-10 rounded-xl border bg-card p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex max-w-xl flex-col gap-4">
          <span className="font-mono text-xs text-muted-foreground">Privacy</span>
          <h3 className="text-3xl font-medium tracking-[-0.03em]">Your documents never leave your servers.</h3>
          <p className="leading-relaxed text-muted-foreground">
            CATSight runs open models on your own hardware. Files, embeddings and chat history stay in your
            database — nothing is sent to an outside AI provider.
          </p>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-1 lg:text-right">
          {FACTS.map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5">
              <dt className="font-mono text-xs text-muted-foreground">{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}
