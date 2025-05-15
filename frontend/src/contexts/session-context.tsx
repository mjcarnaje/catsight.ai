import { User } from "@/types";
import axios from "axios";
import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../lib/auth";

interface SessionContextValue {
  user: User | null;
  setUser: (user: User) => void;
  isLoading: boolean;
  hasToken: boolean;
  logout: () => void;
  setHasTokenAndUser: (token: string | null, refreshToken: string | null, newUser: User | null) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasToken, setHasToken] = useState<boolean>(() => !!localStorage.getItem("access_token"));

  const getUser = async () => {
    try {
      const response = await authApi.getProfile();
      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        authApi.logout();
      }
      throw error;
    }
  };

  useEffect(() => {
    const accessToken = localStorage.getItem("access_token");
    setHasToken(!!accessToken);

    if (accessToken && !user) {
      getUser().then((response) => {
        setUser(response);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const setHasTokenAndUser = (token: string | null, refreshToken: string | null, newUser: User | null) => {
    if (token) {
      localStorage.setItem("access_token", token);
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }
    } else {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    setHasToken(!!token);
    setUser(newUser);
  };

  const logout = () => {
    setHasTokenAndUser(null, null, null);
  };

  useEffect(() => {
    const updateTokenStatus = (e: StorageEvent) => {
      if (e.key === "access_token") {
        setHasToken(!!e.newValue);
      }
    };

    window.addEventListener("storage", updateTokenStatus);
    return () => {
      window.removeEventListener("storage", updateTokenStatus);
    };
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user: user || null,
        setUser,
        isLoading,
        hasToken,
        logout,
        setHasTokenAndUser,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
