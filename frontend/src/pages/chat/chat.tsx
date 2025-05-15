import { ChatInput } from "@/components/chat/chat-input";
import { ChatList } from "@/components/chat/chat-list";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useToast } from "@/components/ui/use-toast";
import { useChatStream } from "@/contexts/chat-stream-context";
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

  const { data: llmModels, isLoading: isLoadingModels } = useQuery({
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
        const historyData = response.data;
        if (historyData.messages && historyData.messages.length > 0) {
          if (historyData.model_id) {
            setSelectedModel({
              id: historyData.model_id,
              name: historyData.model_id,
              description: "",
              logo: "",
            });

            llmApi
              .getAll()
              .then((models) => {
                const foundModel = models.find(
                  (m) => m.code === historyData.model_id
                );
                if (foundModel) {
                  setSelectedModel({
                    id: foundModel.code,
                    name: foundModel.name,
                    description: foundModel.description,
                    logo: foundModel.logo,
                  });
                }
              })
              .catch((err) => {
                console.error("Failed to get model details:", err);
              });
          }
          dispatch({
            type: "SET_MESSAGES",
            payload: historyData.messages as Message[],
          });
        }
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
        id: _selectedModel.code,
        name: _selectedModel.name,
        description: _selectedModel.description,
        logo: _selectedModel.logo,
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

    sendMessage(text, chatId, selectedModel.id);
  };

  const handleSelectSuggestion = (text: string) => {
    setText(text);
  };

  return (
    <div className="relative flex h-screen">
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          "[background-size:40px_40px]",
          "[background-image:radial-gradient(#d4d4d4_1px,transparent_1px)]",
          "z-0"
        )}
      />
      <ChatSidebar currentChatId={chatId} />
      <div className="flex flex-col flex-1 overflow-hidden">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center flex-1">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
              <p className="text-sm text-gray-500">Loading conversation...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <ChatList
              messages={messages}
              isStreaming={isStreaming}
              onRegenerateMessage={handleRegenerateMessage}
              onSelectSuggestion={handleSelectSuggestion}
            />
          </div>
        )}
        <ChatInput
          modelId={selectedModel?.id}
          text={text}
          setText={setText}
          onModelChange={(model) => setSelectedModel(model)}
          onSend={handleSend}
          disabled={isStreaming || isLoadingModels}
        />
      </div>
    </div>
  );
}
