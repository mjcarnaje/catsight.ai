import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/contexts/session-context";

export function PublicRoute({ children }: { children: ReactNode }) {
  const { hasToken } = useSession();
  const location = useLocation();

  if (hasToken) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
