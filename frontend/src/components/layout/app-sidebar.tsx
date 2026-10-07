import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
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
  DropdownMenuSeparator,
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
import { useSession } from "@/contexts/session-context";
import { chatsApi, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { Chat } from "@/types";

const NAV: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Search", href: "/search", icon: Search },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Tags", href: "/tags", icon: Tag },
];

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

function RecentChats() {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const [renaming, setRenaming] = useState<Chat | null>(null);
  const [deleting, setDeleting] = useState<Chat | null>(null);
  const chats = useInfiniteQuery({
    queryKey: keys.chats(),
    queryFn: ({ pageParam }) => chatsApi.list({ page: pageParam, page_size: CHATS_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
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
