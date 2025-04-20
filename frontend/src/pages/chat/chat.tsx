"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Code, Compass, Search, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

export default function ChatPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredChats, setFilteredChats] = useState([])

  useEffect(() => {
    if (searchQuery) {
      setFilteredChats([])
    } else {
      setFilteredChats([])
    }
  }, [searchQuery])

  const handleNewChat = () => {
    navigate("/chat/new")
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="flex flex-col w-64 h-full border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="mb-4 text-xl font-bold text-gray-800">IntelDoc</h2>
          <Button onClick={handleNewChat} className="w-full text-white bg-blue-600 hover:bg-blue-700">
            New Chat
          </Button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search your threads..."
              className="pl-8 text-sm border-gray-300 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-gray-500">Recent</div>
              <div className="px-2 space-y-1">
                {filteredChats.map((chat) => (
                  <Link
                    key={chat.id}
                    to={`/chat/${chat.id}`}
                    className="block px-2 py-2 text-sm text-gray-700 truncate rounded hover:bg-gray-100"
                  >
                    {chat.title}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

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
