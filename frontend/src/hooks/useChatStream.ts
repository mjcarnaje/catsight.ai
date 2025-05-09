// hooks/useChatStream.ts
import { generateId } from "@/lib/utils";
import { useRef, useCallback, useState, useEffect } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { Chat } from "@/types";

interface Delta {
  chat_id?: string;
  content?: string;
  error?: string;
  delta?: any;
}

export function useChatStream(
  chatId: string | undefined,
  modelId: string | null,
  dispatch: React.Dispatch<any>
) {
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  // Keep track of current state for message processing
  const currentMessagesRef = useRef<any[]>([]);
  // Track if we're waiting for an AI response
  const waitingForResponseRef = useRef<boolean>(false);
  // Store the last user message to preserve it during navigation
  const lastUserMessageRef = useRef<any>(null);
  // Track when we've started receiving actual content
  const hasStartedContentRef = useRef<boolean>(false);
  // Keep track of processed message IDs to avoid duplicates
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  // Store the latest sources from tool messages
  const latestSourcesRef = useRef<any[]>([]);
  // Store the latest assistant message ID
  const lastAssistantMessageIdRef = useRef<string | null>(null);
  // Get the chat context functions
  const { updateChatTitle, addNewChat } = useChatContext();

  const send = useCallback(
    (userText: string) => {
      if (!modelId) {
        dispatch({ type: "SET_ERROR", error: "Please select a model first" });
        return;
      }

      // abort previous
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsStreaming(true);
      // Set waiting for response flag
      waitingForResponseRef.current = true;
      // Reset content started flag
      hasStartedContentRef.current = false;
      // Clear processed message IDs on new message
      processedMessageIdsRef.current.clear();
      // Clear sources when sending a new message
      latestSourcesRef.current = [];
      // Reset last assistant message ID
      lastAssistantMessageIdRef.current = null;

      // dispatch user message
      const userMessage = {
        id: generateId(),
        role: "user",
        content: userText,
        timestamp: new Date().toISOString(),
      };

      // Store the user message for possible navigation
      lastUserMessageRef.current = userMessage;

      dispatch({
        type: "ADD_USER",
        payload: userMessage,
      });

      // Update our reference of current messages
      currentMessagesRef.current = [...currentMessagesRef.current, userMessage];

      // select endpoint
      const url = `${import.meta.env.VITE_API_URL}/api/documents/chat`;

      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          query: userText,
          model_id: modelId,
          chat_id: chatId,
        }),
        signal: ctrl.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentChatId = null;

          function readChunk(): Promise<void> {
            return reader.read().then(({ done, value }) => {
              if (done) {
                setIsStreaming(false);
                // Reset waiting for response flag
                waitingForResponseRef.current = false;
                return;
              }
              buffer += decoder.decode(value, { stream: true });

              // split on double-newline (SSE)
              const parts = buffer.split("\n\n");
              buffer = parts.pop()!;

              for (const part of parts) {
                // Extract event type and data
                const eventMatch = part.match(/^event:\s*(\w+)/m);
                const dataMatch = part.match(/^data:\s*(.*)$/m);

                if (!eventMatch || !dataMatch) continue;

                const eventType = eventMatch[1];
                const dataLine = dataMatch[1];

                let data: any = {};
                try {
                  data = JSON.parse(dataLine);
                } catch (e) {
                  console.error(
                    `Failed to parse ${eventType} data:`,
                    dataLine,
                    e
                  );
                  continue;
                }

                // Process each event type
                if (eventType === "start") {
                  try {
                    // Parse the data object (it might be empty {})
                    const startData =
                      typeof dataLine === "string"
                        ? JSON.parse(dataLine)
                        : data;

                    // If chat_id is present and either we don't have one or it's different
                    if (
                      startData.chat_id &&
                      (!chatId || startData.chat_id !== chatId)
                    ) {
                      currentChatId = startData.chat_id;
                      console.log(
                        `New chat created: ${startData.chat_id}, navigating...`
                      );

                      // Create a temporary chat object to immediately display in the sidebar
                      const newChat: Chat = {
                        id: Number(startData.chat_id),
                        title: "Untitled " + startData.chat_id, // Temporary title will be updated later
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };

                      // Add the new chat to the context
                      addNewChat(newChat);

                      // If we have a last user message, include it in navigation payload
                      if (lastUserMessageRef.current) {
                        // Dispatch navigate action with the new chat_id and last user message
                        dispatch({
                          type: "NAVIGATE",
                          payload: {
                            chatId: startData.chat_id,
                            userMessage: lastUserMessageRef.current,
                          },
                        });
                      } else {
                        // Navigate without user message if none exists
                        dispatch({
                          type: "NAVIGATE",
                          payload: { chatId: startData.chat_id },
                        });
                      }

                      // Don't create a placeholder message yet, wait for navigation to complete
                      continue;
                    }

                    console.log(
                      `Chat started: ${
                        chatId || startData.chat_id || "unknown"
                      }`
                    );
                  } catch (e) {
                    console.error("Error handling start event:", e);
                  }

                  // Don't create the assistant message placeholder here anymore
                  // The loading indicator in the chat list will show instead
                } else if (
                  eventType === "sources" &&
                  data.message_id &&
                  data.sources
                ) {
                  // This is a new event specifically for updating sources on an existing message
                  console.log("Received sources event:", data);

                  if (data.sources && Array.isArray(data.sources)) {
                    latestSourcesRef.current = data.sources;

                    // Find the message to update (could be by ID or just the last assistant message)
                    const messageToUpdate =
                      lastAssistantMessageIdRef.current ||
                      (currentMessagesRef.current.length > 0
                        ? currentMessagesRef.current[
                            currentMessagesRef.current.length - 1
                          ].id
                        : null);

                    if (messageToUpdate) {
                      // Update the message with sources
                      dispatch({
                        type: "REPLACE_ASSISTANT",
                        payload: {
                          id: messageToUpdate,
                          content:
                            currentMessagesRef.current.find(
                              (m) => m.id === messageToUpdate
                            )?.content || "",
                          sources: data.sources,
                        },
                      });

                      // Also update our reference
                      currentMessagesRef.current =
                        currentMessagesRef.current.map((msg) =>
                          msg.id === messageToUpdate
                            ? { ...msg, sources: data.sources }
                            : msg
                        );
                    }
                  }
                } else if (eventType === "content" && data.content) {
                  // If this is the first content being received, create the assistant message
                  if (!hasStartedContentRef.current) {
                    hasStartedContentRef.current = true;

                    // Create empty assistant message placeholder
                    const newAssistantMessage = {
                      id: generateId(),
                      role: "assistant",
                      content: data.content, // Start with the first content
                      timestamp: new Date().toISOString(),
                    };

                    // Store the assistant message ID
                    lastAssistantMessageIdRef.current = newAssistantMessage.id;

                    // Update our reference
                    currentMessagesRef.current = [
                      ...currentMessagesRef.current,
                      newAssistantMessage,
                    ];

                    dispatch({
                      type: "START_ASSISTANT",
                      payload: newAssistantMessage,
                    });
                  } else {
                    // After we've started receiving content, just append
                    currentMessagesRef.current = currentMessagesRef.current.map(
                      (msg) =>
                        msg.role === "assistant" &&
                        msg ===
                          currentMessagesRef.current[
                            currentMessagesRef.current.length - 1
                          ]
                          ? { ...msg, content: msg.content + data.content }
                          : msg
                    );

                    dispatch({
                      type: "APPEND_ASSISTANT",
                      content: data.content,
                    });
                  }
                } else if (eventType === "update" && data.delta) {
                  // Debug log in development
                  if (process.env.NODE_ENV !== "production") {
                    console.log(
                      "Update delta received:",
                      JSON.stringify(data.delta)
                    );
                  }

                  // Handle the update delta type which contains state from LangGraph
                  const messages = data.delta?.messages || [];

                  // Check for tool messages with sources first
                  const toolMessages = messages.filter(
                    (msg) => msg.role === "tool" && msg.content
                  );

                  // Process any tool messages to extract sources
                  for (const toolMsg of toolMessages) {
                    try {
                      // Try to parse the content as JSON - this should contain the sources
                      const toolContent =
                        typeof toolMsg.content === "string"
                          ? JSON.parse(toolMsg.content)
                          : toolMsg.content;

                      // Store the sources if they exist and are in the expected format
                      if (
                        Array.isArray(toolContent) &&
                        toolContent.length > 0
                      ) {
                        latestSourcesRef.current = toolContent;
                      }
                    } catch (e) {
                      console.error("Error parsing tool message content:", e);
                    }
                  }

                  // Get only the AI messages from the received messages
                  const aiMessages = messages.filter(
                    (msg) => msg.role === "ai" && msg.content
                  );

                  if (aiMessages.length === 0) continue;

                  // Always use the last AI message with non-empty content
                  const latestAIMessage = aiMessages
                    .filter((msg) => msg.content && msg.content.trim() !== "")
                    .pop();

                  if (!latestAIMessage) continue;

                  // Generate a unique ID for the message if we haven't processed it already
                  // Use the content as part of the ID to ensure uniqueness
                  const messageContentHash = latestAIMessage.content.substring(
                    0,
                    20
                  );
                  const uniqueMessageId = `${
                    latestAIMessage.id || "ai"
                  }-${messageContentHash}`;

                  // If we've already processed this particular message content, skip it
                  if (processedMessageIdsRef.current.has(uniqueMessageId)) {
                    continue;
                  }

                  // Mark this message as processed
                  processedMessageIdsRef.current.add(uniqueMessageId);

                  // Check if we already have an assistant message
                  const lastMessage =
                    currentMessagesRef.current[
                      currentMessagesRef.current.length - 1
                    ];
                  const isLastMessageAssistant =
                    lastMessage && lastMessage.role === "assistant";

                  // Check for sources in the AI message itself or use our stored sources
                  const messageSources =
                    latestAIMessage.sources || latestSourcesRef.current;

                  if (!hasStartedContentRef.current) {
                    hasStartedContentRef.current = true;

                    // First meaningful AI response - create a new message
                    const newAssistantMessage = {
                      id: uniqueMessageId, // Use the unique ID we generated
                      role: "assistant",
                      content: latestAIMessage.content,
                      timestamp: new Date().toISOString(),
                      sources:
                        messageSources.length > 0 ? messageSources : undefined,
                    };

                    // Store the assistant message ID
                    lastAssistantMessageIdRef.current = uniqueMessageId;

                    // If last message is user, add new assistant message
                    if (!isLastMessageAssistant) {
                      currentMessagesRef.current = [
                        ...currentMessagesRef.current,
                        newAssistantMessage,
                      ];

                      dispatch({
                        type: "START_ASSISTANT",
                        payload: newAssistantMessage,
                      });
                    } else {
                      // Replace existing assistant message with new content
                      currentMessagesRef.current =
                        currentMessagesRef.current.map((msg, idx) =>
                          idx === currentMessagesRef.current.length - 1
                            ? {
                                ...msg,
                                content: latestAIMessage.content,
                                sources:
                                  messageSources.length > 0
                                    ? messageSources
                                    : msg.sources,
                              }
                            : msg
                        );

                      dispatch({
                        type: "REPLACE_ASSISTANT",
                        payload: {
                          id: lastMessage.id,
                          content: latestAIMessage.content,
                          sources:
                            messageSources.length > 0
                              ? messageSources
                              : lastMessage.sources,
                        },
                      });
                    }

                    // We've received a non-empty response
                    waitingForResponseRef.current = false;
                  } else {
                    // Update existing assistant message with new content
                    currentMessagesRef.current = currentMessagesRef.current.map(
                      (msg) =>
                        msg.role === "assistant" && msg === lastMessage
                          ? {
                              ...msg,
                              content: latestAIMessage.content,
                              sources:
                                messageSources.length > 0
                                  ? messageSources
                                  : msg.sources,
                            }
                          : msg
                    );

                    dispatch({
                      type: "REPLACE_ASSISTANT",
                      payload: {
                        id: lastMessage.id,
                        content: latestAIMessage.content,
                        sources:
                          messageSources.length > 0
                            ? messageSources
                            : lastMessage.sources,
                      },
                    });
                  }
                } else if (eventType === "error") {
                  const errorMsg = {
                    id: `err-${Date.now()}`,
                    role: "assistant",
                    content: `Error: ${data.error || "Unknown error"}`,
                    timestamp: new Date().toISOString(),
                  };

                  // Update our reference
                  currentMessagesRef.current = [
                    ...currentMessagesRef.current,
                    errorMsg,
                  ];

                  dispatch({
                    type: "SET_ERROR",
                    error: data.error || "Unknown error",
                  });
                  // Reset waiting flag on error
                  waitingForResponseRef.current = false;
                  // Also reset content started flag
                  hasStartedContentRef.current = false;
                } else if (eventType === "title" && dataMatch) {
                  try {
                    const titleData = JSON.parse(dataLine);
                    console.log("Title data:", titleData);
                    if (titleData.title && currentChatId) {
                      updateChatTitle(currentChatId, titleData.title);
                    }
                  } catch (e) {
                    console.error("Error parsing title event data:", e);
                  }
                }
              }
              return readChunk();
            });
          }
          return readChunk();
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            dispatch({ type: "SET_ERROR", error: err.message });
            setIsStreaming(false);
            // Reset waiting flag on error
            waitingForResponseRef.current = false;
            // Also reset content started flag
            hasStartedContentRef.current = false;
          }
        });
    },
    [chatId, modelId, dispatch, updateChatTitle, addNewChat]
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  return { send, isStreaming };
}
