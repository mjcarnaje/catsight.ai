import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { invalidateTagViews } from "@/components/tags/invalidate";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { errorMessage, tagsApi } from "@/lib/api";
import { plural } from "@/lib/format";
import type { Tag } from "@/types";

/** Confirms deleting a tag (open while `tag` is set); documents keep everything but the tag. */
export function DeleteTagDialog({ tag, onClose }: { tag: Tag | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Keep showing the tag while the dialog fades out
  const [shown, setShown] = useState(tag);
  if (tag && tag !== shown) setShown(tag);

  const remove = useMutation({
    mutationFn: (target: Tag) => tagsApi.remove(target.id),
    onSuccess: async (_data, target) => {
      await invalidateTagViews(queryClient);
      toast({ title: "Tag deleted", description: target.name });
      onClose();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Couldn't delete the tag", description: errorMessage(error) });
    },
  });

  return (
    <AlertDialog open={tag !== null} onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{shown?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {shown && shown.document_count > 0
              ? `It will be removed from ${plural(shown.document_count, "document")}. The documents themselves are not deleted.`
              : "No documents use this tag."}{" "}
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending || !tag}
            onClick={() => tag && remove.mutate(tag)}
          >
            {remove.isPending && <Loader2 className="animate-spin" />}
            Delete tag
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
