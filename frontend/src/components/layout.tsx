import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router-dom";

const queryClient = new QueryClient();

export function Layout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isChatPage = location.pathname.startsWith("/chat");

  if (isChatPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthPage && !isChatPage && <Navbar />}
      <main className={cn("h-screen p-4 bg-gray-50 min-h-screen", !isAuthPage ? "pt-4" : "")}>
        <Outlet />
      </main>
    </QueryClientProvider>
  );
}
