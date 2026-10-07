import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/use-toast";
import { stageOf } from "@/lib/document-stages";
import { documentsApi, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";

type ReprocessOptions = NonNullable<Parameters<typeof documentsApi.reprocess>[1]>;

/**
 * Retry a failed document or re-run part of the pipeline. With no options the backend resumes
 * from the stage that failed. Errors (403 for demo visitors re-running finished documents,
 * 429 when the daily limit is used up) are shown as a toast using the API's own message.
 *
 * @example
 * const reprocess = useReprocess(doc.id);
 * <Button onClick={() => reprocess.mutate({})}>Retry</Button>
 */
export function useReprocess(id: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (options: ReprocessOptions) => documentsApi.reprocess(id, options),
    onSuccess: (data) => {
      toast({
        title: "Processing restarted",
        description: `Starting again from the ${stageOf(data.from).label.toLowerCase()} step.`,
      });
      queryClient.invalidateQueries({ queryKey: keys.document(id) });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.config });
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Couldn't restart processing", description: errorMessage(error) }),
  });
}
