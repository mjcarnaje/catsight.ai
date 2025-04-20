"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ChatMessage } from "@/types"
import { ArrowLeft, Search, MessageSquare, ArrowUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"

export default function ChatSessionPage() {
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const initialPrompt = searchParams.get("prompt")

  const chatId = params.id
  const isNewChat = chatId === "new"

  const chatSession = isNewChat
    ? {
      id: "new",
      title: "New Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [] as ChatMessage[],
    }
    : {
      id: chatId,
      title: "Existing Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [] as ChatMessage[],
    }

  const [messages, setMessages] = useState<ChatMessage[]>(chatSession.messages)
  const [newMessage, setNewMessage] = useState(initialPrompt || "")
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredChats, setFilteredChats] = useState([])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialPrompt) {
      handleSendMessage(new Event("submit") as unknown as React.FormEvent)
    }
  }, [])

  useEffect(() => {
    if (searchQuery) {
      setFilteredChats([]) // Replace with actual filtering logic
    } else {
      setFilteredChats([]) // Replace with actual data
    }
  }, [searchQuery])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: newMessage,
      timestamp: new Date().toISOString(),
      sources: [],
    }

    setMessages((prev) => [...prev, userMessage])
    setNewMessage("")
    setIsLoading(true)

    // Call the actual chat API
    import("@/lib/api").then(({ documentsApi }) => {
      documentsApi.chat(newMessage)
        .then((response) => {
          const aiMessage: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: "assistant",
            content: response.data.answer,
            timestamp: new Date().toISOString(),
            sources: response.data.sources.map((source) => ({
              documentId: source.document_id,
              documentTitle: source.document_title,
              content: source.chunks.map((chunk) => chunk.content).join('\n\n'),
              chunkIndexes: source.chunks.map((chunk) => chunk.chunk_index),
              similarity: source.total_similarity
            })),
            grade: response.data.grade
          }

          setMessages((prev) => [...prev, aiMessage])
        })
        .catch((error) => {
          console.error("Error fetching chat response:", error)

          // Add error message
          const errorMessage: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: "assistant",
            content: "I'm sorry, I encountered an error while processing your request. Please try again later.",
            timestamp: new Date().toISOString(),
            sources: [],
          }

          setMessages((prev) => [...prev, errorMessage])
        })
        .finally(() => {
          setIsLoading(false)
        })
    })
  }

  const handleNewChat = () => {
    navigate("/chat/new")
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-white">
      {/* Sidebar */}
      <div className="flex flex-col w-64 h-full border-r border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h2 className="mb-4 text-xl font-bold">IntelDoc</h2>
          <Button onClick={handleNewChat} className="w-full bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white">
            New Chat
          </Button>
        </div>

        <div className="p-4 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search your threads..."
              className="pl-8 bg-[#2a2a2a] border-gray-700 focus:border-gray-600 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-gray-400">Recent</div>
              <div className="px-2 space-y-1">
                {filteredChats.map((chat) => (
                  <Link
                    key={chat.id}
                    to={`/chat/${chat.id}`}
                    className={`block px-2 py-2 rounded text-sm truncate ${chat.id === chatId ? "bg-[#2a2a2a] text-white" : "hover:bg-[#2a2a2a] text-gray-300"
                      }`}
                  >
                    {chat.title}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 h-full">
        {/* Chat header */}
        <div className="flex items-center p-2 border-b border-gray-800">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={() => navigate("/chat")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="ml-2 text-sm font-medium">{chatSession.title}</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium">Start a new conversation</h3>
                <p className="mt-2 text-gray-400">Ask a question about MSU-IIT documents</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${message.role === "user" ? "bg-[#3a3a3a]" : "bg-[#2a2a2a]"
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {message.sources && message.sources.length > 0 && (
                      <div className="pt-3 mt-3 border-t border-gray-700">
                        <p className="mb-2 text-xs text-gray-400">Sources:</p>
                        {message.sources.map((source, index) => (
                          <Card key={index} className="bg-[#222] border-gray-700 p-2 text-xs mb-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{source.documentTitle}</p>
                                {source.chunkIndexes && (
                                  <p className="text-gray-400">
                                    Chunks: {source.chunkIndexes.join(', ')}
                                  </p>
                                )}
                                {source.pageNumber && (
                                  <p className="text-gray-400">Page {source.pageNumber}</p>
                                )}
                              </div>
                              {source.similarity !== undefined && (
                                <span className="px-1.5 py-0.5 bg-blue-900 text-blue-100 text-xs rounded-md">
                                  {(source.similarity * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                    {message.grade && (
                      <div className="pt-3 mt-3 border-t border-gray-700">
                        <p className="mb-2 text-xs text-gray-400">Quality Assessment:</p>
                        <div className="flex gap-2">
                          <div className="bg-[#222] border-gray-700 p-1.5 px-2 text-xs rounded-md">
                            <span>Relevance: </span>
                            <span
                              className={
                                message.grade.relevance === 'High' ? 'text-green-400' :
                                  message.grade.relevance === 'Medium' ? 'text-yellow-400' :
                                    'text-red-400'
                              }
                            >
                              {message.grade.relevance}
                            </span>
                          </div>
                          <div className="bg-[#222] border-gray-700 p-1.5 px-2 text-xs rounded-md">
                            <span>Accuracy: </span>
                            <span>{message.grade.accuracy}</span>
                          </div>
                          <div className="bg-[#222] border-gray-700 p-1.5 px-2 text-xs rounded-md">
                            <span>Score: </span>
                            <span
                              className={
                                parseInt(message.grade.score.toString()) >= 8 ? 'text-green-400' :
                                  parseInt(message.grade.score.toString()) >= 5 ? 'text-yellow-400' :
                                    'text-red-400'
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
                  <div className="max-w-[80%] rounded-lg p-4 bg-[#2a2a2a]">
                    <div className="flex space-x-2">
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
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

        {/* Input area */}
        <div className="p-4 border-t border-gray-800">
          <div className="max-w-3xl mx-auto">
            <p className="mb-4 text-xs text-center text-gray-400">
              Make sure you agree to our <span className="underline">Terms</span> and our{" "}
              <span className="underline">Privacy Policy</span>
            </p>
            <form onSubmit={handleSendMessage} className="relative">
              <Input
                placeholder="Type your message here..."
                className="pr-10 bg-[#2a2a2a] border-gray-700 focus:border-gray-600"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0 bg-transparent hover:bg-[#3a3a3a]"
                disabled={isLoading || !newMessage.trim()}
              >
                <ArrowUp className="w-4 h-4 text-gray-400" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
