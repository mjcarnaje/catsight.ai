"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/contexts/session-context";
import { cn } from "@/lib/utils";
import { LLMModel } from "@/types";
import {
  AlertCircle,
  Check,
  ChevronDownIcon,
  FileIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { MARKDOWN_CONVERTERS } from "../lib/markdown-converter";
import { ModelSelector } from "./chat/model-selector";
import { documentsApi, llmApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./ui/use-toast";

interface UploadDocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDocumentsModal({
  open,
  onOpenChange,
}: UploadDocumentsModalProps) {
  const { toast } = useToast();
  const { user } = useSession();
  const [selectedConverter, setSelectedConverter] = useState<
    "marker" | "markitdown" | "docling" | undefined
  >();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const {
    data: llmModels,
    isLoading: isLoadingModels,
    error: errorModels,
  } = useQuery({
    queryKey: ["llm-models"],
    queryFn: () => llmApi.getAll(),
    staleTime: 1000 * 60 * 5,
  });

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

  const uploadMutation = useMutation({
    mutationFn: ({
      files,
      markdown_converter,
      summarization_model,
      onProgress,
    }: {
      files: File[];
      markdown_converter?: string;
      summarization_model?: string;
      onProgress?: (progress: number) => void;
    }) =>
      documentsApi.upload(
        files,
        markdown_converter,
        summarization_model,
        onProgress
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
      setSelectedFiles([]);
      toast({
        title: "Success",
        description: "Documents uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback(
    (
      acceptedFiles: File[],
      rejectedFiles: Array<{
        file: File;
        errors: Array<{ code: string; message: string }>;
      }>
    ) => {
      if (rejectedFiles.length > 0) {
        setFileError("Some files were rejected. Please check file types.");
      } else {
        setFileError(null);
      }
      setSelectedFiles((prev) => [...prev, ...acceptedFiles]);
    },
    []
  );

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  const checkForDuplicateFiles = async () => {
    try {
      const fileNames = selectedFiles.map(file => file.name);
      const response = await documentsApi.checkIfHasSimilarFilename(fileNames);

      if (response.data.has_similar_filename) {
        setDuplicateFiles(response.data.similar_files);
        setShowDuplicateAlert(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking for similar filenames:", error);
      return false;
    }
  };

  const removeDuplicateFiles = () => {
    const duplicateSet = new Set(duplicateFiles);
    const filteredFiles = selectedFiles.filter(file => !duplicateSet.has(file.name));
    setSelectedFiles(filteredFiles);
    setShowDuplicateAlert(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length > 0) {
      const hasDuplicates = await checkForDuplicateFiles();

      if (hasDuplicates) {
        return; // Stop here and wait for user decision
      }

      // If no duplicates, proceed with upload
      proceedWithUpload();
    }
  };

  const proceedWithUpload = () => {
    uploadMutation.mutate({
      files: selectedFiles,
      markdown_converter: selectedConverter,
      summarization_model: selectedModel?.code,
      onProgress: (progress) => setUploadProgress(progress),
    });
  };

  const getFileSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeIcon = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return <FileIcon className="w-4 h-4 text-red-500" />;
      case "txt":
        return <FileIcon className="w-4 h-4 text-blue-500" />;
      case "doc":
      case "docx":
        return <FileIcon className="w-4 h-4 text-indigo-500" />;
      default:
        return <FileIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleModelChange = (model: LLMModel) => {
    setSelectedModel(model);
  };

  const SelectedConverterIcon = selectedConverter
    ? MARKDOWN_CONVERTERS[selectedConverter].icon
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !uploadMutation.isPending && onOpenChange(value)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Choose your converter and upload your documents.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {user?.is_dev_mode && (
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Markdown Converter (Optional)
                </label>
                <Popover
                  open={popoverOpen}
                  onOpenChange={setPopoverOpen}
                  modal={true}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      role="combobox"
                      aria-expanded={popoverOpen}
                      className={cn(
                        "justify-between w-full h-10 transition-all",
                        {
                          "font-normal text-gray-500": !selectedConverter,
                          "ring-1 ring-primary": selectedConverter,
                        }
                      )}
                      type="button"
                      disabled={uploadMutation.isPending}
                    >
                      <div className="flex items-center">
                        {SelectedConverterIcon && (
                          <SelectedConverterIcon
                            className={cn("w-4 h-4 mr-2", {
                              "text-primary": selectedConverter === "marker",
                              "text-amber-500":
                                selectedConverter === "markitdown",
                              "text-emerald-500":
                                selectedConverter === "docling",
                            })}
                          />
                        )}
                        {selectedConverter
                          ? MARKDOWN_CONVERTERS[selectedConverter].label
                          : "Select Converter"}
                      </div>
                      <ChevronDownIcon className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] rounded-lg border p-0 shadow-lg">
                    <Command>
                      <CommandGroup>
                        <CommandList>
                          {Object.values(MARKDOWN_CONVERTERS).map(
                            (converter) => (
                              <CommandItem
                                key={converter.value}
                                value={converter.value}
                                onSelect={(currentValue) => {
                                  setSelectedConverter(
                                    currentValue as
                                    | "marker"
                                    | "markitdown"
                                    | "docling"
                                    | undefined
                                  );
                                  setPopoverOpen(false);
                                }}
                                className="flex flex-col items-start p-3 transition-colors cursor-pointer hover:bg-primary/5"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center">
                                    {converter.icon && (
                                      <converter.icon
                                        className={cn("w-4 h-4 mr-2", {
                                          "text-primary":
                                            converter.value === "marker",
                                          "text-amber-500":
                                            converter.value === "markitdown",
                                          "text-emerald-500":
                                            converter.value === "docling",
                                        })}
                                      />
                                    )}
                                    <span className="font-medium">
                                      {converter.label}
                                    </span>
                                  </div>
                                  {selectedConverter === converter.value && (
                                    <Check className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {converter.description}
                                </p>
                                <div className="flex gap-1 mt-2">
                                  {converter.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="outline"
                                      className={cn("text-xs", {
                                        "bg-green-50 border-green-200 text-green-700":
                                          tag === "accurate",
                                        "bg-blue-50 border-blue-200 text-blue-700":
                                          tag === "fast" || tag === "reliable",
                                        "bg-yellow-50 border-yellow-200 text-yellow-700":
                                          tag === "slow" || tag === "slower",
                                        "bg-indigo-50 border-indigo-200 text-indigo-700":
                                          tag === "detailed" ||
                                          tag === "semantic",
                                        "bg-gray-50 border-gray-200 text-gray-700":
                                          tag === "lightweight",
                                      })}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </CommandItem>
                            )
                          )}
                        </CommandList>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Summarization Model (Optional)
                </label>
                <ModelSelector
                  models={llmModels}
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  isLoading={isLoadingModels}
                  error={errorModels?.message}
                />
              </div>
            </div>
          )}

          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg cursor-pointer p-8 hover:border-primary/50 transition-all duration-200",
              "flex flex-col items-center justify-center text-center",
              isDragActive
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "hover:bg-muted/50 hover:scale-[1.01]",
              uploadMutation.isPending && "pointer-events-none opacity-60"
            )}
          >
            <input {...getInputProps()} />
            <Upload
              className={cn(
                "w-10 h-10 mb-4",
                isDragActive ? "text-primary animate-bounce" : "opacity-70"
              )}
            />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop files to upload" : "Drag & drop files here"}
            </p>
            <p className="mt-1 text-xs opacity-70">
              or click to browse from your computer
            </p>
            <p className="mt-2 text-xs opacity-70">Supports PDF files</p>
          </div>

          {fileError && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{fileError}</AlertDescription>
              <Button
                variant="ghost"
                size="icon"
                className="absolute w-6 h-6 right-2 top-2"
                onClick={() => setFileError(null)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Alert>
          )}

          {selectedFiles.length > 0 && (
            <div className="overflow-hidden transition-all border rounded-md bg-muted/50">
              <div className="p-3">
                <p className="flex items-center justify-between text-sm font-medium">
                  Selected files ({selectedFiles.length})
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs h-7"
                    onClick={() => setSelectedFiles([])}
                    disabled={uploadMutation.isPending}
                  >
                    Clear all
                  </Button>
                </p>
              </div>
              <div className="overflow-y-auto max-h-40">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-2 text-sm transition-colors border-t hover:bg-muted"
                  >
                    <div className="flex items-center space-x-2 overflow-hidden">
                      {getFileTypeIcon(file)}
                      <span className="truncate max-w-[180px]">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {getFileSize(file.size)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-7 w-7"
                      onClick={() => removeFile(index)}
                      disabled={uploadMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadMutation.isPending && (
            <div className="space-y-2 animate-in fade-in">
              <div className="flex justify-between mb-1 text-xs">
                <span>Uploading {selectedFiles.length} files...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1.5" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploadMutation.isPending}
            className="transition-all"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
            className={cn(
              "transition-all",
              uploadMutation.isPending && "bg-primary/80"
            )}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Upload
                {selectedFiles.length > 0 && (
                  <span className="ml-1">({selectedFiles.length})</span>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

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
              proceedWithUpload();
            }}>
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
