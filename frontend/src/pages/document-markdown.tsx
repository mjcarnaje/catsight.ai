import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function DocumentMarkdownPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isPending, error, data } = useQuery({
    queryKey: ["document", id, "markdown"],
    queryFn: () => api.get<{ content: string }>(`/documents/${id}/markdown`),
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
        <ReactMarkdown className="prose prose-invert prose-slate !max-w-none">
          {data.data.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
