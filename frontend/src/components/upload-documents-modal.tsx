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
import { Check, ChevronDownIcon, Loader2, Upload } from "lucide-react"
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { MARKDOWN_CONVERTERS } from "../lib/markdown-converter"

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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(acceptedFiles)
  }, [])

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
      onUpload(selectedFiles, selectedConverter)
    }
  }

  const SelectedConverterIcon = selectedConverter ? MARKDOWN_CONVERTERS[selectedConverter].icon : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  className={cn("justify-between w-full h-12", {
                    "font-normal text-gray-500": !selectedConverter,
                  })}
                  type="button"
                >
                  <div className="flex items-center">
                    {SelectedConverterIcon && <SelectedConverterIcon className="w-4 h-4 mr-2" />}
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
                          className="flex flex-col items-start p-3 cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                              {converter.icon && <converter.icon className="w-4 h-4 mr-2" />}
                              <span className="font-medium">{converter.label}</span>
                            </div>
                            {selectedConverter === converter.value && <Check className="w-4 h-4" />}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{converter.description}</p>
                          <div className="flex gap-1 mt-2">
                            {converter.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
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
              isDragActive ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              isUploading && "pointer-events-none opacity-60",
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 mb-4 opacity-70" />
            <p className="text-sm font-medium">{isDragActive ? "Drop files to upload" : "Drag & drop files here"}</p>
            <p className="mt-1 text-xs opacity-70">or click to browse from your computer</p>
            <p className="mt-2 text-xs opacity-70">Supports PDF, TXT, DOC, and DOCX files</p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="p-3 mt-2 text-sm rounded-md bg-muted">
              <p className="font-medium">Selected files ({selectedFiles.length}):</p>
              <ul className="mt-1 ml-2 space-y-1 list-disc list-inside opacity-70">
                {selectedFiles.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpload} disabled={selectedFiles.length === 0 || isUploading}>
            {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
