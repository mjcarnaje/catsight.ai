// pages/ChatPage.tsx
import { ChatInput } from "@/components/chat/chat-input";
import { ChatList } from "@/components/chat/chat-list";
import { chatReducer, Message } from "@/components/chat/chat-reducer";
import { Model } from "@/components/chat/model-selector";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useToast } from "@/components/ui/use-toast";
import { useChatStream } from "@/hooks/useChatStream";
import React, { useEffect, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { llmApi, chatsApi } from "@/lib/api";

export default function ChatPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: chatId } = useParams<{ id: string }>();
  const [messages, dispatch] = useReducer(chatReducer, [] as Message[]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  // Ref to store the last user message during navigation
  const pendingUserMessageRef = useRef<Message | null>(null);

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
    console.log("Location or chatId changed:", location.pathname);

    // Clear existing messages when we navigate to a different chat
    dispatch({
      type: "SET_CLEAR_MESSAGES",
      payload: [] as Message[],
    });

    // If we have a chatId, load that chat's history
    if (chatId) {
      loadChatHistory(chatId);
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

    // First, try to load chat history from LangGraph state
    chatsApi
      .getHistory(Number(id))
      .then((response) => {
        const historyData = response.data;

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
              id: msg.id,
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
                  });
                }
              })
              .catch((err) => {
                console.error("Failed to get model details:", err);
              });
          }

          // Stop loading and return early if we got messages
          setIsLoadingHistory(false);
          return;
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
  };

  const handleSend = (text: string) => {
    if (!selectedModel) {
      toast({
        title: "No Model Selected",
        description: "Please select a model before sending a message.",
      });
      return;
    }
    send(text);
  };

  return (
    <div className="flex h-screen">
      <ChatSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="flex flex-col h-full">
            <ChatList
              messages={messages}
              isStreaming={isStreaming}
              onRegenerateMessage={handleRegenerateMessage}
            />
          </div>
        </div>
        <div className="px-4 py-2 bg-gray-50">
          <div className="w-full max-w-4xl mx-auto">
            <ChatInput
              modelId={selectedModel?.id}
              onModelChange={setSelectedModel}
              onSend={handleSend}
              disabled={isStreaming || isLoadingModels}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
