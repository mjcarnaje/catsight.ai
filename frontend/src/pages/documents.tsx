import { DocumentCard } from "@/components/document-card";
import { Button } from "@/components/ui/button";
import { Document, documentsApi } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      const response = await documentsApi.getAll();
      setDocuments(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    try {
      setLoading(true);
      await documentsApi.upload(Array.from(files));
      await fetchDocuments();
    } catch (err) {
      setError("Failed to upload files");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await documentsApi.delete(id);
      await fetchDocuments();
    } catch (err) {
      setError("Failed to delete document");
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Documents</h1>
          <div className="flex items-center gap-4">
            <Button asChild>
              <label>
                Upload Files
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-destructive">
            {error}
          </div>
        )}

        {loading ? (
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
