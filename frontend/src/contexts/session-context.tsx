import { createContext, useContext, useEffect, useState } from "react";
import { User, useUser } from "../lib/auth";

interface SessionContextValue {
  user: User | null;
  isLoading: boolean;
  hasToken: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = useState<boolean>(false);
  const { data: user, isLoading, error } = useUser();

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setHasToken(false);
  };

  const value = {
    user: user || null,
    isLoading,
    hasToken,
    logout,
  };

  useEffect(() => {
    window.addEventListener("storage", (e) => {
      if (e.key === "access_token") {
        setHasToken(!!e.newValue);
      }
    });
    return () => {
      window.removeEventListener("storage", (e) => {
        if (e.key === "access_token") {
          setHasToken(!!e.newValue);
        }
      });
    };
  }, [hasToken]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
