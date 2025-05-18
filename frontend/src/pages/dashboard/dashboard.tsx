import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useSession } from "@/contexts/session-context";
import { chatsApi, documentsApi, statisticsApi } from "@/lib/api";
import { DOCUMENT_STATUS_CONFIG, DocumentStatus } from "@/lib/document-status-config";
import { Chat, Document, StatisticsResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Book, FileText, MessageSquare, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from "recharts";

const formatStatusLabel = (status: string) => {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export default function DashboardPage() {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentChats, setRecentChats] = useState<Chat[]>([]);

  const {
    data: statistics = {} as StatisticsResponse,
    isLoading: isStatisticsLoading,
  } = useQuery({
    queryKey: ["statistics"],
    queryFn: () => statisticsApi.getStatistics(),
    staleTime: 60000, // 1 minute
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
        setRecentChats(chatsResponse.data.results);
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
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.first_name || "User"}
        </h1>
        <p className="text-muted-foreground">
          Manage your documents and conversations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 mb-10 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.documents_count}
            </div>
            <p className="text-xs text-muted-foreground">
              Total documents in the system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.chats_count}</div>
            <p className="text-xs text-muted-foreground">
              Active chat sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.users_count}</div>
            <p className="text-xs text-muted-foreground">
              Total registered users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Document Stats</CardTitle>
            <Book className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <div>
                <div className="text-2xl font-bold">{statistics.avg_page_count}</div>
                <p className="text-xs text-muted-foreground">Avg. Pages</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{statistics.avg_chunks}</div>
                <p className="text-xs text-muted-foreground">Avg. Chunks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2">
        <DocumentStatusChart />
        <DocumentTimelineChart />
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <YearDistributionChart />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>
              Recently added or updated documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p>Loading documents...</p>
              </div>
            ) : recentDocuments.length > 0 ? (
              <div className="space-y-4">
                {recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
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
                <p className="mb-4 text-sm text-muted-foreground">
                  You haven't added any documents yet.
                </p>
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
                  <div
                    key={chat.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-medium">{chat.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(chat.updated_at).toLocaleDateString()}
                      </p>
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
                <p className="mb-4 text-sm text-muted-foreground">
                  Start a conversation with your documents.
                </p>
                <Button asChild>
                  <Link to="/chat">Start a Chat</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DocumentStatusChart() {
  const { data: statistics = {} as StatisticsResponse } = useQuery({
    queryKey: ["statistics"],
    queryFn: () => statisticsApi.getStatistics(),
    staleTime: 60000, // 1 minute
  });

  // Format document status data for charts using status config colors
  const chartData = statistics.documents_by_status
    ? Object.entries(statistics.documents_by_status).map(([status, count]) => {
      const config = DOCUMENT_STATUS_CONFIG[status as DocumentStatus];
      if (!config) {
        return null;
      }
      return {
        status: status,
        count,
        fill: config.color,
      };
    })
    : [];

  // Create chart config from document statuses
  const chartConfig = Object.entries(DocumentStatus).reduce((acc, [_, status]) => {
    const config = DOCUMENT_STATUS_CONFIG[status];
    if (!config) {
      return null;
    }
    acc[status] = {
      label: config.label,
      color: config.color,
    };
    return acc;
  }, {} as ChartConfig);

  console.log({ chartConfig, chartData });

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Document Status</CardTitle>
        <CardDescription>Current document processing status</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={chartConfig} className="aspect-square h-[300px] w-full">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent labelKey="count" nameKey="status" />}
            />
            <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={60}
              label={(entry) => `${entry.count}`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function DocumentTimelineChart() {
  const { data: statistics = {} as StatisticsResponse } = useQuery({
    queryKey: ["statistics"],
    queryFn: () => statisticsApi.getStatistics(),
    staleTime: 60000, // 1 minute
  });

  // Use the documents_timeline data from statistics
  const chartData = statistics.documents_timeline || [];

  // Config for timeline chart
  const chartConfig = {
    count: {
      label: "Documents",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Document Growth</CardTitle>
        <CardDescription>Documents created over time</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
          >
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <ChartTooltip content={<ChartTooltipContent labelKey="count" nameKey="month" />} />
            <Area
              type="monotone"
              dataKey="count"
              name="Documents"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              strokeWidth={2}
              fill="url(#colorCount)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function YearDistributionChart() {
  const { data: statistics = {} as StatisticsResponse } = useQuery({
    queryKey: ["statistics"],
    queryFn: () => statisticsApi.getStatistics(),
    staleTime: 60000, // 1 minute
  });

  const chartData = statistics.years_distribution || [];

  // Config for years chart
  const chartConfig = {
    count: {
      label: "Documents",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-2">
        <CardTitle>Documents by Year</CardTitle>
        <CardDescription>Distribution of documents by publication year</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="year"
              angle={-45}
              textAnchor="end"
              height={70}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <ChartTooltip content={<ChartTooltipContent labelKey="count" nameKey="year" />} />
            <Bar
              dataKey="count"
              name="Documents"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
