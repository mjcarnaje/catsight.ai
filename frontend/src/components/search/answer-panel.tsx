import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, Loader2, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { citedNumbers } from "@/components/chat/sources-row";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, searchApi } from "@/lib/api";
import { modelName } from "@/lib/format";
import { keys, useConfig } from "@/lib/queries";
import type { SearchAnswer } from "@/types";

type Citation = SearchAnswer["citations"][number];

const citationPath = (citation: Citation) =>
  `/documents/${citation.document_id}${citation.page !== null ? `?page=${citation.page}` : ""}`;

const citationLabel = (citation: Citation) =>
  `${citation.title}${citation.page !== null ? `, page ${citation.page}` : ""}`;

function CitationChip({ citation }: { citation: Citation }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={citationPath(citation)}
          aria-label={`Source ${citation.n}: ${citationLabel(citation)}`}
          className="not-prose ml-0.5 inline-flex h-4 min-w-4 -translate-y-0.5 items-center justify-center rounded-sm border bg-muted px-1 font-mono text-[10px] leading-none text-muted-foreground no-underline outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          {citation.n}
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{citationLabel(citation)}</TooltipContent>
    </Tooltip>
  );
}

function AnswerBody({ answer }: { answer: SearchAnswer }) {
  const byNumber = useMemo(() => new Map(answer.citations.map((citation) => [citation.n, citation])), [answer.citations]);
  const cited = useMemo(() => {
    const used = citedNumbers(answer.answer);
    return answer.citations.filter((citation) => used.has(citation.n));
  }, [answer]);

  return (
    <div className="flex flex-col gap-4">
      <Markdown
        content={answer.answer}
        renderCitation={(n) => {
          const citation = byNumber.get(n);
          return citation ? <CitationChip citation={citation} /> : <>[{n}]</>;
        }}
      />
      {cited.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sources</h3>
          <ol className="flex flex-col gap-1">
            {cited.map((citation) => (
              <li key={citation.n}>
                <Link
                  to={citationPath(citation)}
                  className="group flex min-w-0 items-baseline gap-2 rounded-sm text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <span className="shrink-0 font-mono text-[10px]">[{citation.n}]</span>
                  <span className="truncate group-hover:underline">{citation.title}</span>
                  {citation.page !== null && <span className="shrink-0 font-mono text-[10px]">p. {citation.page}</span>}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * A short cited answer above the results. It is its own request because it costs one of the
 * visitor's daily questions: it never retries or refetches on its own, and the cached answer
 * is reused when the same search is opened again.
 */
export function AnswerPanel({
  q,
  filters,
  onContinue,
}: {
  q: string;
  filters: { year: number[]; tags: number[] };
  onContinue: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();

  const answer = useQuery({
    queryKey: [...keys.search(q, filters), "answer"] as const,
    queryFn: async () => {
      try {
        return await searchApi.answer(q, filters);
      } finally {
        // The sidebar's allowance meter should show the question that was just used
        void queryClient.invalidateQueries({ queryKey: keys.config });
      }
    },
    retry: false,
    retryOnMount: false,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const overQuota = axios.isAxiosError(answer.error) && answer.error.response?.status === 429;

  return (
    <section aria-labelledby="answer-heading" aria-busy={answer.isFetching} className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 id="answer-heading" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Answer
        </h2>
        {config?.models?.chat && (
          <span className="truncate font-mono text-[10px] text-muted-foreground/80">{modelName(config.models.chat)}</span>
        )}
      </div>

      <div className="px-4 py-4" aria-live="polite">
        {answer.isPending ? (
          <div className="flex flex-col gap-2.5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Reading the top passages...
            </p>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : answer.isError ? (
          <div className="flex items-start gap-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="break-words">{errorMessage(answer.error)}</p>
              <p className="text-xs text-muted-foreground">The search results below are not affected.</p>
              {!overQuota && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-fit"
                  disabled={answer.isFetching}
                  onClick={() => void answer.refetch()}
                >
                  Try again
                </Button>
              )}
            </div>
          </div>
        ) : answer.data.answer ? (
          <AnswerBody answer={answer.data} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No answer could be written from these passages. The results below may still help.
          </p>
        )}
      </div>

      {answer.isSuccess && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-2.5">
          <p className="text-xs text-muted-foreground">AI-written. Check the cited pages.</p>
          <Button type="button" variant="outline" size="sm" onClick={onContinue}>
            <MessageSquare />
            Continue in chat
          </Button>
        </div>
      )}
    </section>
  );
}
