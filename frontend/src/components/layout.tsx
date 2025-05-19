import { SidebarNav } from "@/components/sidebar-nav";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "./ui/sidebar";

export function Layout() {
  const location = useLocation();
  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/register";

  return (
    <SidebarProvider defaultOpen={true}>
      {isAuthPage ? (
        <main className="w-full h-screen min-h-screen bg-gray-50">
          <Outlet />
        </main>
      ) : (
        <div className="flex w-full h-screen">
          <SidebarNav />
          <main className="flex-1 w-full h-full overflow-auto bg-gray-50">
            <Outlet />
          </main>
        </div>
      )}
    </SidebarProvider>
  );
}
