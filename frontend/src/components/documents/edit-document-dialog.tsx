import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { TagPicker } from "@/components/documents/tag-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { documentsApi, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { DocumentDetail, DocumentUpdate } from "@/types";

const schema = z.object({
  title: z.string(),
  reference_number: z.string().max(255, "Up to 255 characters."),
  year: z.string().refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100), "Use a year between 1900 and 2100."),
  issued_on: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date."),
  tag_ids: z.array(z.number()),
  summary: z.string(),
});
type FormValues = z.infer<typeof schema>;

const valuesOf = (doc: DocumentDetail): FormValues => ({
  title: doc.title,
  reference_number: doc.reference_number,
  year: doc.year?.toString() ?? "",
  issued_on: doc.issued_on ?? "",
  tag_ids: doc.tags.map((t) => t.id),
  summary: doc.summary,
});

/** Only the fields that changed, in the shape the API expects (blank year and date become null). */
function changesOf(doc: DocumentDetail, values: FormValues): DocumentUpdate {
  const initial = valuesOf(doc);
  const changes: DocumentUpdate = {};
  if (values.title !== initial.title) changes.title = values.title;
  if (values.reference_number !== initial.reference_number) changes.reference_number = values.reference_number;
  if (values.year !== initial.year) changes.year = values.year === "" ? null : Number(values.year);
  if (values.issued_on !== initial.issued_on) changes.issued_on = values.issued_on === "" ? null : values.issued_on;
  if (values.summary !== initial.summary) changes.summary = values.summary;
  if (values.tag_ids.slice().sort().join() !== initial.tag_ids.slice().sort().join()) changes.tag_ids = values.tag_ids;
  return changes;
}

/**
 * Edit a document's catalogue details (title, reference, year, issue date, tags, summary).
 *
 * @example
 * <EditDocumentDialog doc={doc} open={open} onOpenChange={setOpen} />
 */
export function EditDocumentDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: DocumentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>Correct what was read from the scan. Search results use these details.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form starts from the current values every time */}
        <EditForm doc={doc} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ doc, onDone }: { doc: DocumentDetail; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: valuesOf(doc) });

  const save = useMutation({
    mutationFn: (changes: DocumentUpdate) => documentsApi.update(doc.id, changes),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.document(doc.id), updated);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.tags });
      toast({ title: "Details saved" });
      onDone();
    },
  });

  const onSubmit = handleSubmit((values) => {
    const changes = changesOf(doc, values);
    if (Object.keys(changes).length === 0) return onDone();
    save.mutate(changes);
  });

  const disabled = save.isPending;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field id="edit-title" label="Title" error={errors.title?.message}>
        <Input id="edit-title" disabled={disabled} {...register("title")} />
      </Field>

      <Field id="edit-reference" label="Reference number" error={errors.reference_number?.message}>
        <Input id="edit-reference" disabled={disabled} placeholder="Special Order No. 01592-IIT, s. 2023" {...register("reference_number")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="edit-year" label="Year" error={errors.year?.message}>
          <Input id="edit-year" type="number" inputMode="numeric" min={1900} max={2100} disabled={disabled} {...register("year")} />
        </Field>
        <Field id="edit-issued" label="Issued on" error={errors.issued_on?.message}>
          <Input id="edit-issued" type="date" disabled={disabled} {...register("issued_on")} />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label id="edit-tags-label">Tags</Label>
        <Controller
          control={control}
          name="tag_ids"
          render={({ field }) => (
            <TagPicker value={field.value} onChange={field.onChange} labelledBy="edit-tags-label" disabled={disabled} />
          )}
        />
      </div>

      <Field id="edit-summary" label="Summary" hint="Markdown is supported." error={errors.summary?.message}>
        <Textarea id="edit-summary" rows={8} disabled={disabled} className="resize-y" {...register("summary")} />
      </Field>

      {save.isError && (
        <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorMessage(save.error, "Couldn't save the changes.")}
        </p>
      )}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={disabled}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {disabled ? "Saving" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
