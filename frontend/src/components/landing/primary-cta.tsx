import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";
import { useGuestSignIn } from "@/hooks/use-guest-sign-in";
import { useConfig } from "@/lib/queries";

/** The landing page's main action: the dashboard, the one-click demo, or sign-up. */
export function PrimaryCta({ size = "lg", showSignIn = true }: { size?: "sm" | "lg"; showSignIn?: boolean }) {
  const { user } = useSession();
  const { data: config } = useConfig();
  const guest = useGuestSignIn();
  const padding = size === "lg" ? "px-5" : undefined;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {user ? (
        <Button asChild size={size} className={padding}>
          <Link to="/dashboard">Open dashboard</Link>
        </Button>
      ) : config?.guest_access ? (
        <Button size={size} className={padding} onClick={() => guest.mutate()} disabled={guest.isPending}>
          {guest.isPending && <Loader2 className="animate-spin" />}
          Try the live demo
          {size === "lg" && <ArrowRight />}
        </Button>
      ) : (
        <Button asChild size={size} className={padding}>
          <Link to="/register">Get started</Link>
        </Button>
      )}
      {!user && showSignIn && (
        <Button asChild size={size} variant="ghost" className={`${padding ?? ""} text-muted-foreground hover:text-foreground`}>
          <Link to="/login">Sign in</Link>
        </Button>
      )}
    </div>
  );
}
