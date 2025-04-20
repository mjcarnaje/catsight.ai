import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp } from "lucide-react";
import { FormEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading = false }: ChatInputProps) {
  return (
    <div className="p-4 border-t border-gray-200">
      <div className="max-w-3xl mx-auto">
        <p className="mb-4 text-xs text-center text-gray-500">
          Make sure you agree to our <span className="underline">Terms</span> and our{" "}
          <span className="underline">Privacy Policy</span>
        </p>
        <form onSubmit={onSubmit} className="relative">
          <Input
            placeholder="Type your message here..."
            className="pr-10 border-gray-300 focus:border-blue-500"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1 top-1 h-8 w-8 p-0 bg-transparent hover:bg-gray-100"
            disabled={isLoading || !value.trim()}
          >
            <ArrowUp className="w-4 h-4 text-blue-500" />
          </Button>
        </form>
      </div>
    </div>
  );
} 