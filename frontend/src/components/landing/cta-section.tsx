import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";
import { Reveal } from "./reveal";

export function CtaSection() {
  const { user } = useSession();

  return (
    <section className="px-4 py-24 sm:px-6 sm:py-36">
      <Reveal className="mx-auto flex max-w-6xl flex-col items-start gap-8 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">
          Stop digging through folders.
          <br />
          <span className="text-muted-foreground">Start asking.</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button asChild size="lg" className="px-5">
            <Link to={user ? "/dashboard" : "/register"}>{user ? "Open dashboard" : "Get started"}</Link>
          </Button>
          {!user && (
            <Button asChild size="lg" variant="ghost" className="px-5 text-muted-foreground hover:text-foreground">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </Reveal>
    </section>
  );
}
