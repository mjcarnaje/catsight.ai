import { notFound } from "next/navigation";
import { Document } from "@/types/file";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

async function getDocument(id: string) {
  const res = await fetch(`${process.env.BACKEND_URL}/api/documents/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 404) {
      notFound();
    }
    throw new Error("Failed to fetch PDF");
  }
  return res.json();
}

export default async function DocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const document: Document = await getDocument(params.id);

  return (
    <div className="container mx-auto p-4">
      <Link href="/" className="mb-4 inline-block">
        <Button variant="outline" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Documents
        </Button>
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{document.title}</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                document.status === "completed" ? "success" : "secondary"
              }
            >
              {document.status}
            </Badge>
            <span className="text-sm text-gray-500">ID: {document.id}</span>
          </div>
        </CardHeader>
        <CardContent>
          {document.description && (
            <p className="mb-4 text-gray-700">{document.description}</p>
          )}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">File Details</h3>
            <p>Created: {new Date(document.created_at).toLocaleString()}</p>
            <p>
              Last Updated: {new Date(document.updated_at).toLocaleString()}
            </p>
          </div>
          <div className="flex space-x-4">
            {document.file && (
              <Link
                href={`${process.env.BACKEND_URL}/api/documents/${document.id}/original`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" /> View Original PDF
                </Button>
              </Link>
            )}
            {document.ocr_file && (
              <Link
                href={`${process.env.BACKEND_URL}/api/documents/${document.id}/ocr`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" /> View OCR PDF
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
