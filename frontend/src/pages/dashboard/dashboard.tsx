import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, MessageSquare, User } from "lucide-react"
import { Link } from "react-router-dom"
import { useUser } from "@/lib/auth"
import { useEffect, useState } from "react"
import { documentsApi, chatsApi } from "@/lib/api"
import { Document, Chat } from "@/types"
import { useQuery } from "@tanstack/react-query"

export default function DashboardPage() {
  const { data: user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentChats, setRecentChats] = useState<Chat[]>([]);

  const { data: documentsCount = 0, isLoading: isDocumentsCountLoading } = useQuery({
    queryKey: ['documentsCount'],
    queryFn: () => documentsApi.getCount(),
    staleTime: 60000 // 1 minute
  });

  const { data: chatsCount = 0, isLoading: isChatsCountLoading } = useQuery({
    queryKey: ['chatsCount'],
    queryFn: () => chatsApi.getCount(),
    staleTime: 60000 // 1 minute
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch recent documents
        const docsResponse = await documentsApi.getAll(1, 5);
        setRecentDocuments(docsResponse.data.results);

        // Fetch recent chats
        const chatsResponse = await chatsApi.getRecent();
        setRecentChats(chatsResponse.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="container py-10 mx-auto">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.first_name || 'User'}</h1>
        <p className="text-muted-foreground">Manage your documents and conversations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-10 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isDocumentsCountLoading ? "..." : String(documentsCount)}</div>
            <p className="text-xs text-muted-foreground">Total documents in the system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isChatsCountLoading ? "..." : String(chatsCount)}</div>
            <p className="text-xs text-muted-foreground">Active chat sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Profile</CardTitle>
            <User className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{user?.email}</div>
            <p className="text-xs text-muted-foreground">Role: {user?.role || 'User'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Recently added or updated documents</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p>Loading documents...</p>
              </div>
            ) : recentDocuments.length > 0 ? (
              <div className="space-y-4">
                {recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/documents/${doc.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="w-12 h-12 mb-4 text-muted-foreground opacity-20" />
                <h3 className="mb-1 text-lg font-medium">No documents yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">You haven't added any documents yet.</p>
                <Button asChild>
                  <Link to="/documents">Add Document</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Chats</CardTitle>
            <CardDescription>Your recent conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p>Loading chats...</p>
              </div>
            ) : recentChats.length > 0 ? (
              <div className="space-y-4">
                {recentChats.map((chat) => (
                  <div key={chat.id} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{chat.title}</h3>
                      <p className="text-sm text-muted-foreground">{new Date(chat.updated_at).toLocaleDateString()}</p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/chat/${chat.id}`}>Continue</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="w-12 h-12 mb-4 text-muted-foreground opacity-20" />
                <h3 className="mb-1 text-lg font-medium">No chat sessions</h3>
                <p className="mb-4 text-sm text-muted-foreground">Start a conversation with your documents.</p>
                <Button asChild>
                  <Link to="/chat">Start a Chat</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
