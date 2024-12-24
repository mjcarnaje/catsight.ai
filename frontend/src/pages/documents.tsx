import { ConverterModal } from "@/components/converter-modal";
import { DocumentCard } from "@/components/document-card";
import { Button } from "@/components/ui/button";
import { documentsApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, X } from "lucide-react";
import { useState } from "react";

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await documentsApi.getAll();
      return response.data;
    },
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      files,
      markdown_converter,
    }: {
      files: File[];
      markdown_converter: string;
    }) => documentsApi.upload(files, markdown_converter),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setError(null);
      setIsUploadModalOpen(false);
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

  const handleDelete = async (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleRetry = async (id: number) => {
    retryMutation.mutate(id);
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-8">
        <Button
          onClick={() => setIsUploadModalOpen(true)}
          className="w-full p-10 h-auto flex flex-col gap-4 bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl"
          variant="outline"
        >
          <Upload className="h-8 w-8 text-blue-400" />
          <div className="flex flex-col gap-2">
            <p className="text-base font-medium text-white">Upload Documents</p>
            <p className="text-sm text-gray-400">
              Click to upload your documents
            </p>
          </div>
        </Button>

        <ConverterModal
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
          onUpload={(files, markdown_converter) =>
            uploadMutation.mutate({ files, markdown_converter })
          }
          isUploading={uploadMutation.isPending}
        />

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 p-3 text-red-400 backdrop-blur-xl">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-red-500/20"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
