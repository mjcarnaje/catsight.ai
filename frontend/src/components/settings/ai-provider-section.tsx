import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation } from "react-router-dom";

import { apiErrorBody, apiErrorCode, orgAdminKeys, useInvitations, useMembers } from "@/components/admin/shared";
import { SettingsSection } from "@/components/settings/section";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { aiSettingsApi, errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { keys } from "@/lib/queries";
import type { AISettings, AISettingsUpdate, ModelChoices, ModelRole, Provider } from "@/types";

/** Radix Select can't hold an empty value, so "no provider" is this sentinel inside the form only. */
const NONE = "__none__";

const MODEL_FIELDS: { field: ModelRole; label: string }[] = [
  { field: "chat_model", label: "Chat" },
  { field: "fast_model", label: "Fast (titles)" },
  { field: "ocr_model", label: "OCR (page images)" },
  { field: "embedding_model", label: "Embeddings" },
  { field: "reranker_model", label: "Reranker" },
];

/** Models that can be switched off by typing "none". */
const CAN_TURN_OFF: ModelRole[] = ["ocr_model", "reranker_model"];

/**
 * The organization's AI provider, its key and the five models (org admins only).
 * Saving checks the key with real calls, so it can take a while.
 */
export function AiProviderSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hash } = useLocation();
  const settings = useQuery({ queryKey: orgAdminKeys.ai, queryFn: aiSettingsApi.get });

  // Re-embedding asks first; the payload is kept so the confirmed save repeats exactly the same
  const [reindex, setReindex] = useState<{ documents: number; payload: AISettingsUpdate } | null>(null);
  const [turningOff, setTurningOff] = useState<AISettingsUpdate | null>(null);
  // The count stays in the title while the dialog fades out (same pattern as DeleteTagDialog)
  const [reindexCount, setReindexCount] = useState(0);
  if (reindex && reindex.documents !== reindexCount) setReindexCount(reindex.documents);

  // /settings#ai-provider: scroll once the lists above (members, invitations; the same cached queries as the
  // organization section) and these settings have loaded, since their real heights differ from the skeletons
  const members = useMembers(true);
  const invitations = useInvitations(true);
  const settled = !settings.isPending && !members.isPending && !invitations.isPending;
  useEffect(() => {
    if (settled && hash === "#ai-provider") document.getElementById("ai-provider")?.scrollIntoView({ block: "start" });
  }, [hash, settled]);

  const save = useMutation({
    mutationFn: (payload: AISettingsUpdate) => aiSettingsApi.save(payload),
    onSuccess: (saved) => {
      // Showing the saved settings right away also clears the key input (the form remounts on new data)
      queryClient.setQueryData(orgAdminKeys.ai, saved);
      void queryClient.invalidateQueries({ queryKey: orgAdminKeys.ai });
      void queryClient.invalidateQueries({ queryKey: keys.config });
      setReindex(null);
      setTurningOff(null);
      toast({
        title: "Saved. The provider answered.",
        description: saved.reindexing ? `Re-embedding ${plural(saved.reindexing, "document")}.` : undefined,
      });
    },
    onError: (error, payload) => {
      if (apiErrorCode(error) === "reindex_required") {
        setTurningOff(null);
        setReindex({ documents: Number(apiErrorBody(error)?.documents) || 0, payload });
      } else {
        setReindex(null);
        setTurningOff(null);
      }
    },
  });

  const submit = (payload: AISettingsUpdate) => {
    if (payload.provider === "") setTurningOff(payload);
    else save.mutate(payload);
  };

  return (
    <SettingsSection
      id="settings-ai-provider"
      label="AI provider"
      description="The provider and models that answer questions, read uploads and search this organization's library."
    >
      {settings.isPending ? (
        <div className="flex flex-col gap-4 p-5" aria-hidden="true">
          <Skeleton className="h-9 w-full max-w-xs" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : settings.isError ? (
        <p role="alert" className="p-5 text-sm text-muted-foreground">
          {errorMessage(settings.error, "Couldn't load the AI provider.")}
        </p>
      ) : (
        <AiProviderForm
          // A new key forces the form to start from what the server just saved
          key={settings.dataUpdatedAt}
          settings={settings.data}
          saving={save.isPending}
          error={save.error}
          onSubmit={submit}
        />
      )}

      <AlertDialog
        open={turningOff !== null}
        onOpenChange={(open) => !open && !save.isPending && setTurningOff(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off AI?</AlertDialogTitle>
            <AlertDialogDescription>
              Uploading, searching and asking stop until a provider is added again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={save.isPending || !turningOff}
              onClick={() => turningOff && save.mutate(turningOff)}
            >
              {save.isPending && <Loader2 className="animate-spin" />}
              Turn off AI
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={reindex !== null}
        onOpenChange={(open) => !open && !save.isPending && setReindex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-embed {plural(reindexCount, "document")}?</AlertDialogTitle>
            <AlertDialogDescription>
              The new embedding model rebuilds the search vectors of these documents with the organization's key. Search
              can miss them until it finishes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={save.isPending || !reindex}
              onClick={() => reindex && save.mutate({ ...reindex.payload, confirm_reindex: true })}
            >
              {save.isPending && <Loader2 className="animate-spin" />}
              Re-embed and save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}

function AiProviderForm({
  settings,
  saving,
  error,
  onSubmit,
}: {
  settings: AISettings;
  saving: boolean;
  error: Error | null;
  onSubmit: (payload: AISettingsUpdate) => void;
}) {
  const [provider, setProvider] = useState<string>(settings.provider || NONE);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelChoices>({ ...settings.models });

  const chosen: Provider | "" = provider === NONE ? "" : (provider as Provider);
  const meta = settings.providers.find((p) => p.value === chosen);
  const needsKey = chosen !== "" && meta?.needs_key !== false;
  const defaults = chosen ? settings.defaults[chosen] : undefined;
  const options = settings.providers.filter((p) => p.available || p.value === settings.provider);

  const providerChanged = chosen !== settings.provider;
  const modelsChanged = MODEL_FIELDS.some(({ field }) => models[field].trim() !== (settings.models[field] ?? ""));
  const dirty = providerChanged || apiKey.trim() !== "" || modelsChanged;

  const choose = (value: string) => {
    const next = value === NONE ? "" : value;
    setProvider(value);
    // Models saved for one provider don't exist at another: start from its defaults, keeping deliberate "none"s
    setModels(
      next === settings.provider
        ? { ...settings.models }
        : (Object.fromEntries(
            MODEL_FIELDS.map(({ field }) => [field, models[field] === "none" ? "none" : ""])
          ) as ModelChoices)
    );
  };

  const setModel = (field: ModelRole) => (event: ChangeEvent<HTMLInputElement>) =>
    setModels((current) => ({ ...current, [field]: event.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      provider: chosen,
      api_key: chosen && apiKey.trim() ? apiKey.trim() : undefined,
      models: Object.fromEntries(MODEL_FIELDS.map(({ field }) => [field, models[field].trim()])) as ModelChoices,
    });
  };

  // A re-embed confirmation is shown in its own dialog, so it isn't repeated here
  const inlineError = error && apiErrorCode(error) !== "reindex_required" ? errorMessage(error) : null;
  const keyPlaceholder =
    settings.has_key && chosen === settings.provider ? `•••• ${settings.key_last4}` : "Paste your API key";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col divide-y">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-provider">Provider</Label>
          <Select value={provider} onValueChange={choose}>
            <SelectTrigger id="ai-provider" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None (read-only)</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  {!option.available && " (unavailable)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsKey && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-key">API key</Label>
            <Input
              id="ai-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={keyPlaceholder}
              className="w-full font-mono sm:w-96"
              aria-describedby="ai-key-hint"
            />
            <p id="ai-key-hint" className="text-xs text-muted-foreground">
              Keys are encrypted on the server and never shown again.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {MODEL_FIELDS.map(({ field, label }) => {
            const hint =
              field === "embedding_model"
                ? `Must return ${settings.embedding_dimensions} values. Changing it re-embeds every document.`
                : CAN_TURN_OFF.includes(field)
                  ? "Type none to turn it off."
                  : null;
            return (
              <div key={field} className="flex flex-col gap-2">
                <Label htmlFor={`ai-${field}`}>{label}</Label>
                <Input
                  id={`ai-${field}`}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={chosen === ""}
                  value={models[field]}
                  onChange={setModel(field)}
                  placeholder={defaults?.[field] ?? ""}
                  className="font-mono text-xs"
                  aria-describedby={hint ? `ai-${field}-hint` : undefined}
                />
                {hint && (
                  <p id={`ai-${field}-hint`} className="text-xs text-muted-foreground">
                    {hint}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {settings.documents_to_reindex > 0 && (
          <p className="text-sm text-muted-foreground">
            {plural(settings.documents_to_reindex, "document")}{" "}
            {settings.documents_to_reindex === 1 ? "is" : "are"} being re-embedded.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          {inlineError && (
            <p role="alert" className="text-sm text-destructive">
              {inlineError}
            </p>
          )}
        </div>
        <Button type="submit" disabled={!dirty || saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Checking with the provider…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
