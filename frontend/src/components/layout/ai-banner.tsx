import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useConfig } from "@/lib/queries";

/** Until an admin adds an AI provider, the organization can't process, search or ask. Not dismissible. */
export function AiBanner() {
  const { data: config } = useConfig();
  const organization = config?.organization;
  if (!organization || organization.ai_configured !== false) return null;
  const isAdmin = organization.role === "admin";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:px-8">
      <span className="size-1.5 shrink-0 rounded-full bg-gold" />
      <p className="min-w-0 flex-1">
        {isAdmin
          ? "Add an AI provider to start processing, searching and asking."
          : `${organization.name} has no AI provider yet. Ask an organization admin to add one.`}
      </p>
      {isAdmin && (
        <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs">
          <Link to="/settings#ai-provider">Open settings</Link>
        </Button>
      )}
    </div>
  );
}
