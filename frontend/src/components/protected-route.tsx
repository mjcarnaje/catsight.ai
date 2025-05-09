import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/session";
import { useUser } from "@/lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useSession();
  const { data: user } = useUser();
  const location = useLocation();

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated but not onboarded, and not already on the onboarding page,
  // redirect to onboarding
  if (user && !user.is_onboarded && !location.pathname.includes('/onboarding')) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
} 