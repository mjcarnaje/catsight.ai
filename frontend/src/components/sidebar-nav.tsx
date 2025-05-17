import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useSession } from "@/contexts/session-context";
import { cn } from "@/lib/utils";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Tag,
  User,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export function SidebarNav() {
  const { logout, user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Documents",
      href: "/documents",
      icon: FileText,
    },
    {
      title: "Tags",
      href: "/tags",
      icon: Tag,
    },
    {
      title: "Search",
      href: "/search",
      icon: Search,
    },
    {
      title: "Chat",
      href: "/chat",
      icon: MessageSquare,
    },
  ];

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="flex items-center justify-between px-4 py-2">
        <Link to="/" className="flex items-center gap-1">
          <div className="flex items-center gap-2 transition-transform duration-75 hover:scale-[1.01]">
            <img
              src="/icon.png"
              alt="CATSight.AI Logo"
              className="w-auto h-8"
            />
            <span className="text-xl font-bold text-transparent bg-gradient-to-r from-primary to-accent bg-clip-text">
              CATSight.AI
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sidebar-expanded:inline">
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>
      </SidebarContent>
      <SidebarFooter className="px-4 py-2 border-t">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start w-full gap-2"
              >
                <User className="w-4 h-4" />
                <span className="hidden truncate sidebar-expanded:inline">
                  {user.first_name} {user.last_name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  to="/settings"
                  className="flex items-center cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
