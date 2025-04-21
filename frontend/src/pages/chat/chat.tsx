"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Code, Compass, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatSidebar } from "@/components/chat/sidebar";
import { cn } from "@/lib/utils";

/**
 * Prompt categories are fully data‑driven so it's trivial to add or remove
 * entire sections without having to touch the rendering logic.
 */
const promptCategories = [
  {
    icon: Sparkles,
    label: "Get Started",
    prompts: [
      "What is CATSight.AI?",
      "How do I log in using my MSU-IIT email?",
      "What are the user roles and permissions?",
    ],
  },
  {
    icon: Compass,
    label: "Explore Features",
    prompts: [
      "How does Semantic Search work?",
      "What can I do with Conversational AI?",
      "How do I manage documents?",
    ],
  },
  {
    icon: Code,
    label: "Developer Help",
    prompts: [
      "How is the RAG pipeline implemented?",
      "What models are available and how are they used?",
      "How do I configure the database and vector store?",
    ],
  },
  {
    icon: BookOpen,
    label: "Learn More",
    prompts: [
      "What are the future enhancements planned?",
      "How do I contribute to this project?",
      "How does document chunking work in LangChain?",
    ],
  },
] as const;

export default function ChatPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const currentCategory = promptCategories[activeCategory];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <ChatSidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 h-full">
        <div className="flex items-center justify-center flex-1 p-4">
          <div className="w-full max-w-2xl text-center">
            <h1 className="mb-8 text-3xl font-bold text-gray-800">
              How can I help you?
            </h1>

            {/* Category buttons */}
            <div className="flex justify-center mb-12 space-x-4">
              {promptCategories.map(({ icon: Icon, label }, idx) => (
                <Button
                  key={label}
                  variant={idx === activeCategory ? "default" : "outline"}
                  className={cn("text-gray-700 border-gray-300 hover:bg-gray-100", idx === activeCategory && "text-white")}
                  onClick={() => setActiveCategory(idx)}
                >
                  <Icon className={cn("w-4 h-4 mr-2", idx === activeCategory && "text-white")} />
                  {label}
                </Button>
              ))}
            </div>

            {/* Prompt suggestions */}
            <div className="max-w-md mx-auto space-y-4 text-left">
              {currentCategory.prompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="ghost"
                  className="justify-start w-full text-gray-700 hover:bg-gray-100"
                  onClick={() =>
                    navigate(`/chat/new?prompt=${encodeURIComponent(prompt)}`)
                  }
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Message composer */}
        <div className="p-4 border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            <p className="mb-4 text-xs text-center text-gray-500">
              Make sure you agree to our <span className="underline">Terms</span> and our{' '}
              <span className="underline">Privacy Policy</span>
            </p>
            <div className="relative">
              <Input
                placeholder="Type your message here..."
                className="pr-10 border-gray-300 focus:border-primary"
              />
              <Button
                size="sm"
                className="absolute w-8 h-8 p-0 bg-transparent right-1 top-1 hover:bg-gray-100"
              >
                <Search className="w-full h-full text-primary" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}