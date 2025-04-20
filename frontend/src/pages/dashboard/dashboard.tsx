import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, MessageSquare, Search, User } from "lucide-react"
import { Link } from "react-router-dom"
import { useUser } from "@/lib/auth"

export default function DashboardPage() {
  const { data: user } = useUser();

  // Get recent documents and chats
  const recentDocuments = []
  const recentChats = []

  return (
    <div className="container py-10 mx-auto">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name || 'User'}</h1>
        <p className="text-muted-foreground">Manage your documents and conversations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-10 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentDocuments.length}</div>
            <p className="text-xs text-muted-foreground">Total documents in the system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentChats.length}</div>
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
            {recentDocuments.length > 0 ? (
              <div className="space-y-4">
                {recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
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
                  <Link to="/">Add Document</Link>
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
            {recentChats.length > 0 ? (
              <div className="space-y-4">
                {recentChats.map((chat) => (
                  <div key={chat.id} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{chat.title}</h3>
                      <p className="text-sm text-muted-foreground">{new Date(chat.updatedAt).toLocaleDateString()}</p>
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
