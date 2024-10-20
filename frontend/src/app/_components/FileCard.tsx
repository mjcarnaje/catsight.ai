"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Document } from "@/types/file";
import { ExternalLink, Loader2, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

interface FileCardProps {
  document: Document;
  onDelete: (id: number) => Promise<void>;
  isDeleting: boolean;
}

export const FileCard = ({ document, onDelete, isDeleting }: FileCardProps) => {
  const { toast } = useToast();

  const handleDeletePdf = useCallback(
    async (id: number) => {
      try {
        await onDelete(id);
        toast({
          title: "Success",
          description: "Documentdeleted successfully",
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to delete PDF",
            variant: "destructive",
          });
        }
      }
    },
    [onDelete, toast]
  );

  return (
    <Card
      key={document.id}
      className="hover:shadow-md transition-shadow duration-300"
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold mb-1">
              {document.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                document.status === "completed" ? "success" : "secondary"
              }
              className="capitalize"
            >
              {document.status}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeletePdf(document.id)}
              disabled={isDeleting}
              className="hover:bg-red-100 hover:text-red-600 transition-colors duration-300"
            >
              {isDeleting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <TrashIcon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {document.description && (
          <p className="text-sm text-gray-600 mb-3">{document.description}</p>
        )}
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-400">
            <p>Created: {new Date(document.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(document.updated_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/documents/${document.id}`}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "flex items-center gap-2",
              })}
            >
              <ExternalLink className="h-4 w-4" />
              Details
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
