import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { orgAdminKeys } from "@/components/admin/shared";
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
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { adminApi, authApi, errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import type { AdminOrganization } from "@/types";

/** Deletes an organization once its slug is typed exactly. The super admin may have been a member of it. */
export function DeleteOrganizationDialog({
  organization,
  onClose,
}: {
  organization: AdminOrganization | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { setUser } = useSession();
  const { toast } = useToast();
  const [typed, setTyped] = useState("");

  // Keep showing the organization while the dialog fades out
  const [shown, setShown] = useState(organization);
  if (organization && organization !== shown) setShown(organization);

  useEffect(() => {
    setTyped("");
  }, [organization]);

  const remove = useMutation({
    mutationFn: (target: AdminOrganization) => adminApi.deleteOrganization(target.id, target.slug),
    onSuccess: async (_data, target) => {
      void queryClient.invalidateQueries({ queryKey: orgAdminKeys.organizations });
      setUser(await authApi.me());
      toast({ title: "Organization deleted", description: target.name });
      onClose();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Couldn't delete the organization", description: errorMessage(error) });
    },
  });

  const confirmed = Boolean(shown) && typed === shown.slug;

  return (
    <AlertDialog open={organization !== null} onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{shown?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes its {plural(shown?.document_count ?? 0, "document")}, chats and memberships. It
            can't be undone. Type the slug <span className="font-mono text-foreground">{shown?.slug}</span> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          aria-label="Type the organization's slug to confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending || !confirmed}
            onClick={() => shown && remove.mutate(shown)}
          >
            {remove.isPending && <Loader2 className="animate-spin" />}
            Delete organization
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
