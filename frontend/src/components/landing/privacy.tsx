import { modelName } from "@/lib/format";
import { useConfig } from "@/lib/queries";
import { Reveal } from "./reveal";

/** How the deployment handles documents, stated plainly for whichever provider it runs on. */
export function Privacy() {
  const { data: config } = useConfig();
  const local = config?.provider === "ollama";
  const facts = [
    {
      label: "Models",
      // Anonymous visitors get no models from the API: show a dash, not a crash
      value: config?.models ? `${modelName(config.models.chat)} · ${modelName(config.models.embedding)}` : "—",
    },
    { label: "Runtime", value: local ? "Ollama, on this server" : "OpenRouter, OpenAI or Ollama when self-hosted" },
    { label: "Storage", value: "PostgreSQL + pgvector" },
  ];

  return (
    <section id="privacy" className="scroll-mt-20 px-4 sm:px-6">
      <Reveal className="mx-auto grid max-w-6xl gap-10 rounded-xl border bg-card p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex max-w-xl flex-col gap-4">
          <span className="font-mono text-xs text-muted-foreground">Privacy</span>
          {local ? (
            <>
              <h3 className="text-3xl font-medium tracking-[-0.03em]">Your documents never leave this server.</h3>
              <p className="leading-relaxed text-muted-foreground">
                This deployment runs open models on its own hardware. Files, embeddings and chat history stay in its
                database; nothing is sent to an outside AI provider.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-3xl font-medium tracking-[-0.03em]">A public demo you can also run entirely on your own hardware.</h3>
              <p className="leading-relaxed text-muted-foreground">
                This demo reads pages and writes answers through a hosted AI provider.{" "}
                {config?.uploads_enabled
                  ? "Don't upload anything sensitive: guest uploads stay private to your session and are deleted with it."
                  : "Its library is a fixed set of sample documents, and guest chats are deleted after a day."}{" "}
                Self-host CATSight and let your organization use the server's own Ollama models; then files never leave
                your servers.
              </p>
            </>
          )}
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-1 lg:text-right">
          {facts.map((f) => (
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
