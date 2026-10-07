import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/contexts/session-context";
import { authApi, errorMessage } from "@/lib/api";
import { useConfig } from "@/lib/queries";

export default function RegisterPage() {
  const { signIn } = useSession();
  const { data: config } = useConfig();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const register = useMutation({ mutationFn: () => authApi.register(form), onSuccess: signIn });
  const domains = config?.allowed_email_domains ?? [];

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate();
  };

  return (
    <AuthShell
      title="Create your account"
      description={
        domains.length
          ? `Use your ${domains.map((d) => "@" + d).join(" or ")} email address.`
          : "Keep your chats and uploads between visits."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} required />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={set("password")}
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters; not a common password.
          </p>
        </div>
        {register.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(register.error)}
          </p>
        )}
        <Button type="submit" disabled={register.isPending}>
          {register.isPending && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
