import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";

/** Ends the session on this device. */
export function SessionSection() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();

  const leave = () => {
    // Move to the public page first so the signed-out state never renders under a protected route
    navigate("/", { replace: true });
    signOut();
  };

  return (
    <SettingsSection id="settings-session" label="Session" description="Signing out only affects this browser.">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="min-w-0 break-all text-sm text-muted-foreground">
          {user?.is_guest ? "Guest session" : user?.email}
        </p>
        <Button variant="outline" onClick={leave}>
          <LogOut />
          Sign out
        </Button>
      </div>
    </SettingsSection>
  );
}
