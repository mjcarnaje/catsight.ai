import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { useCallback } from "react";
import { useState } from "react";

interface ConverterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[], markdown_converter: string) => void;
  isUploading: boolean;
}

export function ConverterModal({
  open,
  onOpenChange,
  onUpload,
  isUploading,
}: ConverterModalProps) {
  const [selectedConverter, setSelectedConverter] = useState<string>("marker");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
  });

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles, selectedConverter);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Upload Documents
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Choose your converter and upload your documents.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">
              Markdown Converter
            </label>
            <Select
              value={selectedConverter}
              onValueChange={setSelectedConverter}
              disabled={isUploading}
            >
              <SelectTrigger className="bg-slate-800/50 border border-white/10 text-white">
                <SelectValue placeholder="Select markdown converter" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border border-white/10">
                <SelectItem className="text-white" value="marker">
                  Marker
                </SelectItem>
                <SelectItem className="text-white" value="markitdown">
                  Markitdown
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ease-out cursor-pointer",
              isDragActive
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-white/20 hover:border-white/40 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:from-slate-700/50 hover:to-slate-800/50",
              isUploading && "pointer-events-none opacity-60"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <Upload className="h-8 w-8 text-blue-400" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-white/90">
                  {isDragActive
                    ? "Release to upload files"
                    : "Drop your files here"}
                </p>
                <p className="text-xs text-gray-400">
                  or browse from your computer
                </p>
              </div>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="text-sm text-gray-400">
              Selected files:{" "}
              {selectedFiles.map((file) => file.name).join(", ")}
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
            className="bg-slate-800 hover:bg-slate-700 text-white border border-white/10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-none"
          >
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
