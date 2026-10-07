import { X } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/contexts/session-context";
import { useConfig } from "@/lib/queries";

const DISMISSED = "catsight:guest-banner-dismissed";

/** Tells guests their session is temporary (once; dismissible). */
export function GuestBanner() {
  const { user } = useSession();
  const { data: config } = useConfig();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED) === "1";
    } catch {
      return false;
    }
  });
  if (!user?.is_guest || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED, "1");
    } catch {
      /* private mode */
    }
  };

  return (
    <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:px-8">
      <span className="size-1.5 shrink-0 rounded-full bg-gold" />
      <p className="flex-1">
        You're exploring a live demo as a guest. Your chats and uploads are private and are deleted after{" "}
        {config?.guest_ttl_hours ?? 24} hours.
      </p>
      <button onClick={dismiss} className="rounded p-1 hover:bg-accent hover:text-foreground" aria-label="Dismiss">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
