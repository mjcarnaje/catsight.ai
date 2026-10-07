import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AuthShell, Divider, GoogleIcon } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/contexts/session-context";
import { useGuestSignIn } from "@/hooks/use-guest-sign-in";
import { authApi, errorMessage } from "@/lib/api";
import { useConfig } from "@/lib/queries";

export default function LoginPage() {
  const { signIn } = useSession();
  const { data: config } = useConfig();
  const guest = useGuestSignIn();
  const [params, setParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: () => authApi.login(email.trim(), password),
    onSuccess: signIn,
  });
  const google = useMutation({ mutationFn: authApi.google, onSuccess: signIn });
  const exchangeGoogleCode = google.mutate;

  // Google redirects back here with ?code=...; exchange it once
  const exchanged = useRef(false);
  useEffect(() => {
    const code = params.get("code");
    if (code && !exchanged.current) {
      exchanged.current = true;
      setParams({}, { replace: true });
      exchangeGoogleCode(code);
    }
  }, [params, setParams, exchangeGoogleCode]);

  const startGoogle = () => {
    const query = new URLSearchParams({
      client_id: config!.google_client_id,
      redirect_uri: `${window.location.origin}/login`,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  const error = login.error ?? google.error;

  return (
    <AuthShell
      title="Sign in to CATSight"
      description="Ask the university's documents anything, with page-level citations."
      footer={
        <>
          No account yet?{" "}
          <Link to="/register" className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {config?.guest_access && (
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

        {config?.google_login && (
          <Button variant="outline" size="lg" onClick={startGoogle} disabled={google.isPending} className="w-full">
            {google.isPending ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>
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
          <Button type="submit" variant={config?.guest_access ? "secondary" : "default"} disabled={login.isPending}>
            {login.isPending && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
