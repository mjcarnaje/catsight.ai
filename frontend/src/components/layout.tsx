import { Outlet, useLocation } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarProvider, SidebarTrigger } from "./ui/sidebar";

export function Layout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  return (
    <SidebarProvider defaultOpen={true}>
      {isAuthPage ? (
        <main className="h-screen min-h-screen w-full bg-background">
          <Outlet />
        </main>
      ) : (
        <div className="flex h-screen w-full">
          <SidebarNav />
          <main className="h-full w-full flex-1 overflow-auto bg-background">
            {/* Desktop collapses the sidebar via its rail; phones need a trigger. */}
            <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:hidden">
              <SidebarTrigger />
              <BrandLogo size="sm" />
            </div>
            <Outlet />
          </main>
        </div>
      )}
    </SidebarProvider>
  );
}
