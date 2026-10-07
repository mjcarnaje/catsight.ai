import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Copy, FileText, Info, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Link } from "react-router-dom";

import { extractorLabel } from "@/components/documents/extractors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { documentsApi, errorMessage } from "@/lib/api";
import { formatBytes, plural, timeAgo } from "@/lib/format";
import { keys, useConfig } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { Extractor, UploadResult } from "@/types";

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

function rejectionMessage(rejection: FileRejection, maxMb?: number) {
  const codes = rejection.errors.map((e) => e.code);
  if (codes.includes("file-invalid-type")) return `${rejection.file.name}: only PDF files can be uploaded.`;
  if (codes.includes("file-too-large"))
    return `${rejection.file.name}: ${formatBytes(rejection.file.size)} is over the ${maxMb} MB limit.`;
  return `${rejection.file.name}: ${rejection.errors[0]?.message ?? "can't be uploaded."}`;
}

/**
 * Upload PDFs by drag and drop or file picker, show how each one was handled
 * (queued, duplicate or rejected) and refresh the library afterwards.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <Button onClick={() => setOpen(true)}>Upload</Button>
 * <UploadDialog open={open} onOpenChange={setOpen} />
 */
export function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useSession();
  const { data: config } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [extractor, setExtractor] = useState<Extractor | "">("");
  const [shared, setShared] = useState(true);

  const maxMb = config?.limits.max_file_mb;
  const maxPages = config?.limits.max_pages_per_file;
  const extractorOptions = config?.extractors?.options ?? [];
  const showExtractor = extractorOptions.length > 1;
  const chosenExtractor = extractor || config?.extractors?.default;

  const usage = config?.usage;
  const uploadsLeft = usage?.limited && usage.uploads.limit > 0 ? Math.max(0, usage.uploads.limit - usage.uploads.used) : null;
  const outOfUploads = uploadsLeft === 0;

  // Visitors in the public demo always upload privately; everyone else can choose
  const forcedPrivate = Boolean(config?.demo_mode && user && !user.is_admin);
  const canChoosePrivacy = Boolean(user) && !forcedPrivate;

  const upload = useMutation({
    mutationFn: () =>
      documentsApi.upload(
        files,
        {
          extractor: showExtractor ? chosenExtractor : undefined,
          private: forcedPrivate || (canChoosePrivacy && !shared),
        },
        setProgress
      ),
    onSuccess: (data) => {
      setResults(data);
      setFiles([]);
      const queued = data.filter((r) => r.status === "queued").length;
      if (queued > 0) toast({ title: `${plural(queued, "document")} queued`, description: "They'll be searchable once processed." });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.config });
    },
  });
  const { reset: resetUpload } = upload;

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setRejected(rejections.map((r) => rejectionMessage(r, maxMb)));
      setFiles((current) => {
        const known = new Set(current.map(fileKey));
        return [...current, ...accepted.filter((f) => !known.has(fileKey(f)))];
      });
      resetUpload();
    },
    [maxMb, resetUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: maxMb ? maxMb * 1024 * 1024 : undefined,
    disabled: upload.isPending || outOfUploads,
  });

  const reset = useCallback(() => {
    setFiles([]);
    setRejected([]);
    setResults(null);
    setProgress(0);
    resetUpload();
  }, [resetUpload]);

  // Start fresh next time, once the closing animation is over
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(reset, 250);
    return () => clearTimeout(timer);
  }, [open, reset]);

  const handleOpenChange = (next: boolean) => {
    if (!next && upload.isPending) return; // don't abandon a running upload
    onOpenChange(next);
  };

  const submit = () => {
    setProgress(0);
    setRejected([]);
    upload.mutate();
  };

  const description = [
    "PDF only",
    maxMb ? `up to ${maxMb} MB` : null,
    maxPages ? `${maxPages} pages` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            {description}
            {maxMb && maxPages ? " each." : "."}
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <UploadResults results={results} onNavigate={() => onOpenChange(false)} />
        ) : (
          <div className="flex flex-col gap-4">
            <div
              {...getRootProps({ role: "button", "aria-label": "Choose PDF files to upload" })}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isDragActive ? "border-foreground/50 bg-accent/50" : "hover:bg-accent/30",
                (upload.isPending || outOfUploads) && "pointer-events-none opacity-50"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">{isDragActive ? "Drop to add" : "Drop PDFs here, or click to browse"}</p>
              <p className="text-xs text-muted-foreground">You can add several files at once.</p>
            </div>

            {uploadsLeft !== null && (
              <p
                className={cn(
                  "flex items-start gap-2 text-xs",
                  outOfUploads ? "text-destructive" : "text-muted-foreground"
                )}
              >
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                {outOfUploads
                  ? `You've used all of today's uploads${usage?.uploads.resets_at ? `. They reset ${timeAgo(usage.uploads.resets_at)}` : ""}.`
                  : `${plural(uploadsLeft, "upload")} left today.`}
              </p>
            )}

            {rejected.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-destructive" role="alert">
                {rejected.map((message) => (
                  <li key={message} className="flex items-start gap-2">
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                    {message}
                  </li>
                ))}
              </ul>
            )}

            {files.length > 0 && (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border" aria-label="Files to upload">
                {files.map((file) => (
                  <li key={fileKey(file)} className="flex items-center gap-2.5 px-3 py-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      disabled={upload.isPending}
                      onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                      className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {(showExtractor || canChoosePrivacy || forcedPrivate) && (
              <div className="flex flex-col gap-3 border-t pt-4">
                {showExtractor && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="upload-extractor" className="text-sm">
                        Text extraction
                      </Label>
                      <p className="text-xs text-muted-foreground">How pages are turned into text.</p>
                    </div>
                    <Select
                      value={chosenExtractor}
                      onValueChange={(value) => setExtractor(value as Extractor)}
                      disabled={upload.isPending}
                    >
                      <SelectTrigger id="upload-extractor" className="h-8 w-44 shrink-0 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {extractorOptions.map((option) => (
                          <SelectItem key={option} value={option} className="text-xs">
                            {extractorLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {canChoosePrivacy && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="upload-shared" className="text-sm">
                        Add to the shared library
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {shared ? "Everyone with access can search it." : "Private: only you can see it."}
                      </p>
                    </div>
                    <Switch id="upload-shared" checked={shared} onCheckedChange={setShared} disabled={upload.isPending} />
                  </div>
                )}

                {forcedPrivate && (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                    {user?.is_guest
                      ? "Uploads are private to you and deleted with your guest session."
                      : "Uploads are private to you."}
                  </p>
                )}
              </div>
            )}

            {upload.isPending && (
              <div className="flex flex-col gap-1.5" role="status">
                <Progress value={progress} className="h-1 bg-muted" aria-label="Upload progress" />
                <p className="text-xs text-muted-foreground">
                  {progress < 100 ? `Uploading ${progress}%` : "Checking files and adding them to the queue..."}
                </p>
              </div>
            )}

            {upload.isError && (
              <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {errorMessage(upload.error, "The upload failed. Try again.")}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {results ? (
            <>
              <Button variant="outline" onClick={reset}>
                Upload more
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={upload.isPending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={files.length === 0 || upload.isPending || outOfUploads}>
                <Upload />
                {upload.isPending ? "Uploading" : files.length > 0 ? `Upload ${plural(files.length, "file")}` : "Upload"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadResults({ results, onNavigate }: { results: UploadResult[]; onNavigate: () => void }) {
  return (
    <ul className="max-h-80 divide-y overflow-y-auto rounded-md border" aria-label="Upload results">
      {results.map((result, index) => {
        const Icon = result.status === "queued" ? CheckCircle2 : result.status === "duplicate" ? Copy : AlertCircle;
        const detail =
          result.detail ||
          (result.status === "queued"
            ? "Queued for processing."
            : result.status === "duplicate"
              ? "Already in the library."
              : "Couldn't be uploaded.");
        return (
          <li key={`${result.file_name}-${index}`} className="flex items-start gap-3 px-3 py-2.5">
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                result.status === "queued" && "text-emerald-400",
                result.status === "duplicate" && "text-muted-foreground",
                result.status === "rejected" && "text-destructive"
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{result.file_name}</p>
              <p className={cn("text-xs", result.status === "rejected" ? "text-destructive" : "text-muted-foreground")}>
                <span className="sr-only">{result.status}: </span>
                {detail}
              </p>
            </div>
            {result.document_id !== undefined && result.status !== "rejected" && (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link to={`/documents/${result.document_id}`} onClick={onNavigate}>
                  {result.status === "duplicate" ? "View existing" : "View"}
                </Link>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
