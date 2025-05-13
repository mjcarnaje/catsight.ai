"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertCircle, Check, ChevronDownIcon, FileIcon, Loader2, Trash2, Upload, X } from "lucide-react"
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { MARKDOWN_CONVERTERS } from "../lib/markdown-converter"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UploadDocumentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpload: (files: File[], markdown_converter: "marker" | "markitdown" | "docling") => void
  isUploading: boolean
}

export function UploadDocumentsModal({ open, onOpenChange, onUpload, isUploading }: UploadDocumentsModalProps) {
  const [selectedConverter, setSelectedConverter] = useState<"marker" | "markitdown" | "docling">("marker")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)

  // Simulate progress when uploading
  if (isUploading && uploadProgress < 95) {
    setTimeout(() => {
      setUploadProgress(prev => Math.min(prev + 5, 95))
    }, 200)
  } else if (!isUploading && uploadProgress > 0) {
    setUploadProgress(0)
  }

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: Array<{ file: File; errors: Array<{ code: string; message: string }> }>) => {
    if (rejectedFiles.length > 0) {
      setFileError("Some files were rejected. Please check file types.")
    } else {
      setFileError(null)
    }
    setSelectedFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  })

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      setUploadProgress(5) // Start progress
      onUpload(selectedFiles, selectedConverter)
      setSelectedFiles([]) // Clear selected files after upload
    }
  }

  const getFileSize = (size: number): string => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileTypeIcon = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()

    switch (extension) {
      case 'pdf':
        return <FileIcon className="w-4 h-4 text-red-500" />
      case 'txt':
        return <FileIcon className="w-4 h-4 text-blue-500" />
      case 'doc':
      case 'docx':
        return <FileIcon className="w-4 h-4 text-indigo-500" />
      default:
        return <FileIcon className="w-4 h-4 text-gray-500" />
    }
  }

  const SelectedConverterIcon = selectedConverter ? MARKDOWN_CONVERTERS[selectedConverter].icon : null

  return (
    <Dialog open={open} onOpenChange={(value) => !isUploading && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>Choose your converter and upload your documents.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Markdown Converter</label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className={cn("justify-between w-full h-12 transition-all", {
                    "font-normal text-gray-500": !selectedConverter,
                    "ring-1 ring-primary": selectedConverter,
                  })}
                  type="button"
                  disabled={isUploading}
                >
                  <div className="flex items-center">
                    {SelectedConverterIcon && (
                      <SelectedConverterIcon className={cn("w-4 h-4 mr-2", {
                        "text-primary": selectedConverter === "marker",
                        "text-amber-500": selectedConverter === "markitdown",
                        "text-emerald-500": selectedConverter === "docling",
                      })} />
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
                      {Object.values(MARKDOWN_CONVERTERS).map((converter) => (
                        <CommandItem
                          key={converter.value}
                          value={converter.value}
                          onSelect={(currentValue) => {
                            setSelectedConverter(currentValue as "marker" | "markitdown" | "docling")
                            setPopoverOpen(false)
                          }}
                          className="flex flex-col items-start p-3 transition-colors cursor-pointer hover:bg-primary/5"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                              {converter.icon && (
                                <converter.icon className={cn("w-4 h-4 mr-2", {
                                  "text-primary": converter.value === "marker",
                                  "text-amber-500": converter.value === "markitdown",
                                  "text-emerald-500": converter.value === "docling",
                                })} />
                              )}
                              <span className="font-medium">{converter.label}</span>
                            </div>
                            {selectedConverter === converter.value && <Check className="w-4 h-4 text-primary" />}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{converter.description}</p>
                          <div className="flex gap-1 mt-2">
                            {converter.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className={cn("text-xs", {
                                  "bg-green-50 border-green-200 text-green-700": tag === "accurate",
                                  "bg-blue-50 border-blue-200 text-blue-700": tag === "fast" || tag === "reliable",
                                  "bg-yellow-50 border-yellow-200 text-yellow-700": tag === "slow" || tag === "slower",
                                  "bg-indigo-50 border-indigo-200 text-indigo-700": tag === "detailed" || tag === "semantic",
                                  "bg-gray-50 border-gray-200 text-gray-700": tag === "lightweight",
                                })}
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
              "flex flex-col items-center justify-center text-center",
              isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "hover:bg-muted/50 hover:scale-[1.01]",
              isUploading && "pointer-events-none opacity-60",
            )}
          >
            <input {...getInputProps()} />
            <Upload className={cn("w-10 h-10 mb-4", isDragActive ? "text-primary animate-bounce" : "opacity-70")} />
            <p className="text-sm font-medium">{isDragActive ? "Drop files to upload" : "Drag & drop files here"}</p>
            <p className="mt-1 text-xs opacity-70">or click to browse from your computer</p>
            <p className="mt-2 text-xs opacity-70">Supports PDF, TXT, DOC, and DOCX files</p>
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
                    disabled={isUploading}
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
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {getFileSize(file.size)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-7 w-7"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isUploading && (
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
            disabled={isUploading}
            className="transition-all"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className={cn("transition-all", isUploading && "bg-primary/80")}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
