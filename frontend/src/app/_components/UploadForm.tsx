"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/actions/file";
import { useDropzone } from "react-dropzone";
import { X } from "lucide-react";

export const UploadForm = () => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Uploading files:", files);

    if (files.length === 0) {
      console.log("Error: No files selected");
      toast({
        title: "Error",
        description: "Please select at least one file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Starting upload process");
      setUploading(true);
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      await uploadFile(formData);
      console.log("Files uploaded successfully");
      toast({
        title: "Success",
        description: "Files uploaded successfully",
      });
      setFiles([]);
    } catch (error: unknown) {
      console.error("Upload error:", error);
      if (error instanceof Error) {
        console.log("Error message:", error.message);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log("Unknown error occurred");
        toast({
          title: "Error",
          description: "Failed to upload files",
          variant: "destructive",
        });
      }
    } finally {
      console.log("Upload process completed");
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="file">DocumentFiles</Label>
        <div
          {...getRootProps()}
          className="border-2 border-dashed p-4 cursor-pointer"
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the Documentfiles here ...</p>
          ) : (
            <p>
              Drag &apos;n&apos; drop Documentfiles here, or click to select
              files
            </p>
          )}
        </div>
        {files.length > 0 && (
          <div className="mt-2">
            <p>Selected files:</p>
            <ul>
              {files.map((file, index) => (
                <li key={index} className="flex items-center justify-between">
                  <span>{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Button type="submit" disabled={uploading || files.length === 0}>
        {uploading ? "Uploading..." : "Upload Documents"}
      </Button>
    </form>
  );
};
