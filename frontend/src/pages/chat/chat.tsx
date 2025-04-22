import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Code, Compass, FileText, Search, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChatSidebar } from "@/components/chat/sidebar";
import { cn } from "@/lib/utils";
import { parse as parsePartialJson } from "partial-json";
import { ModelSelector } from "@/components/chat/model-selector";

const promptCategories = [
  {
    icon: Sparkles,
    label: "Get Started",
    prompts: [
      "What is CATSight.AI?",
      "How do I log in using my MSU-IIT email?",
      "What are the user roles and permissions?",
    ],
  },
  {
    icon: Compass,
    label: "Explore Features",
    prompts: [
      "How does Semantic Search work?",
      "What can I do with Conversational AI?",
      "How do I manage documents?",
    ],
  },
  {
    icon: Code,
    label: "Developer Help",
    prompts: [
      "How is the RAG pipeline implemented?",
      "What models are available and how are they used?",
      "How do I configure the database and vector store?",
    ],
  },
  {
    icon: BookOpen,
    label: "Learn More",
    prompts: [
      "What are the future enhancements planned?",
      "How do I contribute to this project?",
      "How does document chunking work in LangChain?",
    ],
  },
] as const;

type Message = {
  sender: "user" | "ai";
  content: string;
  context?: {
    page_content: string;
    metadata: {
      id: string;
      index: string;
      doc_id: string;
    };
  }[];
};

