import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { CatMark } from "@/components/brand/cat-mark";
import { UsageMeter } from "@/components/layout/usage-meter";
import { THEMES } from "@/components/settings/theme-options";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useToast } from "@/components/ui/use-toast";
import { useOrganization } from "@/contexts/organization-context";
import { useSession } from "@/contexts/session-context";
import { useTheme } from "@/hooks/use-theme";
import { chatsApi, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { Theme } from "@/lib/theme";
import type { Chat, OrgRole } from "@/types";

const NAV: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Search", href: "/search", icon: Search },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Tags", href: "/tags", icon: Tag },
];

const ROLE_LABELS: Record<OrgRole, string> = { admin: "Admin", member: "Member", guest: "Guest" };

const CHATS_PAGE = 20;

export function AppSidebar() {
  const { pathname } = useLocation();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="CATSight.AI">
              <Link to="/dashboard">
                <CatMark className="!size-7" sparkle={false} />
                <span className="text-[15px] font-semibold tracking-tight">
                  CATSight<span className="text-muted-foreground">.AI</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <OrganizationSwitcher />
          <SidebarMenuItem>
            <SidebarMenuButton asChild variant="outline" tooltip="New chat" className="mt-1">
              <Link to="/chat">
                <Plus />
                <span>New chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.title}>
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <AdminGroup />
        <RecentChats />
      </SidebarContent>

      <SidebarFooter>
        <UsageMeter />
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** The organization the app acts in. Several memberships open a menu to switch between them. */
function OrganizationSwitcher() {
  const { current, memberships, switchTo } = useOrganization();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  if (!current) return null;

  const { name } = current.organization;
  const summary = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-xs font-medium">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{ROLE_LABELS[current.role]}</span>
      </span>
    </>
  );

  // Nothing to switch to: show the organization without a menu
  if (memberships.length < 2) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip={name} className="cursor-default hover:bg-transparent">
          <div>{summary}</div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg" tooltip={name} className="data-[state=open]:bg-sidebar-accent">
            {summary}
            <ChevronsUpDown className="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
          side={isMobile ? "bottom" : "right"}
          align="start"
          sideOffset={4}
        >
          <DropdownMenuLabel className="font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
            Organizations
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current.organization.slug}
            onValueChange={(slug) => {
              switchTo(slug);
              navigate("/dashboard");
            }}
          >
            {memberships.map(({ organization, role }) => (
              <DropdownMenuRadioItem key={organization.slug} value={organization.slug} className="gap-2">
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate">{organization.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{ROLE_LABELS[role]}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/** Platform administration: only for super admins. */
function AdminGroup() {
  const { user } = useSession();
  const { pathname } = useLocation();
  if (!user?.is_super_admin) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/admin/organizations")} tooltip="Organizations">
              <Link to="/admin/organizations">
                <Building2 />
                <span>Organizations</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function RecentChats() {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const [renaming, setRenaming] = useState<Chat | null>(null);
  const [deleting, setDeleting] = useState<Chat | null>(null);
  const { current } = useOrganization();
  const chats = useInfiniteQuery({
    queryKey: keys.chats(),
    queryFn: ({ pageParam }) => chatsApi.list({ page: pageParam, page_size: CHATS_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    enabled: current !== null, // chats belong to an organization
  });
  const items = chats.data?.pages.flatMap((page) => page.results) ?? [];

  if (state === "collapsed" || items.length === 0) return null;

  return (
    <SidebarGroup className="min-h-0">
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((chat) => (
            <SidebarMenuItem key={chat.id}>
              <SidebarMenuButton asChild isActive={pathname === `/chat/${chat.id}`} className="text-[13px]">
                <Link to={`/chat/${chat.id}`} title={chat.title || "New chat"}>
                  <span className="truncate">{chat.title || "New chat"}</span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover aria-label="Chat options">
                    <MoreHorizontal />
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuItem onSelect={() => setRenaming(chat)}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDeleting(chat)} className="text-destructive focus:text-destructive">
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))}
          {chats.hasNextPage && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-xs text-muted-foreground"
                onClick={() => chats.fetchNextPage()}
                disabled={chats.isFetchingNextPage}
              >
                <MessageSquare />
                <span>{chats.isFetchingNextPage ? "Loading…" : "Show more"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
      <RenameChatDialog chat={renaming} onClose={() => setRenaming(null)} />
      <DeleteChatDialog chat={deleting} onClose={() => setDeleting(null)} />
    </SidebarGroup>
  );
}

function RenameChatDialog({ chat, onClose }: { chat: Chat | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const rename = useMutation({
    mutationFn: () => chatsApi.rename(chat!.id, title.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      onClose();
    },
    onError: (error) => toast({ title: "Couldn't rename the chat", description: errorMessage(error), variant: "destructive" }),
  });

  return (
    <Dialog open={Boolean(chat)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={() => setTitle(chat?.title ?? "")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) rename.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} autoFocus aria-label="Chat title" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || rename.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteChatDialog({ chat, onClose }: { chat: Chat | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const remove = useMutation({
    mutationFn: () => chatsApi.remove(chat!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      if (pathname === `/chat/${chat!.id}`) navigate("/chat");
      onClose();
    },
    onError: (error) => toast({ title: "Couldn't delete the chat", description: errorMessage(error), variant: "destructive" }),
  });

  return (
    <Dialog open={Boolean(chat)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this chat?</DialogTitle>
          <DialogDescription>“{chat?.title || "New chat"}” and its messages will be removed for good.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserMenu() {
  const { user, signOut } = useSession();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  if (!user) return null;

  const name = user.is_guest ? "Guest" : `${user.first_name} ${user.last_name}`.trim() || user.email;
  const initials = user.is_guest ? "G" : `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase() || "?";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={user.avatar || undefined} alt="" />
                <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.is_guest ? "Demo session" : user.email}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.is_guest ? "Guest account" : user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette /> Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
                  {THEMES.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuRadioItem key={value} value={value} className="gap-2">
                      <Icon className="size-4" />
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut /> {user.is_guest ? "End demo session" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
