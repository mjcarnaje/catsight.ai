import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { ROLE_LABELS, orgAdminKeys, useInvitations } from "@/components/admin/shared";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { errorMessage, organizationApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invitation, IssuedInvitation } from "@/types";

const STATUS_ORDER: Record<Invitation["status"], number> = { pending: 0, expired: 1, accepted: 2 };
const STATUS_LABEL: Record<Invitation["status"], string> = { pending: "Pending", expired: "Expired", accepted: "Accepted" };

/**
 * Invitations of the organization, pending first. Pending and expired ones can be sent again
 * (which issues a new link through `onIssued`) or revoked; accepted ones are only a record.
 */
export function InvitationsList({ onIssued }: { onIssued: (issued: IssuedInvitation) => void }) {
  const invitations = useInvitations(true);

  if (invitations.isPending) {
    return (
      <ul role="status" aria-label="Loading invitations" className="divide-y rounded-lg border">
        {Array.from({ length: 2 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 flex-1" />
          </li>
        ))}
      </ul>
    );
  }

  if (invitations.isError) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        {errorMessage(invitations.error, "Couldn't load the invitations.")}
      </p>
    );
  }

  if (invitations.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No invitations yet.</p>;
  }

  const sorted = [...invitations.data].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return (
    <ul className="divide-y rounded-lg border">
      {sorted.map((invitation) => (
        <InvitationRow key={invitation.id} invitation={invitation} onIssued={onIssued} />
      ))}
    </ul>
  );
}

function InvitationRow({
  invitation,
  onIssued,
}: {
  invitation: Invitation;
  onIssued: (issued: IssuedInvitation) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [revoking, setRevoking] = useState(false);
  const open = invitation.status !== "accepted";

  const refresh = () => queryClient.invalidateQueries({ queryKey: orgAdminKeys.invitations });

  const resend = useMutation({
    mutationFn: () => organizationApi.resendInvitation(invitation.id),
    onSuccess: (issued) => {
      void refresh();
      onIssued(issued);
      toast({
        title: issued.email_sent ? "Invitation sent again" : "New link ready",
        description: invitation.email,
      });
    },
    onError: (error) => {
      void refresh(); // the status may have changed (accepted, or revoked elsewhere)
      toast({ variant: "destructive", title: "Couldn't send the invitation again", description: errorMessage(error) });
    },
  });

  const revoke = useMutation({
    mutationFn: () => organizationApi.revokeInvitation(invitation.id),
    onSuccess: async () => {
      setRevoking(false);
      await refresh();
      toast({ title: "Invitation revoked", description: invitation.email });
    },
    onError: (error) => {
      setRevoking(false);
      toast({ variant: "destructive", title: "Couldn't revoke the invitation", description: errorMessage(error) });
    },
  });

  const detail =
    invitation.status === "pending"
      ? `Expires ${formatDate(invitation.expires_at, "MMM d")}`
      : invitation.status === "expired"
        ? "Link expired"
        : `Joined ${formatDate(invitation.accepted_at, "MMM d, yyyy")}`;

  return (
    <li className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !open && "text-muted-foreground")}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm">{invitation.email}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {ROLE_LABELS[invitation.role]}
          {invitation.invited_by ? ` · invited by ${invitation.invited_by}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">{detail}</span>
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
          {STATUS_LABEL[invitation.status]}
        </Badge>
        {open && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
            >
              {resend.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
              Resend
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Revoke the invitation for ${invitation.email}`}
              onClick={() => setRevoking(true)}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={revoking} onOpenChange={(next) => !next && !revoke.isPending && setRevoking(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke the invitation for {invitation.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its link stops working. You can invite them again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
              {revoke.isPending && <Loader2 className="animate-spin" />}
              Revoke invitation
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
