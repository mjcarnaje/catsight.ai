import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api";
import { Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    const loadingMessageId = (Date.now() + 1).toString();

    try {
      setMessages((prev) => [
        ...prev,
        {
          id: loadingMessageId,
          content: "loading...",
          role: "assistant",
          timestamp: new Date(),
        },
      ]);

      const response = await fetch(`${API_BASE_URL}/documents/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) {
        throw new Error("No reader available");
      }

      let accumulatedResponse = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;

        // Update the message content with the accumulated response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: accumulatedResponse,
                }
              : msg
          )
        );
      }

      // Try to parse the final response as JSON
      try {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: accumulatedResponse,
                }
              : msg
          )
        );
      } catch (parseError) {
        // If parsing fails, use the raw accumulated response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  ...msg,
                  content: accumulatedResponse,
                }
              : msg
          )
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to get response from the server"
      );
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessageId));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 h-[calc(100vh-16rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-500">
          Chat with Documents
        </h1>
      </div>

      {error && (
        <div className="rounded-md bg-red-100 p-3 text-red-600 mb-4">
          {error}
        </div>
      )}

      <div className="flex-1 h-full overflow-y-auto mb-4 space-y-4 p-4 rounded-lg border bg-gray-50">
        {messages.map((message) => {
          return (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 shadow-sm ${
                  message.role === "user"
                    ? "bg-blue-500 text-white ml-4"
                    : "bg-white mr-4 border"
                }`}
              >
                {message.content === "loading..." ? (
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-200 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-blue-200 animate-bounce [animation-delay:0.1s]" />
                    <div className="w-2 h-2 rounded-full bg-blue-200 animate-bounce [animation-delay:0.2s]" />
                  </div>
                ) : (
                  <ReactMarkdown className="prose prose-sm max-w-none">
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your documents..."
          disabled={loading}
          className="border-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
