import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";

/** Shown instead of the pages to a signed-in user who belongs to no organization yet. */
export function NoOrganization() {
  const { user } = useSession();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={Building2}
        title="You're not in an organization yet"
        description="Ask an organization admin to invite you. The invitation arrives by email."
        action={
          user?.is_super_admin ? (
            <Button asChild>
              <Link to="/admin/organizations">Create an organization</Link>
            </Button>
          ) : undefined
        }
        className="w-full max-w-md"
      />
    </div>
  );
}
