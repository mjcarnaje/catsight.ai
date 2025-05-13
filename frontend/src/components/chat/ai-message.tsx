import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { Message } from "@/types/message";
import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { SourcesButton } from "./sources-button";
import React from "react";

interface AIMessageProps {
  msg: Message;
  isCopied: boolean;
  sources: any[];
  onCopy: (text: string, id: string) => void;
  onRegenerate?: (id: string) => void;
  thinkingVisibility?: boolean;
  toggleThinking: (id: string) => void;
}

function extractThinking(content: string) {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/;
  const match = content.match(thinkRegex);

  if (match && match[1]) {
    const cleanContent = content.replace(thinkRegex, '').trim();
    return {
      hasThinking: true,
      content: cleanContent || "",
      thinking: match[1].trim()
    };
  }

  return {
    hasThinking: false,
    content,
    thinking: ""
  };
}

export const AIMessage: React.FC<AIMessageProps> = ({
  msg,
  isCopied,
  sources,
  onCopy,
  onRegenerate,
  thinkingVisibility,
  toggleThinking
}) => {
  const processedContent = msg.content
    ? extractThinking(msg.content)
    : { hasThinking: false, content: msg.content || "", thinking: "" };

  const showThinking = thinkingVisibility && processedContent.hasThinking;

  return (
    <div className={cn("flex", "justify-start")}>
      <div className={cn(
        "max-w-sm sm:max-w-md md:max-w-lg relative group text-gray-800"
      )}>
        <div className="pl-1">
          <Markdown content={processedContent.content || "..."} />

          {processedContent.hasThinking && (
            <div className="mt-3">
              <button
                onClick={() => toggleThinking(msg.id)}
                className="flex items-center gap-1 px-2 py-1 mb-2 text-xs text-gray-700 bg-gray-100 rounded-md"
              >
                {showThinking ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    <span>Hide Thinking</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>Show Thinking</span>
                  </>
                )}
              </button>

              {showThinking && (
                <div className="p-3 mt-2 text-sm border border-gray-200 rounded-md bg-gray-50">
                  <h4 className="mb-1 text-xs font-medium text-gray-500">AI Thinking Process:</h4>
                  <Markdown content={processedContent.thinking} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          {sources && sources.length > 0 && (
            <SourcesButton sources={sources} />
          )}

          <button
            onClick={() => onCopy(msg.content || "", msg.id)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700"
            )}
            title="Copy to clipboard"
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          {onRegenerate && (
            <button
              onClick={() => onRegenerate(msg.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 bg-gray-100 rounded-md"
              title="Regenerate response"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 