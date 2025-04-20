import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useUser } from "@/lib/auth";
import { FileText, LogOut, User, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function Navbar() {
  const { data: user } = useUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="flex items-center justify-center w-full border-b">
      <div className="container flex items-center justify-between h-16 mx-auto">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-xl font-bold">
            Intel Docs
          </Link>
          <nav className="items-center hidden gap-6 md:flex">
            <Link
              to="/dashboard"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Dashboard
            </Link>
            <Link
              to="/documents"
              className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary"
            >
              Documents
            </Link>
            <Link
              to="/chat"
              className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary"
            >
              Chat
            </Link>
            <Link
              to="/search"
              className="text-sm font-medium transition-colors text-muted-foreground hover:text-primary"
            >
              Search
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden md:inline-block">{user.first_name} {user.last_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>Documents</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center cursor-pointer">
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
        </div>
      </div>
    </header>
  );
} 