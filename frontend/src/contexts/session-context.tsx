import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi, SESSION_EXPIRED, tokens } from "@/lib/api";
import type { AuthResponse, User } from "@/types";

interface SessionValue {
  user: User | null;
  /** True until we know whether a stored token is still valid. */
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (response: AuthResponse) => void;
  signOut: () => void;
  setUser: (user: User) => void;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(tokens.access()));

  const signOut = useCallback(() => {
    tokens.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const signIn = useCallback(
    (response: AuthResponse) => {
      queryClient.clear(); // nothing cached from a previous account
      tokens.set(response.tokens.access, response.tokens.refresh);
      setUser(response.user);
    },
    [queryClient]
  );

  useEffect(() => {
    if (!tokens.access()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => signOut())
      .finally(() => setIsLoading(false));
  }, [signOut]);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, signOut);
    return () => window.removeEventListener(SESSION_EXPIRED, signOut);
  }, [signOut]);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: Boolean(user), signIn, signOut, setUser }),
    [user, isLoading, signIn, signOut]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
