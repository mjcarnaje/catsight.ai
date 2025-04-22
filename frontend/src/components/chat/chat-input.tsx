import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  hideFooterText?: boolean;
}

export function ChatInput({
  value,
  onChange,
  isLoading = false,
  hideFooterText = false
}: ChatInputProps) {
  return (
    <div className={hideFooterText ? "" : "p-4 border-t border-gray-200"}>
      <div className={hideFooterText ? "" : "max-w-3xl mx-auto"}>
        {!hideFooterText && (
          <p className="mb-4 text-xs text-center text-gray-500">
            Make sure you agree to our <span className="underline">Terms</span> and our{" "}
            <span className="underline">Privacy Policy</span>
          </p>
        )}
        <div className="relative">
          <Input
            placeholder="Type your message here..."
            className="pr-10 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="sm"
            className="absolute w-8 h-8 p-0 bg-transparent right-1 top-1 hover:bg-gray-100"
            disabled={isLoading || !value.trim()}
          >
            <ArrowUp className="w-4 h-4 text-blue-500" />
          </Button>
        </div>
      </div>
    </div>
  );
} 