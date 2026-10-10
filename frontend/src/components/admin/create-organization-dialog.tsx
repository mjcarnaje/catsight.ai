import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { InvitationLink } from "@/components/admin/invitation-link";
import { orgAdminKeys } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { adminApi, authApi, errorMessage } from "@/lib/api";
import type { AdminOrganizationCreated, TagPreset } from "@/types";

const PRESETS: { value: TagPreset; label: string }[] = [
  { value: "general", label: "General" },
  { value: "msu-iit", label: "MSU-IIT (thesis)" },
];

/** Creates an organization. When it comes with an admin invitation, the link is shown before closing. */
export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [created, setCreated] = useState<AdminOrganizationCreated | null>(null);
  const close = (next: boolean) => {
    if (!next) setCreated(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        {created?.invitation ? (
          <>
            <DialogHeader>
              <DialogTitle>Organization created</DialogTitle>
              <DialogDescription>
                {created.organization.name} is ready. Its first admin needs this invitation link.
              </DialogDescription>
            </DialogHeader>
            <InvitationLink issued={created.invitation} onDismiss={() => close(false)} />
          </>
        ) : (
          <CreateForm onCreated={setCreated} onCancel={() => close(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (created: AdminOrganizationCreated) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const { setUser } = useSession();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [preset, setPreset] = useState<TagPreset>("general");
  const [adminEmail, setAdminEmail] = useState("");
  const [addMe, setAddMe] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      adminApi.createOrganization({
        name: name.trim(),
        slug: slug.trim() || undefined,
        preset,
        admin_email: adminEmail.trim() || undefined,
        add_me: addMe,
      }),
    onSuccess: async (result) => {
      void queryClient.invalidateQueries({ queryKey: orgAdminKeys.organizations });
      // The new membership only appears in the session once the user is refreshed
      if (addMe) setUser(await authApi.me());
      if (result.invitation) {
        onCreated(result);
      } else {
        toast({ title: "Organization created", description: result.organization.name });
        onCancel();
      }
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>New organization</DialogTitle>
        <DialogDescription>Each organization has its own library, members and AI provider.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-create-name">Name</Label>
        <Input
          id="organization-create-name"
          autoFocus
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. College of Engineering"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-create-slug">
          Slug <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="organization-create-slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          pattern="[a-z0-9-]*"
          title="Lowercase letters, numbers and dashes"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          aria-describedby="organization-create-slug-hint"
        />
        <p id="organization-create-slug-hint" className="text-xs text-muted-foreground">
          Lowercase letters, numbers and dashes; leave empty to generate.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-create-preset">Tag preset</Label>
        <Select value={preset} onValueChange={(value) => setPreset(value as TagPreset)}>
          <SelectTrigger id="organization-create-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-create-admin">
          First admin email <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="organization-create-admin"
          type="email"
          autoComplete="off"
          value={adminEmail}
          onChange={(event) => setAdminEmail(event.target.value)}
          aria-describedby="organization-create-admin-hint"
        />
        <p id="organization-create-admin-hint" className="text-xs text-muted-foreground">
          They get an invitation to become the organization's first admin.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="organization-create-me" checked={addMe} onCheckedChange={(checked) => setAddMe(checked === true)} />
        <Label htmlFor="organization-create-me" className="font-normal">
          Make me an admin of it
        </Label>
      </div>

      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(create.error)}
        </p>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          Create organization
        </Button>
      </DialogFooter>
    </form>
  );
}
