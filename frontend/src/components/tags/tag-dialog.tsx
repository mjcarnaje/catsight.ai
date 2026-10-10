import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { invalidateTagViews } from "@/components/tags/invalidate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { errorMessage, tagsApi } from "@/lib/api";
import type { Tag } from "@/types";

const schema = z.object({
  name: z.string().trim().min(1, "Give the tag a name.").max(100, "Tag names can be up to 100 characters."),
  description: z.string().trim(),
});

type Values = z.infer<typeof schema>;

/** DRF field errors start in lower case ("tag with this name already exists."). */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Create a tag (`tag` is null) or edit one. The form is mounted only while the dialog is open,
 * so it always starts from the tag's current values.
 *
 * @example
 * <TagDialog open={open} onOpenChange={setOpen} tag={null} />
 */
export function TagDialog({
  open,
  onOpenChange,
  tag,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TagForm tag={tag} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TagForm({ tag, onDone }: { tag: Tag | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: tag?.name ?? "", description: tag?.description ?? "" },
  });

  const save = useMutation({
    // The schema guarantees both fields; zod types them optional only because tsconfig isn't strict
    mutationFn: (values: Values) => {
      const payload = values as { name: string; description: string };
      return tag ? tagsApi.update(tag.id, payload) : tagsApi.create(payload);
    },
    onSuccess: async (saved) => {
      await invalidateTagViews(queryClient);
      toast({ title: tag ? "Tag updated" : "Tag created", description: saved.name });
      onDone();
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{tag ? "Edit tag" : "New tag"}</DialogTitle>
        <DialogDescription>
          {tag
            ? "Renaming a tag updates it on every document that has it."
            : "New documents are checked against every tag when they are catalogued."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tag-name">Name</Label>
        <Input
          id="tag-name"
          autoComplete="off"
          placeholder="e.g. Contracts"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "tag-name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="tag-name-error" className="text-xs text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tag-description">Description</Label>
        <Textarea
          id="tag-description"
          rows={4}
          placeholder="e.g. Contracts and agreements with suppliers, vendors or partners."
          aria-describedby="tag-description-hint"
          {...register("description")}
        />
        <p id="tag-description-hint" className="text-xs text-muted-foreground">
          The AI reads this when it picks tags for a document. Say what belongs under the tag, and what does not.
        </p>
      </div>

      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {sentence(errorMessage(save.error))}
        </p>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {tag ? "Save changes" : "Create tag"}
        </Button>
      </DialogFooter>
    </form>
  );
}
