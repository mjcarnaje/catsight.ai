import { ChatItem } from "./chat-item";

interface ChatGroupProps {
  title: string;
  chats: any[];
  currentChatId?: string;
}

export function ChatGroup({ title, chats, currentChatId }: ChatGroupProps) {
  if (!chats.length) return null;

  return (
    <div>
      <div className="px-4 py-2 text-xs text-gray-500">{title}</div>
      <div className="px-2 space-y-1">
        {chats.map((chat) => (
          <ChatItem key={chat.id} chat={chat} currentChatId={currentChatId} />
        ))}
      </div>
    </div>
  );
} 