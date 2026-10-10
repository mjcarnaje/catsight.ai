import { useQueryClient } from "@tanstack/react-query";
import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { currentOrganization } from "@/lib/api";
import { useSession } from "@/contexts/session-context";
import type { Membership } from "@/types";

interface OrganizationValue {
  /** The user's memberships, oldest first (empty when signed out or in none). */
  memberships: Membership[];
  /** The membership the app acts through; null when the user is in no organization. */
  current: Membership | null;
  isAdmin: boolean;
  isGuest: boolean;
  /** Act in another organization: the cache is cleared and every page below remounts. */
  switchTo: (slug: string) => void;
}

const OrganizationContext = createContext<OrganizationValue | undefined>(undefined);

/**
 * Which organization the app acts in. The choice is stored (currentOrganization) and
 * sent as X-Organization on every request; a stored slug the user no longer belongs to
 * falls back to their oldest membership.
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<string | null>(() => currentOrganization.get());
  const memberships = useMemo(() => user?.memberships ?? [], [user]);

  const current = useMemo(
    () => memberships.find((m) => m.organization.slug === chosen) ?? memberships[0] ?? null,
    [memberships, chosen]
  );

  // Written during render, not in an effect: children's queries run in their own effects,
  // which fire before this provider's, and must already send the right header.
  const slug = current?.organization.slug ?? null;
  if (user) {
    if (slug && currentOrganization.get() !== slug) currentOrganization.set(slug);
    if (!slug && currentOrganization.get()) currentOrganization.clear();
  }

  const switchTo = useCallback(
    (next: string) => {
      if (next === currentOrganization.get()) return;
      currentOrganization.set(next);
      setChosen(next);
      queryClient.clear();
    },
    [queryClient]
  );

  const value = useMemo(
    () => ({
      memberships,
      current,
      isAdmin: current?.role === "admin",
      isGuest: current?.role === "guest",
      switchTo,
    }),
    [memberships, current, switchTo]
  );
  // Keyed by organization: on a switch everything below remounts, so no mounted page keeps
  // showing (or acting on) the previous organization's data from its last query result
  return (
    <OrganizationContext.Provider value={value}>
      <Fragment key={slug ?? "none"}>{children}</Fragment>
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error("useOrganization must be used inside OrganizationProvider");
  return context;
}
