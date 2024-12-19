import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, MessageSquare, Search } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function Layout() {
  const location = useLocation();

  const links = [
    {
      href: "/",
      label: "Documents",
      icon: <FileText className="h-4 w-4 mr-2" />,
    },
    {
      href: "/chat",
      label: "Chat",
      icon: <MessageSquare className="h-4 w-4 mr-2" />,
    },
    {
      href: "/search",
      label: "Search",
      icon: <Search className="h-4 w-4 mr-2" />,
    },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b bg-gradient-to-r shadow-2xl from-slate-900 to-slate-900 border-white/10">
          <div className="container mx-auto flex h-16 items-center px-4">
            <nav className="flex items-center space-x-6">
              {links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "text-sm font-medium transition-colors flex items-center",
                    location.pathname === link.href
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 min-h-screen py-10 bg-gradient-to-br from-slate-900 to-slate-800">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
