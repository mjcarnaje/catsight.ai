import { format } from "date-fns";
import { MessageSquarePlus, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { AskBar } from "@/components/dashboard/ask-bar";
import { GrowthChart, YearsChart } from "@/components/dashboard/charts";
import { ProcessingCard } from "@/components/dashboard/processing-card";
import { RecentChats, RecentDocuments } from "@/components/dashboard/recent-lists";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";
import { useStatistics } from "@/hooks/use-statistics";

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useSession();
  const { data: statistics, isLoading } = useStatistics();
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(now)}, {user?.first_name || "there"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/documents">
              <Upload />
              Upload
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/chat">
              <MessageSquarePlus />
              New chat
            </Link>
          </Button>
        </div>
      </header>

      <AskBar />

      <StatStrip statistics={statistics} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GrowthChart statistics={statistics} isLoading={isLoading} />
        </div>
        <ProcessingCard statistics={statistics} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentDocuments />
        </div>
        <RecentChats />
      </div>

      <YearsChart statistics={statistics} isLoading={isLoading} />
    </div>
  );
}
