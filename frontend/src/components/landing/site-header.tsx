import { LayoutDashboard, LogOut, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/contexts/session-context";
import { cn } from "@/lib/utils";
import { PrimaryCta } from "./primary-cta";

const NAV_LINKS = [
  { label: "Product", href: "#top" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Privacy", href: "#privacy" },
];

export function SiteHeader() {
  const { user, signOut } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials = user ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() : "";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
        scrolled ? "border-border bg-background/80 backdrop-blur-lg" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link to="/" aria-label="CATSight.AI home">
          <BrandLogo size="sm" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                    <Avatar className="size-7">
                      <AvatarImage src={user.avatar || undefined} alt={`${user.first_name} ${user.last_name}`} />
                      <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                {/* Portals render outside the landing's .dark wrapper, so re-apply it here. */}
                <DropdownMenuContent className="dark w-56" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium leading-none">
                        {user.is_guest ? "Guest" : `${user.first_name} ${user.last_name}`}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.is_guest ? "Demo session" : user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard">
                        <LayoutDashboard />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings">
                        <Settings />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut />
                    {user.is_guest ? "End demo session" : "Log out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Link to="/login">Sign in</Link>
              </Button>
              <PrimaryCta size="sm" showSignIn={false} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
