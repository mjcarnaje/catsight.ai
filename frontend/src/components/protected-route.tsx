import { Suspense, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { CatMark } from "@/components/brand/cat-mark";
import { useSession } from "@/contexts/session-context";

export function FullPageLoader() {
  return (
    <div className="grid h-screen place-items-center bg-background">
      <CatMark className="size-9 animate-pulse" sparkle={false} />
    </div>
  );
}

/** Full-screen loader while a lazily loaded page's code arrives. */
export function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageLoader />}>{children}</Suspense>;
}

/** Pages for signed-in people; others go to /login and come back afterwards. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/**
 * Sign-in pages; signed-in people go straight to where they were headed.
 * Guests may still open them, to sign in or create a real account.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <FullPageLoader />;
  if (isAuthenticated && !user?.is_guest) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname;
    return <Navigate to={from && from !== "/login" ? from : "/dashboard"} replace />;
  }
  return <>{children}</>;
}
