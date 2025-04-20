import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChatHeaderProps {
  title: string;
}

export function ChatHeader({ title }: ChatHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center p-2 border-b border-gray-200">
      <Button
        variant="ghost"
        size="sm"
        className="text-gray-500 hover:text-gray-700"
        onClick={() => navigate("/chat")}
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <h2 className="ml-2 text-sm font-medium text-gray-800">{title}</h2>
    </div>
  );
} 