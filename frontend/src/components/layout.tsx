import { SidebarNav } from "@/components/sidebar-nav";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "./ui/sidebar";

const queryClient = new QueryClient();

export function Layout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider defaultOpen={true}>
        {isAuthPage ? (
          <main className="w-full h-screen min-h-screen bg-gray-50">
            <Outlet />
          </main>
        ) : (
          <div className="relative flex w-full h-screen">
            <SidebarNav />
            <main className="flex-1 w-full h-full overflow-auto bg-gray-50">
              <Outlet />
            </main>
          </div>
        )}
      </SidebarProvider>
    </QueryClientProvider>
  );
}
