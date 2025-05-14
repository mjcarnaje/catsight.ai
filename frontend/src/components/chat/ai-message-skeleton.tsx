import { Loader2 } from "lucide-react";

export function AIMessageSkeleton() {
  return (
    <div className="relative flex justify-start max-w-sm text-gray-800 sm:max-w-md md:max-w-lg group">
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-white border rounded-full shadow-sm">
        <Loader2 className="w-3.5 h-3.5 text-pink-500 animate-spin" />
        <span>Generating response...</span>
      </div>
    </div>
  );
}
