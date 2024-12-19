import { DocumentCard } from "@/components/document-card";
import { Button } from "@/components/ui/button";
import { documentsApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, X } from "lucide-react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await documentsApi.getAll();
      return response.data;
    },
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => documentsApi.upload(files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setError(null);
    },
    onError: () => {
      setError("Failed to upload files");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: () => {
      setError("Failed to delete document");
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => documentsApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    uploadMutation.mutate(acceptedFiles);
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

  const handleDelete = async (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleRetry = async (id: number) => {
    retryMutation.mutate(id);
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-8">
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-10 transition-all duration-300 ease-out cursor-pointer backdrop-blur-sm",
            isDragActive
              ? "border-slate-500/80 bg-slate-500/5 scale-[1.02] shadow-lg shadow-slate-500/20"
              : "border-white/20 hover:border-white/40 hover:bg-white/5",
            uploadMutation.isPending && "pointer-events-none opacity-60"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <div className="rounded-full bg-gradient-to-br from-slate-500/20 to-slate-400/10 p-5 shadow-inner dark:from-slate-500/25 dark:to-slate-400/15">
              <Upload className="h-8 w-8 text-slate-500 animate-pulse" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-base font-medium text-white/90">
                {isDragActive
                  ? "Release to upload files"
                  : "Drop your files here"}
              </p>
              <p className="text-sm text-white/70">
                or browse from your computer
              </p>
            </div>
            {uploadMutation.isPending && (
              <div className="absolute bottom-4 flex items-center gap-3 text-sm font-medium text-slate-500/80">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing your files...
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-destructive">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-destructive/25"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-8">
            {documents.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onDelete={handleDelete}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
