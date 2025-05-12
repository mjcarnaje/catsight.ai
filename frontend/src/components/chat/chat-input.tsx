// ChatInput.tsx
import { ModelSelector } from "@/components/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LLMModel, ModelInfo } from "@/types";
import { AlertCircle, Loader2, Send, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface ChatInputProps {
  text: string;
  setText: (text: string) => void;
  modelId: string | null;
  onModelChange: (model: LLMModel | null) => void;
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({
  text,
  setText,
  modelId,
  onModelChange,
  onSend,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const onSubmit = useCallback(() => {
    if (!text.trim() || !modelId) return;
    onSend(text.trim());
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, modelId, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  };

  const handleModelChange = (model: LLMModel | null) => {
    onModelChange(model);
  };

  return (
    <div className="relative w-full px-4 py-4 border-t border-gray-100 bg-white/95 backdrop-blur-md">
      {!modelId && !disabled && (
        <div className="flex items-center gap-2 p-3 mb-4 text-sm border rounded-lg bg-amber-50 border-amber-200 text-amber-800">
          <AlertCircle size={16} className="shrink-0" />
          <span>Please select a model to continue</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="relative flex items-end flex-1"
          >
            <div
              className={cn(
                "relative flex-1 overflow-hidden rounded-2xl border border-gray-200 focus-within:border-pink-300 focus-within:ring-2 focus-within:ring-pink-100 shadow-sm transition-all",
                disabled ? "opacity-60" : ""
              )}
            >
              <Textarea
                ref={textareaRef}
                placeholder="Ask a question or send a message..."
                value={text}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                disabled={disabled || !modelId}
                className="w-full py-3 px-4 pr-14 min-h-[56px] max-h-[200px] resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-gray-400"
              />
              <Button
                type="submit"
                size="icon"
                disabled={disabled || !modelId || !text.trim()}
                className="absolute w-10 h-10 text-white transition-colors bg-pink-500 shadow-sm right-2 bottom-2 rounded-xl hover:bg-pink-600 disabled:opacity-50"
              >
                {disabled ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </form>

          <div className="shrink-0">
            <ModelSelector modelId={modelId} onModelChange={handleModelChange} />
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Sparkles className="w-3 h-3" />
            <span>AI can make mistakes. Consider checking important information.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
