// ChatInput.tsx
import React, { useState } from "react";
import { Model, ModelSelector } from "@/components/chat/model-selector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Send, Loader2 } from "lucide-react";

export function ChatInput({
  modelId,
  onModelChange,
  onSend,
  disabled,
}: {
  modelId: string | null;
  onModelChange: (model: Model | null) => void;
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim() || !modelId) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="relative w-full p-4 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
      {!modelId && !disabled && (
        <div className="flex items-center gap-1.5 mb-3 p-2 text-sm rounded-md bg-yellow-50 border border-yellow-200 text-yellow-700">
          <AlertCircle size={16} />
          <span>Please select a model to continue</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="md:order-2 mb-3 md:mb-0">
          <ModelSelector modelId={modelId} onModelChange={onModelChange} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="relative flex-1 md:order-1"
        >
          <div className="relative flex items-center">
            <Input
              placeholder="Type your message here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={disabled || !modelId}
              className="py-5 pl-5 pr-14 border border-gray-200 rounded-full focus:border-pink-300 focus:ring-2 focus:ring-pink-100 shadow-sm transition-all"
            />

            <Button
              type="submit"
              size="icon"
              disabled={disabled || !modelId || !text.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-pink-500 hover:bg-pink-600 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {disabled ?
                <Loader2 className="w-4 h-4 animate-spin" /> :
                <Send className="h-4 w-4 ml-0.5" />
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
