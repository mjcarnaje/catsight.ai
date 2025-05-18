import { ChatInput } from "@/components/chat/chat-input";
import { ChatList } from "@/components/chat/chat-list";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useToast } from "@/components/ui/use-toast";
import { useChatStream } from "@/contexts/chat-stream-context";
import { useSession } from "@/contexts/session-context";
import { chatsApi, llmApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LLMModel } from "@/types";
import { Message } from "@/types/message";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function ChatPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: chatId } = useParams<{ id: string }>();
  const { user } = useSession();
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [text, setText] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const {
    sendMessage,
    isStreaming,
    messages,
    dispatch,
    newChatId,
    setNewChatId,
  } = useChatStream();

  const { data: llmModels, isLoading: isLoadingModels, error: errorModels } = useQuery({
    queryKey: ["llm-models"],
    queryFn: () => llmApi.getAll(),
    staleTime: 1000 * 60 * 5,
  });

  const getChatHistory = useCallback((id: string) => {
    setIsLoadingHistory(true);
    setNewChatId(null);

    return chatsApi
      .getHistory(Number(id))
      .then((response) => {
        dispatch({
          type: "SET_MESSAGES",
          payload: response.data.messages as Message[],
        });
      })
      .catch((err) => {
        console.error("Failed to load chat history:", err);
        toast({
          title: "Error",
          description: "Could not load chat history.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsLoadingHistory(false);
      });
  }, []);

  useEffect(() => {
    if (Array.isArray(llmModels) && llmModels.length > 0) {
      const _selectedModel =
        llmModels?.find((model) => model.code === "llama3.1:8b") ||
        llmModels?.[0];

      setSelectedModel({
        id: _selectedModel.id,
        name: _selectedModel.name,
        description: _selectedModel.description,
        logo: _selectedModel.logo,
        code: _selectedModel.code,
        instruct: _selectedModel.instruct,
      });
    }
  }, [llmModels]);

  const handleRegenerateMessage = (messageId: string) => { };

  useEffect(() => {
    if (newChatId == chatId) {
      return;
    }
    setNewChatId(null);

    dispatch({
      type: "SET_MESSAGES",
      payload: [] as Message[],
    });

    if (chatId) {
      getChatHistory(chatId);
    }
  }, [newChatId, chatId]);

  useEffect(() => {
    if (location.pathname === "/chat") {
      setNewChatId(null);
      dispatch({
        type: "SET_MESSAGES",
        payload: [] as Message[],
      });
    }
  }, [location]);

  const handleSend = (text: string) => {
    if (!selectedModel) {
      toast({
        title: "No Model Selected",
        description: "Please select a model before sending a message.",
      });
      return;
    }

    sendMessage(text, chatId, selectedModel.code);
  };

  const handleSelectSuggestion = (text: string) => {
    setText(text);
  };

  return (
    <div className="relative flex h-screen">
      <ChatSidebar currentChatId={chatId} />
      <div className="flex flex-col flex-1 overflow-hidden">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center flex-1">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-gray-500">Loading conversation...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ChatList
              messages={messages}
              isStreaming={isStreaming}
              onRegenerateMessage={handleRegenerateMessage}
              onSelectSuggestion={handleSelectSuggestion}
            />
          </div>
        )}

        <ChatInput
          models={llmModels}
          selectedModel={selectedModel}
          isLoading={isLoadingModels}
          error={errorModels?.message}
          text={text}
          setText={setText}
          onModelChange={(model) => setSelectedModel(model)}
          onSend={handleSend}
          disabled={isStreaming || isLoadingModels}
          showModelSelector={user?.is_dev_mode}
        />
      </div>
    </div>
  );
}