export default function ChatPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setMessages((prev) => [
      ...prev,
      { sender: "user", content: message },
      { sender: "ai", content: "", context: [] },
    ]);

    setIsStreaming(true);

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          last.content = "Authentication error. Please log in again to continue.";
          return msgs;
        });
        navigate("/login");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/documents/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query: message }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        let errorMessage = "Failed to process your request";

        // Handle specific status codes
        if (response.status === 401) {
          errorMessage = "Your session has expired. Please log in again.";
          navigate("/login");
        } else if (response.status === 429) {
          errorMessage = "Too many requests. Please try again later.";
        } else if (response.status >= 500) {
          errorMessage = "Server error. Please try again later.";
        }

        throw new Error(`${errorMessage} (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is empty or invalid");

      const decoder = new TextDecoder();
      let retryCount = 0;
      const maxRetries = 3;

      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              // Use partial-json to handle incomplete JSON strings
              const jsonString = line.slice(6);
              const data = parsePartialJson(jsonString);

              // Extract data safely with fallbacks
              const part = data?.content ?? "";
              const meta = data?.context;
              const finished = data?.finished === true;

              setMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];

                // Only append content if it's not already present
                // This prevents duplication when server sends the full message multiple times
                if (!last.content.endsWith(part) && part) {
                  last.content += part;
                }

                // Make sure context is only set when it's available and not null/undefined
                if (meta !== undefined && meta !== null) {
                  console.log("Received context:", meta);
                  last.context = meta;
                }
                return msgs;
              });

              if (finished) {
                console.log("Stream finished with context:", meta);
                break;
              }
            } catch (err) {
              console.error("Stream parse error", err, "on line:", line);
              // Try to recover from parse errors
              setMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (!last.content.includes("Error processing part of the response")) {
                  last.content += "\n[Error processing part of the response]";
                }
                return msgs;
              });
            }
          }
          // Reset retry count on successful read
          retryCount = 0;
        } catch (readErr) {
          // Attempt to recover from temporary read errors
          if (retryCount < maxRetries) {
            retryCount++;
            console.error(`Error reading stream (attempt ${retryCount}/${maxRetries}):`, readErr);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
            continue;
          }
          throw readErr; // If max retries reached, rethrow
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Request was aborted");
      } else if (err.name === "TypeError" && err.message.includes("NetworkError")) {
        console.error("Network error", err);
        setMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          last.content = "Network error. Please check your internet connection and try again.";
          return msgs;
        });
      } else {
        console.error("Streaming error", err);
        setMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          last.content = `Error: ${err.message || "Something went wrong while processing your request."}`;
          return msgs;
        });
      }
    } finally {
      setIsStreaming(false);
      setMessage("");
    }
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const currentCategory = promptCategories[activeCategory];

  const highlightSearchTerm = (text: string, term: string) => {
    if (!term.trim()) return text;

    // Split the term into words and escape special regex characters
    const escapedTerms = term.split(/\s+/).map(word =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // Create a regex that matches any of the words
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    return text.replace(regex, '<mark class="bg-primary/20 px-1 rounded">$1</mark>');
  };

  return (
    <div className="flex h-full">
      <ChatSidebar />

      <div className="flex flex-col flex-1 h-full">
        {messages.length > 0 ? (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex",
                  msg.sender === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "p-4 rounded-lg max-w-2xl shadow-sm",
                    msg.sender === "user"
                      ? "bg-secondary text-white"
                      : "bg-gray-100 border border-gray-200"
                  )}
                >
                  <div className="prose-sm">
                    <p className="whitespace-pre-wrap">{msg.content || "No response"}</p>
                  </div>

                  {msg.sender === "ai" && msg.context && msg.context.length > 0 && (
                    <div className="pt-3 mt-4 border-t border-gray-200">
                      <div className="flex items-center mb-2 text-xs text-gray-500">
                        <BookOpen className="w-3 h-3 mr-1" />
                        <span>Sources</span>
                      </div>
                      <div className="space-y-2">
                        {msg.context.map((context, sourceIdx) => (
                          <div
                            key={`${context.metadata.id}-${context.metadata.index}-${sourceIdx}`}
                            className="p-2 border border-gray-200 rounded bg-gray-50"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-medium text-gray-700 truncate">
                                Document: {context.metadata.doc_id}
                              </div>
                              <div className="text-xs text-gray-500">
                                Chunk #{context.metadata.index}
                              </div>
                            </div>
                            <div
                              className="mb-2 text-xs text-gray-600 line-clamp-2"
                              dangerouslySetInnerHTML={{
                                __html: highlightSearchTerm(
                                  context.page_content?.substring(0, 150) + '...' || '',
                                  message
                                )
                              }}
                            />
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs transition-colors h-7 hover:bg-primary hover:text-primary-foreground"
                                onClick={() => {
                                  navigate(`/documents/${context.metadata.doc_id}?chunk_index=${context.metadata.index}&highlight=${message}`);
                                }}
                              >
                                <FileText className="w-3 h-3" />
                                View Document
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="w-full max-w-2xl text-center">
              <h1 className="mb-8 text-3xl font-bold text-gray-800">
                How can I help you?
              </h1>
              <div className="flex justify-center mb-12 space-x-4">
                {promptCategories.map(({ icon: Icon, label }, idx) => (
                  <Button
                    key={label}
                    variant={idx === activeCategory ? "default" : "outline"}
                    className={cn(
                      "text-gray-700 border-gray-300 hover:bg-gray-100",
                      idx === activeCategory && "text-white"
                    )}
                    onClick={() => setActiveCategory(idx)}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 mr-2",
                        idx === activeCategory && "text-white"
                      )}
                    />
                    {label}
                  </Button>
                ))}
              </div>
              <div className="max-w-md mx-auto space-y-4 text-left">
                {currentCategory.prompts.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="ghost"
                    className="justify-start w-full text-gray-700 hover:bg-gray-100"
                    onClick={() => setMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            <p className="mb-4 text-xs text-center text-gray-500">
              Make sure you agree to our{" "}
              <span className="underline">Terms</span> and our{" "}
              <span className="underline">Privacy Policy</span>
            </p>
            <form onSubmit={handleSubmit} className="relative flex">
              <ModelSelector onModelChange={() => { }} />
              <Input
                placeholder="Type your message here..."
                className="flex-1 pr-10 border-gray-300 focus:border-primary"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isStreaming}
              />
              <Button type="submit" className="ml-2" disabled={isStreaming}>
                {isStreaming ? "⏳" : "Send"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
