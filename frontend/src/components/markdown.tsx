import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <ReactMarkdown
      className={cn("prose dark:prose-invert !max-w-none", className)}
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </ReactMarkdown>
  );
}
