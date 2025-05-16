// components/ChatList.tsx
import { Message } from "@/types/message";
import {
  CalendarDays,
  FileText,
  Landmark,
  Megaphone,
  PickaxeIcon,
  Scroll,
  Users,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { AIMessage } from "./ai-message";
import { AIMessageSkeleton } from "./ai-message-skeleton";
import { HumanMessage } from "./human-message";
import { TitleGenerationIndicator } from "./title-generation-indicator";
import { getToolName } from "@/lib/utils";

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
  onSelectSuggestion,
}: ChatListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [thinkingVisibility, setThinkingVisibility] = useState<
    Record<string, boolean>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleEdit = (newContent: string, id: string) => {
    setLocalMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: newContent } : m))
    );
    setEditingId(null);
  };

  const toggleThinking = (messageId: string) => {
    setThinkingVisibility((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const shouldShowTitleGeneration =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].message_type !== "tool_call";

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl p-8 mx-auto">
        <h2 className="mb-6 text-2xl font-semibold text-center text-gray-800">
          How can I help you today?
        </h2>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          {questionSuggestions.map((category, idx) => {
            const Icon = category.icon;
            return (
              <div
                key={idx}
                className="z-10 p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                  <h3 className="font-medium text-gray-800">
                    {category.label}
                  </h3>
                </div>
                <div className="space-y-2">
                  {category.prompts.map((prompt, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => onSelectSuggestion?.(prompt)}
                      className="w-full p-2 text-sm text-left text-gray-700 transition-colors rounded-md hover:bg-primary/20"
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
      {localMessages.map((msg, idx) => {
        const previousMessage = localMessages[idx - 1];
        const isCopied = copiedId === msg.id;
        const hasSources =
          previousMessage?.role === "tool" &&
          previousMessage.tool_result?.sources.length > 0;
        const sources = hasSources ? previousMessage.tool_result?.sources : [];

        if (msg.role === "tool") {
          return null;
        }

        if (msg.role === "assistant" && msg.message_type === "tool_call") {
          return (
            <div
              key={msg.id}
              className="z-20 flex items-center gap-4 p-2 bg-gray-100 rounded-md"
            >
              <PickaxeIcon className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-800 capitalize">
                  {getToolName(msg.tool_call?.name)}
                </span>
                <span className="text-xs text-gray-500">
                  Query: {msg.tool_call?.query}
                </span>
              </div>
            </div>
          );
        }

        if (msg.role === "assistant") {
          return (
            <AIMessage
              key={msg.id}
              msg={msg}
              isCopied={isCopied}
              sources={sources}
              onCopy={copyToClipboard}
              onRegenerate={onRegenerateMessage}
              thinkingVisibility={thinkingVisibility[msg.id]}
              toggleThinking={toggleThinking}
            />
          );
        }

        if (msg.role === "user") {
          return (
            <HumanMessage
              key={msg.id}
              msg={msg}
              isCopied={isCopied}
              onCopy={copyToClipboard}
              onEdit={(newContent, id) => handleEdit(newContent, id)}
              isEditing={editingId === msg.id}
            />
          );
        }

        return null;
      })}

      {isStreaming && !shouldShowTitleGeneration && <AIMessageSkeleton />}
      {shouldShowTitleGeneration && <TitleGenerationIndicator />}

      <div ref={endOfMessagesRef} />
    </div>
  );
}
