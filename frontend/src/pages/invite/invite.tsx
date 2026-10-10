import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { apiErrorCode, apiErrorStatus, orgAdminKeys } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/organization-context";
import { useSession } from "@/contexts/session-context";
import { authApi, errorMessage, invitationsApi } from "@/lib/api";

/** Opened from an invitation link. Public: works signed out, and the account must be the invited address. */
export default function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: sessionLoading, setUser, signOut } = useSession();
  const { switchTo } = useOrganization();

  const preview = useQuery({
    queryKey: orgAdminKeys.invitation(token),
    queryFn: () => invitationsApi.preview(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => invitationsApi.accept(token),
    onSuccess: async ({ membership }) => {
      setUser(await authApi.me());
      switchTo(membership.organization.slug);
      // Whatever was cached belongs to the organization they were in before
      queryClient.clear();
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      // The invitation changed under us: show its current state instead
      const code = apiErrorCode(error);
      if (code === "expired" || code === "already_used") {
        void queryClient.invalidateQueries({ queryKey: orgAdminKeys.invitation(token) });
      }
    },
  });

  if (sessionLoading || preview.isPending) {
    return (
      <AuthShell title="Invitation" description={<Skeleton className="mx-auto h-4 w-56" />} footer={null}>
        <div className="flex flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthShell>
    );
  }

  if (preview.isError || !preview.data) {
    const notFound = apiErrorStatus(preview.error) === 404;
    return (
      <AuthShell
        title="Invitation"
        description={
          notFound ? "This invitation link isn't valid." : errorMessage(preview.error, "Couldn't load the invitation.")
        }
        footer={<HomeLink />}
      >
        {null}
      </AuthShell>
    );
  }

  const { organization, email, role, status, invited_by_name, account_exists } = preview.data;

  if (status === "expired") {
    return (
      <AuthShell
        title="Invitation expired"
        description={`This invitation has expired. Ask ${invited_by_name ?? "the admin"} for a new one.`}
        footer={<HomeLink />}
      >
        {null}
      </AuthShell>
    );
  }

  if (status === "accepted") {
    return (
      <AuthShell title="Already accepted" description="This invitation was already accepted." footer={null}>
        <Button asChild className="w-full">
          <Link to="/dashboard">Go to the dashboard</Link>
        </Button>
      </AuthShell>
    );
  }

  const signedInAsInvitee = Boolean(user && !user.is_guest && user.email.toLowerCase() === email.toLowerCase());
  const signedInAsOther = Boolean(user) && !signedInAsInvitee;
  const acceptError = accept.error ? describeAcceptError(accept.error) : null;
  // Only the token travels in the URL; the sign-in pages look the address up from it
  const query = `invite=${encodeURIComponent(token)}`;

  return (
    <AuthShell
      title={`Join ${organization.name}`}
      description={`${invited_by_name ?? "An admin"} invited you to join ${organization.name} as ${role}.`}
      footer={null}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Invited address</span>
          <p className="break-all text-sm">{email}</p>
        </div>

        {signedInAsInvitee ? (
          <div className="flex flex-col gap-3">
            <Button onClick={() => accept.mutate()} disabled={accept.isPending} className="w-full">
              {accept.isPending && <Loader2 className="animate-spin" />}
              Accept invitation
            </Button>
            {acceptError && (
              <p role="alert" className="text-sm text-destructive">
                {acceptError}
              </p>
            )}
          </div>
        ) : signedInAsOther ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              This invitation is for {email}, but you're signed in as {user?.is_guest ? "a guest" : user?.email}.
            </p>
            <Button variant="outline" onClick={() => signOut()} className="w-full">
              Sign out
            </Button>
          </div>
        ) : account_exists ? (
          <Button asChild className="w-full">
            <Link to={`/login?${query}`}>Sign in to accept</Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to={`/register?${query}`}>Create an account</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}

function describeAcceptError(error: unknown) {
  switch (apiErrorCode(error)) {
    case "already_used":
      return "This invitation was already accepted.";
    case "expired":
      return "This invitation has expired. Ask for a new one.";
    default:
      return errorMessage(error);
  }
}

function HomeLink() {
  return (
    <Link to="/" className="text-foreground underline-offset-4 hover:underline">
      Back to CATSight
    </Link>
  );
}
