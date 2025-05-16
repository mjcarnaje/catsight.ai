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
    <main className="relative w-full min-h-screen bg-white">
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          "[background-size:20px_20px]",
          "[background-image:radial-gradient(#e8e8e8_1px,transparent_1px)]",
          "z-0"
        )}
      />
      <div className="relative z-10">{children}</div>
    </main>
  );
}
