import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GuestBanner } from "@/components/layout/guest-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AppLayout() {
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);

  // Pages scroll inside this column, so start each page at the top
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="h-svh min-w-0 overflow-hidden bg-background">
        {/* Desktop collapses the sidebar via its rail; phones need a trigger */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
          <BrandLogo size="sm" />
        </div>
        <GuestBanner />
        <div ref={scroller} id="app-scroll" className="min-h-0 flex-1 overflow-y-auto">
          {/* Pages load on demand; the sidebar stays put meanwhile */}
          <Suspense fallback={<div className="h-full animate-pulse bg-background" />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
