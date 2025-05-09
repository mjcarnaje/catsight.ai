// components/ChatList.tsx
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Message } from "./chat-reducer";
import { Loader2, Copy, Check, RefreshCw } from "lucide-react";
import { SourcesButton } from "./sources-button";
import { Markdown } from "@/components/markdown";

interface ChatListProps {
  messages: Message[];
  isStreaming?: boolean;
  onRegenerateMessage?: (messageId: string) => void;
}

export function ChatList({
  messages,
  isStreaming = false,
  onRegenerateMessage
}: ChatListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
        }).catch(err => {
          console.error("Failed to copy text: ", err);
          // Use fallback method if clipboard API fails
          fallbackCopyToClipboard(text, id);
        });
      } else {
        // Fallback for browsers that don't support clipboard API
        fallbackCopyToClipboard(text, id);
      }
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  // Fallback method using textarea element
  const fallbackCopyToClipboard = (text: string, id: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Make the textarea out of viewport
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (err) {
      console.error("Fallback copy method failed:", err);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 p-4">
        <p className="text-gray-500">Send a message to start the conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-4xl p-4 pb-20 mx-auto space-y-6">
      {messages.map((msg) => {
        const isAssistant = msg.role === "assistant";
        const isCopied = copiedId === msg.id;
        const hasSources = msg.sources && msg.sources.length > 0;

        return (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-sm sm:max-w-md md:max-w-lg relative group",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground py-2 px-4 rounded-xl rounded-tr-sm"
                  : "text-gray-800"
              )}
            >
              {isAssistant ? (
                <div className={cn("", msg.role === "user" ? "" : "pl-1")}>
                  <Markdown content={msg.content || "..."} />
                </div>
              ) : (
                <p className={cn(
                  "whitespace-pre-wrap",
                  msg.role === "user" ? "" : "pl-1"
                )}>
                  {msg.content || "..."}
                </p>
              )}

              <div className="flex items-center gap-2 mt-3">
                {hasSources && isAssistant && (
                  <SourcesButton sources={msg.sources} />
                )}

                <button
                  onClick={() => copyToClipboard(msg.content || "", msg.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
                    msg.role === "user"
                      ? "bg-primary/20 text-primary-foreground"
                      : "bg-gray-100 text-gray-700"
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

                {isAssistant && onRegenerateMessage && (
                  <button
                    onClick={() => onRegenerateMessage(msg.id)}
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
      })}

      {isStreaming && messages.length > 0 && messages[messages.length - 1].role !== "assistant" && (
        <div className="flex justify-start">
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        </div>
      )}

      <div ref={endOfMessagesRef} />
    </div>
  );
}
