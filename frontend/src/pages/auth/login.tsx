import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { AuthShell, Divider } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/contexts/session-context";
import { useGuestSignIn } from "@/hooks/use-guest-sign-in";
import { authApi, errorMessage, invitationsApi } from "@/lib/api";
import { useConfig } from "@/lib/queries";

export default function LoginPage() {
  const { signIn } = useSession();
  const { data: config } = useConfig();
  const guest = useGuestSignIn();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [params] = useSearchParams();
  // Arriving from an invitation: the email is known, and signing in continues the invitation
  const invite = params.get("invite");
  const [email, setEmail] = useState("");
  const invitation = useQuery({
    queryKey: ["invitation", invite],
    queryFn: () => invitationsApi.preview(invite ?? ""),
    enabled: Boolean(invite),
    retry: false,
  });
  const invitedEmail = invitation.data?.email;
  useEffect(() => {
    if (invitedEmail) setEmail((current) => current || invitedEmail);
  }, [invitedEmail]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: () => authApi.login(email.trim(), password),
    onSuccess: (response) => {
      signIn(response);
      // Same handler as signIn so the sign-in page's redirect never renders first
      if (invite) navigate(`/invite/${encodeURIComponent(invite)}`, { replace: true });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  const error = login.error;

  return (
    <AuthShell
      title="Sign in to CATSight"
      description="Ask your organization's documents anything, with page-level citations."
      footer={
        <>
          No account yet?{" "}
          <Link to={`/register${search}`} className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {config?.guest_access && !invite && (
          <>
            <Button size="lg" onClick={() => guest.mutate()} disabled={guest.isPending} className="w-full">
              {guest.isPending ? <Loader2 className="animate-spin" /> : null}
              Try the live demo
              <ArrowRight />
            </Button>
            <p className="-mt-3 text-center text-xs text-muted-foreground">
              No sign-up. A private guest session that lasts {config.guest_ttl_hours} hours.
            </p>
            <Divider label="or sign in" />
          </>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={config?.allowed_email_domains[0] ? `you@${config.allowed_email_domains[0]}` : "you@example.com"}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(error)}
            </p>
          )}
          <Button type="submit" variant={config?.guest_access && !invite ? "secondary" : "default"} disabled={login.isPending}>
            {login.isPending && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
