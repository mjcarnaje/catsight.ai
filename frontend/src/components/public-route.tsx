import { useSession } from "@/contexts/session-context";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

export function PublicRoute({ children }: { children: ReactNode }) {
  const { hasToken, user } = useSession();
  const location = useLocation();

  if (hasToken) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return (
    <main className="relative w-full min-h-screen">
      <div className="relative z-10">{children}</div>
    </main>
  );
}
