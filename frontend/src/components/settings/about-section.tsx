import type { ReactNode } from "react";

import { SettingsSection } from "@/components/settings/section";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { extractorLabel } from "@/components/documents/extractors";
import { modelName } from "@/lib/format";
import { useConfig } from "@/lib/queries";
import type { Provider } from "@/types";

const PROVIDER_LABELS: Record<Provider, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  ollama: "Ollama (local)",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:w-28">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function Model({ id }: { id: string }) {
  return (
    <span title={id}>
      {modelName(id)}
      <span className="block break-all font-mono text-xs text-muted-foreground sm:ml-2 sm:inline">{id}</span>
    </span>
  );
}

/** What this deployment runs on: provider, models and whether demo limits apply. Visible to everyone. */
export function AboutSection() {
  const { data: config, isPending, isError, error } = useConfig();

  return (
    <SettingsSection
      id="settings-about"
      label="About this deployment"
      description="The models behind answers, scanning and search."
    >
      {isPending ? (
        <div className="flex flex-col gap-4 p-5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full max-w-sm" />
          ))}
        </div>
      ) : isError ? (
        <p role="alert" className="p-5 text-sm text-muted-foreground">
          {errorMessage(error, "Couldn't load the deployment details.")}
        </p>
      ) : (
        <dl className="divide-y">
          {/* No working provider means no models (the API sends null): say so instead of listing them */}
          <Row label="Provider">
            {config.provider ? PROVIDER_LABELS[config.provider] : <span className="text-muted-foreground">No AI provider yet</span>}
          </Row>
          {config.models && (
            <Row label="Answers">
              <Model id={config.models.chat} />
            </Row>
          )}
          <Row label="OCR">
            {config.extraction.default === "marker" ? (
              <span>
                Marker 2 <span className="text-muted-foreground">with Surya OCR 2</span>
              </span>
            ) : config.extraction.default === "vision" && config.models ? (
              <Model id={config.models.ocr} />
            ) : config.extraction.default ? (
              extractorLabel(config.extraction.default)
            ) : (
              <span className="text-muted-foreground">None available</span>
            )}
          </Row>
          {config.models && config.extraction.default === "marker" && config.extraction.marker_llm && (
            <Row label="OCR LLM mode">
              <Model id={config.models.ocr} />
            </Row>
          )}
          {config.models && (
            <Row label="Embeddings">
              <Model id={config.models.embedding} />
            </Row>
          )}
          {config.models && (
            <Row label="Reranker">
              {config.models.reranker ? <Model id={config.models.reranker} /> : <span className="text-muted-foreground">Off</span>}
            </Row>
          )}
          <Row label="Demo mode">
            {config.demo_mode ? "On" : <span className="text-muted-foreground">Off</span>}
          </Row>
          {!config.usage?.limited && (
            <Row label="Upload limit">
              <span className="font-mono text-[13px]">{config.limits.max_file_mb} MB</span>
              <span className="text-muted-foreground"> and </span>
              <span className="font-mono text-[13px]">{config.limits.max_pages_per_file} pages</span>
              <span className="text-muted-foreground"> per file</span>
            </Row>
          )}
        </dl>
      )}
    </SettingsSection>
  );
}
