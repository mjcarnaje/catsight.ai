"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Code, Compass, Search, Sparkles } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChatSidebar } from "@/components/chat/sidebar"

export default function ChatPage() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <ChatSidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 h-full">
        <div className="flex items-center justify-center flex-1 p-4">
          <div className="w-full max-w-2xl text-center">
            <h1 className="mb-8 text-3xl font-bold text-gray-800">How can I help you?</h1>

            <div className="flex justify-center mb-12 space-x-4">
              <Button variant="outline" className="text-gray-700 border-gray-300 hover:bg-gray-100">
                <Sparkles className="w-4 h-4 mr-2 text-blue-500" />
                Create
              </Button>
              <Button variant="outline" className="text-gray-700 border-gray-300 hover:bg-gray-100">
                <Compass className="w-4 h-4 mr-2 text-blue-500" />
                Explore
              </Button>
              <Button variant="outline" className="text-gray-700 border-gray-300 hover:bg-gray-100">
                <Code className="w-4 h-4 mr-2 text-blue-500" />
                Code
              </Button>
              <Button variant="outline" className="text-gray-700 border-gray-300 hover:bg-gray-100">
                <BookOpen className="w-4 h-4 mr-2 text-blue-500" />
                Learn
              </Button>
            </div>

            <div className="max-w-md mx-auto space-y-4 text-left">
              <Button
                variant="ghost"
                className="justify-start w-full text-gray-700 hover:bg-gray-100"
                onClick={() => navigate("/chat/new?prompt=How does AI work?")}
              >
                How does AI work?
              </Button>
              <Button
                variant="ghost"
                className="justify-start w-full text-gray-700 hover:bg-gray-100"
                onClick={() => navigate("/chat/new?prompt=What are the admission requirements?")}
              >
                What are the admission requirements?
              </Button>
              <Button
                variant="ghost"
                className="justify-start w-full text-gray-700 hover:bg-gray-100"
                onClick={() => navigate("/chat/new?prompt=How do I apply for a scholarship?")}
              >
                How do I apply for a scholarship?
              </Button>
              <Button
                variant="ghost"
                className="justify-start w-full text-gray-700 hover:bg-gray-100"
                onClick={() => navigate("/chat/new?prompt=What is the academic calendar?")}
              >
                What is the academic calendar?
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="max-w-3xl mx-auto">
            <p className="mb-4 text-xs text-center text-gray-500">
              Make sure you agree to our <span className="underline">Terms</span> and our{" "}
              <span className="underline">Privacy Policy</span>
            </p>
            <div className="relative">
              <Input placeholder="Type your message here..." className="pr-10 border-gray-300 focus:border-blue-500" />
              <Button size="sm" className="absolute w-8 h-8 p-0 bg-transparent right-1 top-1 hover:bg-gray-100">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-blue-500"
                >
                  <path
                    d="M7 11L12 6L17 11M12 6V18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
