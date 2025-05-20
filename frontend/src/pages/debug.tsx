import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { useState } from "react";

export default function DebugPage() {
  const { toast } = useToast();
  const [docId, setDocId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleDeleteChunks = async () => {
    if (!docId || isNaN(Number(docId))) {
      toast({
        title: "Invalid Document ID",
        description: "Please enter a valid document ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/documents/${docId}/delete-chunks/`);
      toast({
        title: "Success",
        description: `Chunks for document ID ${docId} successfully deleted`,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to delete chunks";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container p-8">
      <h1 className="mb-6 text-2xl font-bold">Debug Tools</h1>

      <div className="p-4 mb-4 border rounded-md">
        <h2 className="mb-3 text-lg font-medium">Delete Document Chunks</h2>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Enter document ID"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            className="max-w-[200px]"
          />
          <Button
            onClick={handleDeleteChunks}
            disabled={loading}
            variant="destructive"
          >
            {loading ? "Deleting..." : "Delete Chunks"}
          </Button>
        </div>
      </div>
    </div>
  );
}
