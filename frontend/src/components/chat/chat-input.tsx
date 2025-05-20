// ChatInput.tsx
import { DocumentSelector } from "@/components/chat/document-selector";
import { ModelSelector } from "@/components/chat/model-selector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DocumentStatus, getStatusConfig } from "@/lib/document-status-config";
import { cn } from "@/lib/utils";
import { Document, LLMModel } from "@/types";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Circle,
  Clock,
  FileSearch,
  FileText,
  Flame as FlameIcon,
  Loader2,
  Network,
  Paperclip,
  Send,
  Server,
  Sparkles,
  X
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useToast } from "../ui/use-toast";

interface ChatInputProps {
  text: string;
  setText: (text: string) => void;
  onModelChange: (model: LLMModel | null) => void;
  onSend: (text: string) => void;
  onFileUpload: (files: File[]) => void;
  onCheckDuplicates?: (files: File[]) => Promise<{ hasDuplicates: boolean, duplicateFiles: string[] }>;
  disabled: boolean;
  showModelSelector: boolean;
  models: LLMModel[];
  selectedModel: LLMModel | null;
  isLoading: boolean;
  error: string | null;
  uploadProgress?: number;
  uploadingFiles?: File[];
  uploadedFiles?: {
    id: number;
    filename: string;
    status?: DocumentStatus;
  }[];
  processingDocuments?: boolean;
  selectedDocs?: Document[];
  onSelectDocument?: (doc: Document) => void;
  onRemoveDocument?: (docId: number) => void;
  onRemoveUploadedFile?: (docId: number) => void;
}

