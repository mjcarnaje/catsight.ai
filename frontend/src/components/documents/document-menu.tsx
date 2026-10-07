import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { extractorLabel } from "@/components/documents/extractors";
import { useReprocess } from "@/components/documents/use-reprocess";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { documentsApi, errorMessage } from "@/lib/api";
import { keys, isProcessing, useConfig } from "@/lib/queries";
import type { DocumentDetail } from "@/types";

/**
 * Overflow menu for a document you can edit: re-run parts of the pipeline, or delete it.
 * Re-running needs the document to be idle; the API refuses it for demo visitors (403) and
 * when the daily limit is used up (429), and that message is shown as a toast.
 *
 * @example
 * {doc.can_edit && <DocumentMenu doc={doc} />}
 */
export function DocumentMenu({ doc }: { doc: DocumentDetail }) {
  const { data: config } = useConfig();
  const reprocess = useReprocess(doc.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const extractors = config?.extractors?.options ?? [];
  const busy = isProcessing(doc) || reprocess.isPending;

  const remove = useMutation({
    mutationFn: () => documentsApi.remove(doc.id),
    onSuccess: () => {
      toast({ title: "Document deleted" });
      // Nothing left to fetch for this id; drop it before leaving the page
      queryClient.removeQueries({ queryKey: keys.document(doc.id) });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.config });
      queryClient.invalidateQueries({ queryKey: keys.tags });
      navigate("/documents");
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast({ variant: "destructive", title: "Couldn't delete the document", description: errorMessage(error) });
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions" className="shadow-none">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={busy} className="data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
              <RotateCw />
              Re-run
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <DropdownMenuLabel className="font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                Start again from
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => reprocess.mutate({ from: "summarizing" })}>
                Cataloguing (summary and details)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => reprocess.mutate({ from: "indexing" })}>Indexing passages</DropdownMenuItem>
              {extractors.length > 1 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                    Re-read the pages with
                  </DropdownMenuLabel>
                  {extractors.map((extractor) => (
                    <DropdownMenuItem
                      key={extractor}
                      onSelect={() => reprocess.mutate({ from: "extracting", extractor })}
                    >
                      {extractorLabel(extractor)}
                      {extractor === doc.extractor && (
                        <span className="ml-auto text-xs text-muted-foreground">current</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : (
                <DropdownMenuItem onSelect={() => reprocess.mutate({ from: "extracting" })}>
                  Reading (re-read the pages)
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !remove.isPending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {doc.title || doc.file_name} will be removed along with its PDF, text and passages. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault(); // stay open until the request finishes
                remove.mutate();
              }}
            >
              {remove.isPending ? "Deleting" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
