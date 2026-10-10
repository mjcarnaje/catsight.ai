import { Copy } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/format";
import type { IssuedInvitation } from "@/types";

/**
 * The link of a created or re-sent invitation. The server returns it only once, so it is shown
 * here with a copy button and whether the email went out.
 */
export function InvitationLink({ issued, onDismiss }: { issued: IssuedInvitation; onDismiss?: () => void }) {
  const { toast } = useToast();
  const field = useRef<HTMLInputElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.link);
      toast({ title: "Link copied" });
    } catch {
      field.current?.select();
      toast({ variant: "destructive", title: "Couldn't copy the link", description: "It's selected: copy it yourself." });
    }
  };

  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm">
        {issued.email_sent
          ? `Invitation emailed to ${issued.invitation.email}.`
          : "Email isn't set up here, so copy the link and send it yourself."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={field}
          readOnly
          value={issued.link}
          aria-label="Invitation link"
          onFocus={(event) => event.currentTarget.select()}
          className="h-9 font-mono text-xs"
        />
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={copy}>
          <Copy />
          Copy
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Expires {formatDate(issued.invitation.expires_at)}
        </p>
        {onDismiss && (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
