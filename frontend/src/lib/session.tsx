import { createContext, useContext, useEffect, useState } from "react";
import { useUser, authApi, User, useLogout } from "./auth";

interface SessionContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authApi.isAuthenticated());
  const { data: user, isLoading, error } = useUser();
  const logout = useLogout();

  useEffect(() => {
    // Update authentication state when tokens change
    setIsAuthenticated(authApi.isAuthenticated());
  }, [user]);

  const value = {
    user: user || null,
    isLoading,
    isAuthenticated,
    logout,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
} 