import { Card } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-800">Start a new conversation</h3>
            <p className="mt-2 text-gray-500">Ask a question about MSU-IIT documents</p>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg p-4 ${message.role === "user"
                    ? "bg-blue-50 border border-blue-100"
                    : "bg-gray-50 border border-gray-100"
                  }`}
              >
                <p className="whitespace-pre-wrap text-gray-800">{message.content}</p>

                {message.sources && message.sources.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-gray-200">
                    <p className="mb-2 text-xs text-gray-500">Sources:</p>
                    {message.sources.map((source, index) => (
                      <Card key={index} className="bg-white border-gray-200 p-2 text-xs mb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{source.documentTitle}</p>
                            {source.chunkIndexes && (
                              <p className="text-gray-500">
                                Chunks: {source.chunkIndexes.join(', ')}
                              </p>
                            )}
                            {source.pageNumber && (
                              <p className="text-gray-500">Page {source.pageNumber}</p>
                            )}
                          </div>
                          {source.similarity !== undefined && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-md">
                              {(source.similarity * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {message.grade && (
                  <div className="pt-3 mt-3 border-t border-gray-200">
                    <p className="mb-2 text-xs text-gray-500">Quality Assessment:</p>
                    <div className="flex gap-2">
                      <div className="bg-white border border-gray-200 p-1.5 px-2 text-xs rounded-md">
                        <span className="text-gray-700">Relevance: </span>
                        <span
                          className={
                            message.grade.relevance === 'High' ? 'text-green-600' :
                              message.grade.relevance === 'Medium' ? 'text-yellow-600' :
                                'text-red-600'
                          }
                        >
                          {message.grade.relevance}
                        </span>
                      </div>
                      <div className="bg-white border border-gray-200 p-1.5 px-2 text-xs rounded-md">
                        <span className="text-gray-700">Accuracy: </span>
                        <span>{message.grade.accuracy}</span>
                      </div>
                      <div className="bg-white border border-gray-200 p-1.5 px-2 text-xs rounded-md">
                        <span className="text-gray-700">Score: </span>
                        <span
                          className={
                            parseInt(message.grade.score.toString()) >= 8 ? 'text-green-600' :
                              parseInt(message.grade.score.toString()) >= 5 ? 'text-yellow-600' :
                                'text-red-600'
                          }
                        >
                          {message.grade.score}/10
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-4 bg-gray-50 border border-gray-100">
                <div className="flex space-x-2">
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
} 