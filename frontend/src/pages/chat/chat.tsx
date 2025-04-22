import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatSidebar } from "@/components/chat/sidebar";
import { cn } from "@/lib/utils";
import { parse as parsePartialJson } from "partial-json";
import { Sparkles, Compass, Code, BookOpen, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const promptCategories = [
  {
    icon: Sparkles, label: "Get Started", prompts: [
      "What is CATSight.AI?",
      "How do I log in using my MSU-IIT email?",
      "What are the user roles and permissions?",
    ]
  },
  {
    icon: Compass, label: "Explore Features", prompts: [
      "How does Semantic Search work?",
      "What can I do with Conversational AI?",
      "How do I manage documents?",
    ]
  },
  {
    icon: Code, label: "Developer Help", prompts: [
      "How is the RAG pipeline implemented?",
      "What models are available and how are they used?",
      "How do I configure the database and vector store?",
    ]
  },
  {
    icon: BookOpen, label: "Learn More", prompts: [
      "What are the future enhancements planned?",
      "How do I contribute to this project?",
      "How does document chunking work in LangChain?",
    ]
  },
] as const;

type Message = {
  sender: "user" | "ai";
  content: string;
  context?: Array<{ page_content: string; metadata: { id: string; index: string; doc_id: string } }>;
};

export default function ChatPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(0);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", content: message }, { sender: "ai", content: "" }]);
    setIsStreaming(true);
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("No token");

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/documents/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: message }),
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = parsePartialJson(line.slice(6));
            const part = data?.content || "";
            const meta = data?.context;
            const finished = data?.finished;

            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              last.content += part;
              if (meta) last.context = meta;
              return updated;
            });

            if (finished) break;
          } catch (err) {
            console.error(err);
            break;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          last.content += "\n\nOops, something went wrong!";
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      setMessage("");
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <ChatSidebar />

      {/* Main chat area */}
      <div className="relative flex flex-col flex-1">
        {/* Messages */}
        {messages.length > 0 ? (
          <div className="flex-1 p-6 overflow-y-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "flex mb-4",
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "relative p-4 rounded-2xl max-w-lg whitespace-pre-wrap",
                      msg.sender === "user"
                        ? "bg-primary text-white rounded-br-none"
                        : "bg-gray-100 text-gray-900 rounded-bl-none"
                    )}
                  >
                    <p className="text-base leading-relaxed">{msg.content}</p>
                    {msg.context && (
                      <div className="mt-2 text-xs text-gray-500">
                        {msg.context.map((ctx) => (
                          <span
                            key={`${ctx.metadata.id}-${ctx.metadata.index}`}
                            className="inline-block px-2 py-1 mr-2 bg-gray-200 rounded-full"
                          >
                            Source: {ctx.metadata.doc_id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        ) : (
          /* Prompt selection */
          <div className="flex flex-col items-center justify-center flex-1 p-8">
            <h2 className="mb-6 text-4xl font-semibold text-gray-700">
              How can I help you today?
            </h2>
            <div className="flex mb-12 space-x-3">
              {promptCategories.map(({ icon: Icon, label }, idx) => (
                <Button
                  key={label}
                  variant={idx === activeCategory ? "default" : "outline"}
                  onClick={() => setActiveCategory(idx)}
                  className={cn(
                    "flex items-center px-4 py-2",
                    idx === activeCategory
                      ? "bg-primary text-white"
                      : "bg-white text-gray-700"
                  )}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid w-full max-w-xl grid-cols-1 gap-4">
              {promptCategories[activeCategory].prompts.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  className="justify-start w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
                  onClick={() => setMessage(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSubmit} className="flex items-center max-w-3xl mx-auto">
            <Input
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isStreaming}
              className="flex-1 mr-2 focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <Button type="submit" disabled={isStreaming} className="p-2">
              {isStreaming ? (
                <span className="animate-pulse">⏳</span>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
          <p className="mt-2 text-xs text-center text-gray-400">
            By continuing, you agree to our <span className="underline">Terms</span> and <span className="underline">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
