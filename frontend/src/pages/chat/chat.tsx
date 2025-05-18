import { ChatInput } from "@/components/chat/chat-input";
import { ChatList } from "@/components/chat/chat-list";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useToast } from "@/components/ui/use-toast";
import { useChatStream } from "@/contexts/chat-stream-context";
import { useSession } from "@/contexts/session-context";
import { chatsApi, documentsApi, llmApi } from "@/lib/api";
import { DocumentStatus } from "@/lib/document-status-config";
import { cn } from "@/lib/utils";
import { LLMModel } from "@/types";
import { Document } from "@/types";
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
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<
    {
      id: number;
      filename: string;
    }[]
  >([]);
  const [selectedDocs, setSelectedDocs] = useState<Document[]>([]);

  const {
    sendMessage,
    isStreaming,
    messages,
    dispatch,
    newChatId,
    setNewChatId,
  } = useChatStream();

  const {
    data: llmModels,
    isLoading: isLoadingModels,
    error: errorModels,
  } = useQuery({
    queryKey: ["llm-models"],
    queryFn: () => llmApi.getAll(),
    staleTime: 1000 * 60 * 5,
  });

  const uploadedFilesIds = uploadedFiles.map((file) => file.id);

  const { data: uploadedDocs, isLoading: isLoadingDocs } = useQuery({
    queryKey: ["uploaded-docs", uploadedFilesIds],
    queryFn: async () => {
      if (uploadedFilesIds.length === 0) return { documents: [] };
      return documentsApi.getByIds(uploadedFilesIds).then((res) => res.data);
    },
    enabled: uploadedFilesIds.length > 0,
    refetchInterval: uploadedFilesIds.length > 0 ? 2000 : false,
  });

  // Determine if documents are still processing
  const isProcessingDocuments =
    uploadedFilesIds.length > 0 &&
    (isLoadingDocs ||
      uploadedDocs?.documents?.some((doc) =>
        ["pending", "processing", "extracting_text", "chunking"].includes(
          doc.status
        )
      ));

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

    // Combine uploaded files and selected existing documents
    const uploadedFileIds = uploadedFiles.map((file) => file.id);
    const selectedDocIds = selectedDocs.map((doc) => doc.id);

    // Combine both arrays and remove duplicates
    const fileIds = [...new Set([...uploadedFileIds, ...selectedDocIds])];

    console.log("fileIds", fileIds);
    setUploadedFiles([]);
    setSelectedDocs([]);

    sendMessage(text, chatId, selectedModel.code, fileIds);
  };

  const handleSelectSuggestion = (text: string) => {
    setText(text);
  };

  const handleFileUpload = async (files: File[]) => {
    if (!files.length) return;

    setUploadingFiles(files);
    setUploadProgress(0);

    try {
      const response = await documentsApi.upload(
        files,
        undefined,
        undefined,
        (progress) => setUploadProgress(progress)
      );

      // Extract document IDs from successful uploads
      const successfulUploads = response.data
        .filter((item) => item.status === "success")
        .map((item) => ({ id: item.id, filename: item.filename }));

      if (successfulUploads.length > 0) {
        setUploadedFiles((prevState) => [...prevState, ...successfulUploads]);

        toast({
          title: "Files Uploaded",
          description: `Processing ${successfulUploads.length} file(s)...`,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: "No files were successfully uploaded.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Upload Error",
        description: "An error occurred while uploading files.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles([]);
    }
  };

  const handleSelectDocument = (doc: Document) => {
    setSelectedDocs((prev) => {
      // Check if document is already selected
      if (prev.some((d) => d.id === doc.id)) {
        return prev;
      }
      return [...prev, doc];
    });
  };

  const handleRemoveDocument = (docId: number) => {
    setSelectedDocs((prev) => prev.filter((doc) => doc.id !== docId));
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
          onFileUpload={handleFileUpload}
          disabled={isStreaming || isLoadingModels}
          showModelSelector={user?.is_dev_mode}
          uploadProgress={uploadProgress}
          uploadingFiles={uploadingFiles}
          processingDocuments={isProcessingDocuments}
          uploadedFiles={uploadedFiles.map((file) => {
            const uploadedDoc = uploadedDocs?.documents?.find(
              (doc) => doc.id === file.id
            );
            return {
              id: file.id,
              filename: uploadedDoc?.file_name || file.filename,
              isProcessing:
                uploadedDoc?.status !== DocumentStatus.COMPLETED,
            };
          })}
          selectedDocs={selectedDocs}
          onSelectDocument={handleSelectDocument}
          onRemoveDocument={handleRemoveDocument}
        />
      </div>
    </div>
  );
}