export function ChatInput({
  text,
  setText,
  onModelChange,
  onSend,
  onFileUpload,
  onCheckDuplicates,
  disabled,
  showModelSelector,
  models,
  selectedModel,
  isLoading,
  error,
  uploadProgress = 0,
  uploadingFiles = [],
  uploadedFiles = [],
  processingDocuments = false,
  selectedDocs = [],
  onSelectDocument,
  onRemoveDocument,
  onRemoveUploadedFile,
}: ChatInputProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_FILE_SIZE = 500 * 1024; // 500 KB
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  const onSubmit = useCallback(() => {
    if (!text.trim() || !selectedModel) return;
    onSend(text.trim());
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, selectedModel, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  };

  const handleModelChange = (model: LLMModel | null) => {
    onModelChange(model);
  };

  const proceedWithUpload = (files: File[]) => {
    onFileUpload(files);
    setFilesToUpload([]);
  };

  const removeDuplicateFiles = () => {
    const duplicateSet = new Set(duplicateFiles);
    const filteredFiles = filesToUpload.filter(file => !duplicateSet.has(file.name));
    setShowDuplicateAlert(false);
    proceedWithUpload(filteredFiles);
  };

  const onDrop = useCallback(
    async (
      acceptedFiles: File[],
      rejectedFiles: Array<{
        file: File;
        errors: Array<{ code: string; message: string }>;
      }>
    ) => {
      // Filter files by size
      const validFiles = acceptedFiles.filter(
        (file) => file.size <= MAX_FILE_SIZE
      );
      const oversizedFiles = acceptedFiles.filter(
        (file) => file.size > MAX_FILE_SIZE
      );

      if (oversizedFiles.length > 0) {
        toast({
          title: "File too large",
          description: `Files must be under 500KB. ${oversizedFiles
            .map((f) => f.name)
            .join(", ")} exceeded the limit.`,
          variant: "destructive",
        });
      }

      if (rejectedFiles.length > 0) {
        toast({
          title: "Invalid file type",
          description: "Only PDF files are supported.",
          variant: "destructive",
        });
      }

      if (validFiles.length > 0) {
        if (onCheckDuplicates) {
          const { hasDuplicates, duplicateFiles } = await onCheckDuplicates(validFiles);
          if (hasDuplicates) {
            setDuplicateFiles(duplicateFiles);
            setFilesToUpload(validFiles);
            setShowDuplicateAlert(true);
            return;
          }
        }
        // If no duplicates or no duplicate check required, proceed with upload
        proceedWithUpload(validFiles);
      }
    },
    [toast, onFileUpload, onCheckDuplicates]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    noClick: true,
    noKeyboard: true,
    disabled: disabled || !!uploadingFiles.length || processingDocuments,
  });

  const getFileSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAddDocument = (doc: Document) => {
    if (onSelectDocument) {
      onSelectDocument(doc);
    }
  };

  const handleRemoveDocument = (docId: number) => {
    if (onRemoveDocument) {
      onRemoveDocument(docId);
    }
  };

  return (
    <>
      <div className="relative z-10 w-full max-w-4xl px-5 py-5 mx-auto bg-white border-t border-gray-100 shadow-md rounded-t-3xl">
        {!selectedModel && !disabled && (
          <div className="flex items-center gap-2 p-3 mb-4 text-sm border rounded-lg bg-amber-50 border-amber-200 text-amber-800">
            <AlertCircle size={16} className="shrink-0" />
            <span>Please select a model to continue</span>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-4">
            {uploadedFiles.map((file) => (
              <UploadedFile
                key={file.id}
                id={file.id}
                filename={file.filename}
                status={file.status}
                onRemove={onRemoveUploadedFile}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="relative flex items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              className="relative flex items-end flex-1"
              {...getRootProps()}
            >
              <div
                className={cn(
                  "relative flex-1 overflow-hidden rounded-2xl border border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-sm transition-all",
                  disabled ? "opacity-60" : "",
                  isDragActive
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "",
                  uploadingFiles.length > 0 || processingDocuments
                    ? "opacity-60"
                    : ""
                )}
              >
                <input {...getInputProps()} />
                <Textarea
                  ref={textareaRef}
                  placeholder={
                    isDragActive
                      ? "Drop your files here..."
                      : "Ask a question or send a message..."
                  }
                  value={text}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  disabled={disabled || !selectedModel || processingDocuments}
                  className="w-full py-3 px-4 pr-14 min-h-[56px] max-h-[200px] resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-gray-400"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={
                    disabled ||
                    !selectedModel ||
                    !text.trim() ||
                    uploadingFiles.length > 0 ||
                    processingDocuments
                  }
                  className="absolute w-10 h-10 text-white transition-colors shadow-sm bg-primary right-2 bottom-2 rounded-xl hover:bg-primary/90 disabled:opacity-50"
                >
                  {disabled ||
                    uploadingFiles.length > 0 ||
                    processingDocuments ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <span className="sr-only">Send message</span>
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf";
                    input.multiple = true;
                    input.onchange = (event) => {
                      const files = Array.from(
                        (event.target as HTMLInputElement).files || []
                      );
                      onDrop(files, []);
                    };
                    input.click();
                  }}
                  disabled={
                    disabled || uploadingFiles.length > 0 || processingDocuments
                  }
                  className="absolute w-8 h-8 text-gray-500 transition-colors right-14 bottom-3 hover:text-primary disabled:opacity-50"
                >
                  <Paperclip className="w-5 h-5" />
                  <span className="sr-only">Attach file</span>
                </Button>

                <div className="absolute right-24 bottom-3">
                  <DocumentSelector
                    selectedDocs={selectedDocs}
                    onSelect={handleAddDocument}
                    onRemove={handleRemoveDocument}
                    disabled={disabled || processingDocuments}
                    iconOnly={true}
                  />
                </div>
              </div>
            </form>

            <div className="flex items-center gap-2 shrink-0">
              {showModelSelector && (
                <div className="shrink-0">
                  <ModelSelector
                    models={models}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    isLoading={isLoading}
                    error={error}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Sparkles className="w-3 h-3" />
              <span>
                AI can make mistakes. Consider checking important information.
              </span>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Files Detected</AlertDialogTitle>
            <AlertDialogDescription>
              The following files have similar names to existing documents:
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                {duplicateFiles.map((file, index) => (
                  <li key={index} className="text-sm">{file}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={removeDuplicateFiles}>
              Remove Duplicates
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowDuplicateAlert(false);
              proceedWithUpload(filesToUpload);
            }}>
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface UploadedFileProps {
  filename: string;
  status?: DocumentStatus;
  id: number;
  onRemove?: (id: number) => void;
}

const UploadedFile = ({
  filename,
  status = DocumentStatus.PROCESSING,
  id,
  onRemove,
}: UploadedFileProps) => {
  const statusInfo = getStatusConfig(status);

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.PENDING:
        return <Clock className="w-4 h-4" />;
      case DocumentStatus.PROCESSING:
        return <FlameIcon className="w-4 h-4" />;
      case DocumentStatus.TEXT_EXTRACTING:
        return <FileSearch className="w-4 h-4" />;
      case DocumentStatus.TEXT_EXTRACTION_DONE:
        return <FileText className="w-4 h-4" />;
      case DocumentStatus.GENERATING_SUMMARY:
        return <Brain className="w-4 h-4" />;
      case DocumentStatus.SUMMARY_GENERATION_DONE:
        return <Sparkles className="w-4 h-4" />;
      case DocumentStatus.EMBEDDING_TEXT:
        return <Server className="w-4 h-4" />;
      case DocumentStatus.TEXT_EMBEDDING_DONE:
        return <Network className="w-4 h-4" />;
      case DocumentStatus.COMPLETED:
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  const StatusIcon = getStatusIcon(status);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-3 text-sm border rounded-lg group transition-all duration-200",
        "hover:shadow-sm hover:border-opacity-80",
        statusInfo.bg,
        statusInfo.border,
        statusInfo.text
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden max-w-[70%]">
        <div
          className={cn(
            "p-2 rounded-md bg-white/30 shadow-sm",
            statusInfo.showLoading && "animate-pulse"
          )}
        >
          {StatusIcon}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-sm font-medium truncate max-w-[100px]" title={filename}>
            {filename}
          </span>
          <div className="flex items-center gap-1">
            {statusInfo.showLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : null}
            <span className="text-xs truncate opacity-80">
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onRemove && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onRemove(id)}
            className={cn(
              "w-7 h-7 p-0 rounded-full",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
              "hover:bg-white/20 hover:text-red-500"
            )}
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        )}
      </div>
    </div>
  );
};
