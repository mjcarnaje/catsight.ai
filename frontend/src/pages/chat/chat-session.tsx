"use client"

import { useState, useEffect } from "react"
import type { ChatMessage } from "@/types"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ChatSidebar } from "@/components/chat/sidebar"
import { ChatHeader } from "@/components/chat/chat-header"
import { MessageList } from "@/components/chat/message-list"
import { ChatInput } from "@/components/chat/chat-input"

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

  useEffect(() => {
    if (initialPrompt) {
      handleSendMessage(new Event("submit") as unknown as React.FormEvent)
    }
  }, [])

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

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <ChatSidebar currentChatId={chatId} />

      {/* Main content */}
      <div className="flex flex-col flex-1 h-full">
        {/* Chat header */}
        <ChatHeader title={chatSession.title} />

        {/* Messages */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* Input area */}
        <ChatInput
          value={newMessage}
          onChange={setNewMessage}
          onSubmit={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
