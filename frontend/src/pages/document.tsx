import { Document, documentsApi } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";

export function DocumentPage() {
  const { id } = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = async (
    id: number,
    abortController: AbortController
  ) => {
    try {
      const response = await documentsApi.getOne(id, abortController.signal);
      setDocument(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    fetchDocument(Number(id), abortController);
    return () => abortController.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              {document?.title}
            </h1>
            <p className="mt-2 text-gray-600">{document?.description}</p>
          </div>

          {/* Document Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${
                      document?.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {document?.status}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Number of Chunks
                </h3>
                <p className="mt-1 text-sm text-gray-900">
                  {document?.no_of_chunks}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Created At
                </h3>
                <p className="mt-1 text-sm text-gray-900">
                  {document?.created_at &&
                    format(new Date(document.created_at), "PPP")}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Last Updated
                </h3>
                <p className="mt-1 text-sm text-gray-900">
                  {document?.updated_at &&
                    format(new Date(document.updated_at), "PPP")}
                </p>
              </div>
            </div>
          </div>

          {/* File Link */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500">File</h3>
            <a
              href={document?.file}
              className="mt-1 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Download File
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
