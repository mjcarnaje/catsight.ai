import { Markdown } from "@/components/markdown";
import { api, Document } from "@/lib/api";
import { getDocumentStatus } from "@/lib/document-status";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, FileCode, FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
export function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isPending, error, data } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`),
  });

  if (isPending) {
    return (
      <div className="container mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="animate-pulse flex items-center justify-center text-white">
          <div className="animate-spin mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error.message}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          Document not found
        </div>
      </div>
    );
  }

  const { label, color, progress } = getDocumentStatus(data.data.status);

  return (
    <div className="container mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} />
        Back
      </button>
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl p-8 border border-white/10">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="border-b border-white/10 pb-6">
            <div className="flex flex-col gap-8 items-start">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {data.data.title}
              </h1>
              <Markdown content={data.data.description} />
              <div className="flex gap-3">
                <a
                  href={`/documents/${data.data.id}/raw`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-lg border border-white/10 hover:border-white/20"
                >
                  <FileText size={16} />
                  <span>View Raw</span>
                </a>
                <a
                  href={`/documents/${data.data.id}/markdown`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors rounded-lg border border-white/10 hover:border-white/20"
                >
                  <FileCode size={16} />
                  <span>View Markdown</span>
                </a>
              </div>
            </div>
          </div>

          {/* Document Details */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-400">Status</h3>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                      ${color.bg} ${color.text} border ${color.border}`}
                  >
                    {label}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400">
                  Number of Chunks
                </h3>
                <p className="mt-2 text-white">{data.data.no_of_chunks}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-400">
                  Created At
                </h3>
                <p className="mt-2 text-white">
                  {data.data.created_at &&
                    format(new Date(data.data.created_at), "PPP")}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400">
                  Last Updated
                </h3>
                <p className="mt-2 text-white">
                  {data.data.updated_at &&
                    format(new Date(data.data.updated_at), "PPP")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
