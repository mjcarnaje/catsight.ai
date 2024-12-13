import { useState, useRef, useEffect } from "react";
import { documentsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";

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

    try {
      const loadingMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: loadingMessageId,
          content: "...",
          role: "assistant",
          timestamp: new Date(),
        },
      ]);

      const result = await documentsApi.chat(input);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                id: msg.id,
                content: result.data.answer,
                role: "assistant",
                timestamp: new Date(),
              }
            : msg
        )
      );
    } catch (err) {
      setError("Failed to get response from the server");
      setMessages((prev) => prev.filter((msg) => msg.content !== "..."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 h-screen flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Chat</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-destructive mb-4">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-4 rounded-lg border">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground ml-4"
                  : "bg-muted mr-4"
              }`}
            >
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading}>
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
