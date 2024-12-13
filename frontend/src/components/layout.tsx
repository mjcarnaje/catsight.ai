import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Layout() {
  const location = useLocation();

  const links = [
    { href: "/", label: "Documents" },
    { href: "/chat", label: "Chat" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <nav className="flex items-center space-x-4 lg:space-x-6">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === link.href
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
