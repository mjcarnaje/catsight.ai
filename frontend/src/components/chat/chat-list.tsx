// components/ChatList.tsx
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Message } from "./chat-reducer";
import { Loader2, Copy, Check, RefreshCw, FileText, CalendarDays, Landmark, Users, Scroll, Megaphone } from "lucide-react";
import { SourcesButton } from "./sources-button";
import { Markdown } from "@/components/markdown";

interface QuestionSuggestion {
  icon: React.ElementType;
  label: string;
  prompts: string[];
}

interface ChatListProps {
  messages: Message[];
  isStreaming?: boolean;
  onRegenerateMessage?: (messageId: string) => void;
  onSelectSuggestion?: (text: string) => void;
}

const questionSuggestions: QuestionSuggestion[] = [
  {
    icon: FileText,
    label: "Special Orders & Memorandums",
    prompts: [
      "What are the latest MSU-IIT Special Orders?",
      "Show me recent University Memorandums",
      "What's the difference between Special Orders and Memorandums?",
    ],
  },
  {
    icon: CalendarDays,
    label: "Calendars & Bulletins",
    prompts: [
      "What's on the MSU-IIT academic calendar?",
      "Tell me about recent Campus Bulletins",
      "When is the next semester break and registration period?",
    ],
  },
  {
    icon: Landmark,
    label: "Board Resolutions & University Circulars",
    prompts: [
      "Show me the most recent Board Resolutions",
      "What do the latest University Circulars say about new policies?",
      "Can you find a Board Resolution about faculty promotions?",
    ],
  },
  {
    icon: Users,
    label: "Student & Faculty Policies",
    prompts: [
      "What are the current Student Policies?",
      "Tell me about faculty directives for this semester",
      "Have there been any recent changes to academic policies?",
    ],
  },
  {
    icon: Scroll,
    label: "Administrative Notices & Travel Orders",
    prompts: [
      "What do the latest Administrative Notices say?",
      "Show me information about Travel Orders",
      "Who is authorized for official travel this month?",
    ],
  },
  {
    icon: Megaphone,
    label: "University Announcements",
    prompts: [
      "What are the latest University announcements?",
      "Tell me about upcoming campus events",
      "Are there any urgent announcements from the administration?",
    ],
  },
];

export function ChatList({
  messages,
  isStreaming = false,
  onRegenerateMessage,
  onSelectSuggestion
}: ChatListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    console.log("ChatList received messages:", messages.length, messages);
  }, [messages]);

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

  // Only show suggestions when there are no messages
  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl p-8 mx-auto">
        <h2 className="mb-6 text-2xl font-semibold text-center text-gray-800">How can I help you today?</h2>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          {questionSuggestions.map((category, idx) => {
            const Icon = category.icon;
            return (
              <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-pink-500" />
                  <h3 className="font-medium text-gray-800">{category.label}</h3>
                </div>
                <div className="space-y-2">
                  {category.prompts.map((prompt, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => onSelectSuggestion?.(prompt)}
                      className="w-full p-2 text-sm text-left text-gray-700 transition-colors rounded-md hover:bg-pink-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
