import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"

interface SidebarProps {
  currentChatId?: string;
}

export function ChatSidebar({ currentChatId }: SidebarProps) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredChats, setFilteredChats] = useState([])

  useEffect(() => {
    if (searchQuery) {
      setFilteredChats([]) // Replace with actual filtering logic
    } else {
      setFilteredChats([]) // Replace with actual data
    }
  }, [searchQuery])

  const handleNewChat = () => {
    navigate("/chat/new")
  }

  return (
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
                  className={`block px-2 py-2 rounded text-sm truncate ${chat.id === currentChatId
                      ? "bg-gray-100 text-gray-900"
                      : "hover:bg-gray-100 text-gray-700"
                    }`}
                >
                  {chat.title}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
} 