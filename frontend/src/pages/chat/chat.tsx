// pages/ChatPage.tsx
import { ChatInput } from "@/components/chat/chat-input";
import { ChatList } from "@/components/chat/chat-list";
import { chatReducer, Message } from "@/components/chat/chat-reducer";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useToast } from "@/components/ui/use-toast";
import { useChatStream } from "@/hooks/useChatStream";
import React, { useEffect, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { llmApi, chatsApi } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { ModelInfo } from "@/types";

export default function ChatPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: chatId } = useParams<{ id: string }>();
  const [messages, dispatch] = useReducer(chatReducer, [] as Message[]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  // Ref to store the last user message during navigation
  const pendingUserMessageRef = useRef<Message | null>(null);
  // Track if we're in a new chat with no history
  const [isNewChat, setIsNewChat] = useState<boolean>(true);
  // Track the previous chatId for comparison
  const previousChatIdRef = useRef<string | undefined>(chatId);
  // Track if this is the initial load with no chatId
  const isInitialLoad = useRef<boolean>(true);

  const { send, isStreaming } = useChatStream(
    chatId,
    selectedModel?.id,
    (action) => {
      if (action.type === "NAVIGATE") {
        // Check if we have a complex payload with chatId and userMessage
        const isComplexPayload =
          typeof action.payload === "object" && action.payload !== null;
        const newChatId = isComplexPayload
          ? action.payload.chatId
          : action.payload;
        const userMessage = isComplexPayload
          ? action.payload.userMessage
          : null;

        // Store the user message to add it after navigation if available
        if (userMessage) {
          pendingUserMessageRef.current = userMessage;
        }

        // Only navigate if we're not already on this chat
        if (newChatId !== chatId) {
          console.log(
            `Navigating from chat ${chatId} to ${newChatId} with user message:`,
            userMessage ? "yes" : "no"
          );
          navigate(`/chat/${newChatId}`, { replace: true });
        }
      } else {
        dispatch(action);
      }
    }
  );

  // Load models on component mount
  useEffect(() => {
    setIsLoadingModels(true);
    llmApi
      .getAll()
      .then((models) => {
        if (models.length > 0) {
          // Select the first model as default if no model is selected
          if (!selectedModel) {
            setSelectedModel({
              id: models[0].code,
              name: models[0].name,
              description: models[0].description,
              logo: models[0].logo
            });
          }
        }
      })
      .catch((err) => {
        toast({
          title: "Error",
          description: "Failed to load models. Please try again later.",
        });
        console.error("Failed to load models:", err);
      })
      .finally(() => {
        setIsLoadingModels(false);
      });
  }, []);

  // Load chat history on initial mount if chatId exists
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;

      if (chatId) {
        console.log("Initial load with chatId:", chatId);
        setIsLoadingHistory(true);
        setIsNewChat(false);
        loadChatHistory(chatId);
      } else {
        console.log("No chatId, this is a new chat");
        setIsNewChat(true);
        setIsLoadingHistory(false);
      }
    }
  }, [chatId]);

  // Handle regenerating a message
  const handleRegenerateMessage = (messageId: string) => {
    if (!selectedModel) {
      toast({
        title: "No Model Selected",
        description: "Please select a model before regenerating.",
      });
      return;
    }

    // Find the message with the given ID
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) {
      console.error("Message not found:", messageId);
      return;
    }

    // Find the last user message before this assistant message
    let lastUserMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex === -1) {
      toast({
        title: "Cannot Regenerate",
        description: "No user message found to regenerate from.",
      });
      return;
    }

    // Remove all messages after the last user message
    const userMessage = messages[lastUserMessageIndex];
    const newMessages = messages.slice(0, lastUserMessageIndex + 1);

    // Update the messages state
    dispatch({
      type: "SET_CLEAR_MESSAGES",
      payload: newMessages,
    });

    // Send the user message again to regenerate the response
    send(userMessage.content);
  };

  // Clear messages when navigating to a new chat
  useEffect(() => {
    if (isInitialLoad.current) {
      return; // Skip on initial load as we handle it in a separate effect
    }

    console.log("Location or chatId changed:", location.pathname);

    // Check if this is a different chat than before to trigger a full reset
    const isChangingChat = previousChatIdRef.current !== chatId;
    previousChatIdRef.current = chatId;

    if (isChangingChat) {
      console.log(`Changing from chat ${previousChatIdRef.current} to ${chatId}, clearing messages`);

      // Clear existing messages first
      dispatch({
        type: "SET_CLEAR_MESSAGES",
        payload: [] as Message[],
      });

      // Mark as loading
      setIsLoadingHistory(true);

      // If we have a chatId, load that chat's history
      if (chatId) {
        loadChatHistory(chatId);
      } else {
        // If no chatId, mark as a new chat and stop loading
        setIsNewChat(true);
        setIsLoadingHistory(false);
      }
    }
  }, [location.pathname, chatId]);

  // After loading chat history, restore any pending user message
  useEffect(() => {
    if (
      !isLoadingHistory &&
      pendingUserMessageRef.current &&
      messages.length === 0
    ) {
      console.log(
        "Adding pending user message after navigation:",
        pendingUserMessageRef.current.content
      );
      dispatch({
        type: "ADD_USER",
        payload: pendingUserMessageRef.current,
      });
      pendingUserMessageRef.current = null;
    }
  }, [isLoadingHistory, messages.length]);

  // Load existing chat history
  const loadChatHistory = (id: string) => {
    setIsLoadingHistory(true);
    setIsNewChat(false);

    console.log(`Loading chat history for ID: ${id}`);

    // First, try to load chat history from LangGraph state
    chatsApi
      .getHistory(Number(id))
      .then((response) => {
        const historyData = response.data;
        console.log("Received history data:", historyData);

        // Process messages from LangGraph history
        if (historyData.messages && historyData.messages.length > 0) {
          // Clear existing messages first
          dispatch({
            type: "SET_CLEAR_MESSAGES",
            payload: [] as Message[],
          });

          // Add each message from history to state
          historyData.messages.forEach((msg: any) => {
            const messagePayload: Message = {
              id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp || new Date().toISOString(),
              sources: msg.sources,
            };

            dispatch({
              type: msg.role === "user" ? "ADD_USER" : "START_ASSISTANT",
              payload: messagePayload,
            });
          });

          // Set the model from LangGraph history if available
          if (historyData.model_id) {
            // Get the full model from the API if needed, or just set the ID for now
            setSelectedModel({
              id: historyData.model_id,
              name: historyData.model_id, // Use the ID as name until we get full model details
              description: "",
              logo: ""
            });

            // Get the model details (optional)
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
                    logo: foundModel.logo
                  });
                }
              })
              .catch((err) => {
                console.error("Failed to get model details:", err);
              });
          }
        } else {
          // If no messages found, mark as a new chat
          console.log("No messages found in history, marking as new chat");
          setIsNewChat(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load chat history:", err);
        toast({
          title: "Error",
          description: "Could not load chat history.",
          variant: "destructive",
        });
        // If there's an error, still mark as a new chat
        setIsNewChat(true);
      })
      .finally(() => {
        setIsLoadingHistory(false);
      });
  };

  const handleSend = (text: string) => {
    if (!selectedModel) {
      toast({
        title: "No Model Selected",
        description: "Please select a model before sending a message.",
      });
      return;
    }
    // Set isNewChat to false since we're sending a message
    setIsNewChat(false);
    send(text);
  };

  // Handle selecting a suggestion question
  const handleSelectSuggestion = (text: string) => {
    if (!selectedModel) {
      toast({
        title: "No Model Selected",
        description: "Please select a model before sending a message.",
      });
      return;
    }
    // Set isNewChat to false since we're sending a message
    setIsNewChat(false);
    send(text);
  };

  return (
    <div className="flex h-screen bg-white">
      <ChatSidebar
        currentChatId={chatId}
      />
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
          onModelChange={setSelectedModel}
          onSend={handleSend}
          disabled={isStreaming || isLoadingModels}
        />
      </div>
    </div>
  );
}
