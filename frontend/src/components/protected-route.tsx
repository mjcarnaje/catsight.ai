import { useSession } from "@/contexts/session-context";
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { hasToken, user } = useSession();
  const location = useLocation();

  // If not authenticated, redirect to login
  if (!hasToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated but not onboarded, and not already on the onboarding page,
  // redirect to onboarding
  if (
    user &&
    !user.is_onboarded &&
    !location.pathname.includes("/onboarding")
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
