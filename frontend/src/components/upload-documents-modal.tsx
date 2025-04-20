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
import { useCallback, useState } from "react";

interface UploadDocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[], markdown_converter: "marker" | "markitdown") => void;
  isUploading: boolean;
}

export function UploadDocumentsModal({
  open,
  onOpenChange,
  onUpload,
  isUploading,
}: UploadDocumentsModalProps) {
  const [selectedConverter, setSelectedConverter] = useState<"marker" | "markitdown">("marker");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Choose your converter and upload your documents.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Markdown Converter
            </label>
            <Select
              value={selectedConverter}
              onValueChange={(value) => setSelectedConverter(value as "marker" | "markitdown")}
              disabled={isUploading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select markdown converter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marker">Marker</SelectItem>
                <SelectItem value="markitdown">Markitdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 transition-all duration-200",
              "flex flex-col items-center justify-center text-center",
              isDragActive
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50",
              isUploading && "pointer-events-none opacity-60"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 mb-4 opacity-70" />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop files to upload" : "Drag & drop files here"}
            </p>
            <p className="mt-1 text-xs opacity-70">
              or click to browse from your computer
            </p>
            <p className="mt-2 text-xs opacity-70">
              Supports PDF, TXT, DOC, and DOCX files
            </p>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
