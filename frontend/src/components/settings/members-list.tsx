import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { ROLE_LABELS, fullName, initialsOf, orgAdminKeys, useMembers } from "@/components/admin/shared";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { authApi, errorMessage, organizationApi } from "@/lib/api";
import type { Member, OrgRole } from "@/types";

const ROLES: OrgRole[] = ["admin", "member", "guest"];

/** Members with their role; admins change roles and remove people here. */
export function MembersList() {
  const members = useMembers(true);

  if (members.isPending) {
    return (
      <ul role="status" aria-label="Loading members" className="divide-y rounded-lg border">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </li>
        ))}
      </ul>
    );
  }

  if (members.isError) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        {errorMessage(members.error, "Couldn't load the members.")}
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {members.data.map((member) => (
        <MemberRow key={member.id} member={member} />
      ))}
    </ul>
  );
}

function MemberRow({ member }: { member: Member }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setUser } = useSession();
  const [removing, setRemoving] = useState(false);
  const name = fullName(member.user);

  const refresh = () => queryClient.invalidateQueries({ queryKey: orgAdminKeys.members });

  const changeRole = useMutation({
    mutationFn: (role: OrgRole) => organizationApi.setRole(member.id, role),
    onSuccess: async () => {
      await refresh();
      // Changing your own role changes what the session may do here
      if (member.is_you) setUser(await authApi.me());
      toast({ title: "Role updated", description: name });
    },
    onError: (error) => {
      void refresh();
      toast({ variant: "destructive", title: "Couldn't change the role", description: errorMessage(error) });
    },
  });

  const remove = useMutation({
    mutationFn: () => organizationApi.removeMember(member.id),
    onSuccess: async () => {
      setRemoving(false);
      await refresh();
      toast({ title: "Member removed", description: name });
    },
    onError: (error) => {
      setRemoving(false);
      toast({ variant: "destructive", title: "Couldn't remove the member", description: errorMessage(error) });
    },
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={member.user.avatar || undefined} alt="" />
        <AvatarFallback className="text-xs">{initialsOf(member.user)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
      </div>
      <Select
        value={member.role}
        onValueChange={(role) => changeRole.mutate(role as OrgRole)}
        disabled={changeRole.isPending}
      >
        <SelectTrigger aria-label={`Role of ${name}`} className="h-8 w-28 shrink-0 text-xs shadow-none sm:w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {member.is_you ? (
        <span className="w-8 shrink-0 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          You
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${name}`}
          onClick={() => setRemoving(true)}
        >
          <Trash2 />
        </Button>
      )}

      <AlertDialog open={removing} onOpenChange={(open) => !open && !remove.isPending && setRemoving(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to this organization's library and chats. An admin can invite them back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending && <Loader2 className="animate-spin" />}
              Remove member
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
