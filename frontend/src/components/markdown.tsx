import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const CITATION = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\()/g;

/** "[1]" / "[1, 3]" -> links the renderer turns into citation chips. */
function linkCitations(text: string) {
  return text.replace(CITATION, (_, numbers: string) =>
    numbers
      .split(",")
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join("")
  );
}

export function Markdown({
  content,
  className,
  renderCitation,
}: {
  content: string;
  className?: string;
  /** When given, [n] markers render through it (e.g. as source chips). */
  renderCitation?: (n: number) => ReactNode;
}) {
  const components: Components = {
    a: ({ href, children, ...props }) => {
      if (renderCitation && href?.startsWith("#cite-")) return <>{renderCitation(Number(href.slice(6)))}</>;
      const external = href?.startsWith("http");
      return (
        <a href={href} {...props} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
          {children}
        </a>
      );
    },
  };

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-semibold prose-headings:tracking-tight prose-a:underline-offset-4 prose-pre:bg-muted prose-pre:text-foreground prose-li:my-0.5",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {renderCitation ? linkCitations(content) : content}
      </ReactMarkdown>
    </div>
  );
}
