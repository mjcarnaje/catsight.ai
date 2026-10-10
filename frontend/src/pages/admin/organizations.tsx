import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog";
import { DeleteOrganizationDialog } from "@/components/admin/delete-organization-dialog";
import { orgAdminKeys } from "@/components/admin/shared";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { adminApi, errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import type { AdminOrganization, Provider } from "@/types";

const PROVIDER_LABEL: Record<Provider, string> = { openrouter: "OpenRouter", openai: "OpenAI", ollama: "Ollama" };

/** Every organization on this deployment. Super admins only. */
export default function OrganizationsPage() {
  const { user } = useSession();
  if (!user?.is_super_admin) return <Navigate to="/dashboard" replace />;
  return <OrganizationsAdmin />;
}

function OrganizationsAdmin() {
  const organizations = useQuery({ queryKey: orgAdminKeys.organizations, queryFn: adminApi.organizations });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminOrganization | null>(null);

  return (
    <PageContainer>
      <PageHeader
        title="Organizations"
        description="Every organization on this deployment, with its size and what it may use."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New organization
          </Button>
        }
      />

      {organizations.isPending ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4" role="status" aria-label="Loading organizations">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : organizations.isError ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="break-words">{errorMessage(organizations.error, "Couldn't load the organizations.")}</p>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => void organizations.refetch()}>
              Try again
            </Button>
          </div>
        </div>
      ) : organizations.data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No organizations yet"
          description="Create the first one. It gets its own library, members and AI provider."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              New organization
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {plural(organizations.data.length, "organization")}
          </p>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Documents</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Ollama</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.data.map((organization) => (
                  <OrganizationRow key={organization.id} organization={organization} onDelete={setDeleting} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <CreateOrganizationDialog open={creating} onOpenChange={setCreating} />
      <DeleteOrganizationDialog organization={deleting} onClose={() => setDeleting(null)} />
    </PageContainer>
  );
}

function OrganizationRow({
  organization,
  onDelete,
}: {
  organization: AdminOrganization;
  onDelete: (organization: AdminOrganization) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const setOllama = useMutation({
    mutationFn: (allowed: boolean) => adminApi.updateOrganization(organization.id, { ollama_allowed: allowed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgAdminKeys.organizations }),
    onError: (error) =>
      toast({ variant: "destructive", title: "Couldn't change Ollama access", description: errorMessage(error) }),
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{organization.name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{organization.slug}</TableCell>
      <TableCell className="text-right tabular-nums">{organization.member_count}</TableCell>
      <TableCell className="text-right tabular-nums">{organization.document_count}</TableCell>
      <TableCell className="text-sm">
        {PROVIDER_LABEL[organization.ai_provider as Provider] ?? "—"}
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`Allow Ollama for ${organization.name}`}
          checked={organization.ollama_allowed}
          disabled={setOllama.isPending}
          onCheckedChange={(allowed) => setOllama.mutate(allowed)}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${organization.name}`}
          onClick={() => onDelete(organization)}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}
