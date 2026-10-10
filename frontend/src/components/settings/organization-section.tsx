import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { InvitationLink } from "@/components/admin/invitation-link";
import { ROLE_LABELS, orgAdminKeys, useMembers } from "@/components/admin/shared";
import { InvitationsList } from "@/components/settings/invitations-list";
import { MembersList } from "@/components/settings/members-list";
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
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "@/contexts/organization-context";
import { useSession } from "@/contexts/session-context";
import { authApi, errorMessage, organizationApi } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { IssuedInvitation, OrgRole } from "@/types";

type InvitableRole = Exclude<OrgRole, "guest">;
const INVITABLE: { value: InvitableRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

/** The current organization: its name and your role, and for admins the members, invitations and leaving. */
export function OrganizationSection() {
  const { current, isAdmin, isGuest } = useOrganization();
  const members = useMembers(isAdmin);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (!current) return null;
  const name = current.organization.name;

  // Members can leave; an admin only while another admin remains (that needs the member list).
  // Guests are temporary demo accounts and simply expire.
  const adminCount = members.data?.filter((member) => member.role === "admin").length ?? 0;
  const canLeave = isAdmin ? adminCount > 1 : !isGuest;

  return (
    <SettingsSection
      id="settings-organization"
      label="Organization"
      description={
        isAdmin
          ? "Admins manage the members, invitations and AI provider. Everyone here shares the library."
          : "The library and chats that everyone in this organization shares."
      }
    >
      <div className="flex flex-col divide-y">
        <div className="flex flex-col gap-3 p-5">
          {isAdmin ? <RenameForm name={name} /> : <p className="text-sm font-medium">{name}</p>}
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Your role · {ROLE_LABELS[current.role]}
          </span>
        </div>

        {isAdmin && (
          <>
            <div className="flex flex-col gap-3 p-5">
              <SectionLabel>Members</SectionLabel>
              <MembersList />
            </div>

            <div className="flex flex-col gap-3 p-5">
              <SectionLabel>Invite</SectionLabel>
              <InviteForm onIssued={setIssued} />
              {issued && <InvitationLink issued={issued} onDismiss={() => setIssued(null)} />}
            </div>

            <div className="flex flex-col gap-3 p-5">
              <SectionLabel>Invitations</SectionLabel>
              <InvitationsList onIssued={setIssued} />
            </div>
          </>
        )}

        {canLeave && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="text-sm text-muted-foreground">You'll lose access to this organization's library and chats.</p>
            <Button variant="outline" onClick={() => setLeaving(true)}>
              <LogOut />
              Leave organization
            </Button>
          </div>
        )}
      </div>

      {canLeave && (
        <LeaveDialog open={leaving} onOpenChange={setLeaving} membershipId={current.id} name={name} />
      )}
    </SettingsSection>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

function RenameForm({ name }: { name: string }) {
  const queryClient = useQueryClient();
  const { setUser } = useSession();
  const { toast } = useToast();
  const [value, setValue] = useState(name);

  useEffect(() => {
    setValue(name);
  }, [name]);

  const rename = useMutation({
    mutationFn: (next: string) => organizationApi.rename(next),
    onSuccess: async () => {
      // The name is read from the memberships (the sidebar and switcher use them)
      setUser(await authApi.me());
      void queryClient.invalidateQueries({ queryKey: keys.config });
      toast({ title: "Organization renamed" });
    },
    onError: (error) => toast({ variant: "destructive", title: "Couldn't rename it", description: errorMessage(error) }),
  });

  const next = value.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (next && next !== name) rename.mutate(next);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2 sm:flex-row">
      <Label htmlFor="organization-name" className="sr-only">
        Organization name
      </Label>
      <Input
        id="organization-name"
        value={value}
        maxLength={255}
        onChange={(event) => setValue(event.target.value)}
        className="sm:max-w-sm"
      />
      <Button type="submit" variant="outline" disabled={!next || next === name || rename.isPending} className="shrink-0">
        {rename.isPending && <Loader2 className="animate-spin" />}
        Save name
      </Button>
    </form>
  );
}

function InviteForm({ onIssued }: { onIssued: (issued: IssuedInvitation) => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("member");

  const invite = useMutation({
    mutationFn: () => organizationApi.invite(email.trim(), role),
    onSuccess: (result) => {
      setEmail("");
      onIssued(result);
      void queryClient.invalidateQueries({ queryKey: orgAdminKeys.invitations });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) invite.mutate();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          aria-label="Email address to invite"
          placeholder="name@example.com"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="sm:flex-1"
        />
        <Select value={role} onValueChange={(value) => setRole(value as InvitableRole)}>
          <SelectTrigger aria-label="Role for the invitation" className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITABLE.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!email.trim() || invite.isPending} className="shrink-0">
          {invite.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Create invitation
        </Button>
      </div>
      {invite.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(invite.error)}
        </p>
      )}
    </form>
  );
}

function LeaveDialog({
  open,
  onOpenChange,
  membershipId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: number;
  name: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setUser } = useSession();
  const { toast } = useToast();

  const leave = useMutation({
    mutationFn: () => organizationApi.removeMember(membershipId),
    onSuccess: async () => {
      setUser(await authApi.me());
      // Everything cached belongs to the organization just left
      queryClient.clear();
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      onOpenChange(false);
      toast({ variant: "destructive", title: "Couldn't leave the organization", description: errorMessage(error) });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !leave.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll lose access to its library and chats. An admin can invite you back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leave.isPending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={leave.isPending} onClick={() => leave.mutate()}>
            {leave.isPending && <Loader2 className="animate-spin" />}
            Leave organization
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
