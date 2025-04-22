'use client'

import { FormEvent, useState } from "react"
import { ModelSelector, type Model } from "./model-selector"
import { ChatInput } from "./chat-input"

interface ChatFooterProps {
  isLoading?: boolean
  message: string
  setMessage: (message: string) => void
  onSendMessage: (message) => void
}

export function ChatFooter({ onSendMessage, isLoading = false, message, setMessage }: ChatFooterProps) {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)

  return (
    <div className="border-t border-gray-200">
      <div className="max-w-3xl p-4 mx-auto">
        <p className="mb-4 text-xs text-center text-gray-500">
          Make sure you agree to our <span className="underline">Terms</span> and our{" "}
          <span className="underline">Privacy Policy</span>
        </p>
        <form onSubmit={() => onSendMessage(message)} className="flex items-center gap-2">
          <div className="min-w-44">
            <ModelSelector
              onModelChange={setSelectedModel}
              defaultModelId="gemini-2.5-flash"
            />
          </div>
          <div className="relative flex-1">
            <ChatInput
              value={message}
              onChange={setMessage}
              isLoading={isLoading}
              hideFooterText
            />
          </div>
        </form>
      </div>
    </div>
  )
}
