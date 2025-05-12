// components/ChatList.tsx
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { Message } from "@/types/message";
import { CalendarDays, Check, Copy, Eye, EyeOff, FileText, Landmark, Loader2, Megaphone, PickaxeIcon, RefreshCw, Scroll, Users } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { SourcesButton } from "./sources-button";

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
  const [thinkingVisibility, setThinkingVisibility] = useState<Record<string, boolean>>({});

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    })
  };


  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  const extractThinking = (content: string) => {
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
  };

  const toggleThinking = (messageId: string) => {
    setThinkingVisibility(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

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
      {messages.map((msg, idx) => {
        const previousMessage = messages[idx - 1];
        const isCopied = copiedId === msg.id;
        const hasSources = previousMessage?.role === "tool" && previousMessage.tool_result?.sources.length > 0;
        const sources = hasSources ? previousMessage.tool_result?.sources : [];

        const processedContent = msg.role === "assistant" && msg.content
          ? extractThinking(msg.content)
          : { hasThinking: false, content: msg.content || "", thinking: "" };

        const showThinking = thinkingVisibility[msg.id] && processedContent.hasThinking;

        if (msg.role === "tool") {
          return null;
        }

        if (msg.role === "assistant" && msg.message_type === "tool_call") {
          return (
            <div key={msg.id} className="flex items-center gap-4 p-2 bg-gray-100 rounded-md">
              <PickaxeIcon className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-800 capitalize">{msg.tool_call?.name}</span>
                <span className="text-xs text-gray-500">{msg.tool_call?.query}</span>
              </div>
            </div>
          );
        }

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
              {msg.role === "assistant" ? (
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
              ) : (
                <p className={cn(
                  "whitespace-pre-wrap",
                  msg.role === "user" ? "" : "pl-1"
                )}>
                  {msg.content || "..."}
                </p>
              )}

              <div className="flex items-center gap-2 mt-3">
                {hasSources && msg.role === "assistant" && (
                  <SourcesButton sources={sources} />
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

                {msg.role === "assistant" && onRegenerateMessage && (
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

      {/* Better AI thinking placeholder with animation */}
      {isStreaming && (
        <div className="flex justify-start">
          <div className="p-3 border border-gray-100 rounded-lg shadow-sm bg-gray-50">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
              <span className="text-gray-700">AI is generating response...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={endOfMessagesRef} />
    </div>
  );
}
