import { format } from "date-fns";
import { MessageSquarePlus, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AskBox } from "@/components/dashboard/ask-box";
import { CollectionsCard } from "@/components/dashboard/collections-card";
import { CoverageChart } from "@/components/dashboard/coverage-chart";
import { LibraryStats } from "@/components/dashboard/library-stats";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { RecentChats, RecentDocuments } from "@/components/dashboard/recent-lists";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";
import { useDashboard } from "@/lib/queries";

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useSession();
  const [uploading, setUploading] = useState(false);
  const { data, isLoading } = useDashboard();
  const now = new Date();
  const name = user?.is_guest ? "" : user?.first_name;
  const openUpload = () => setUploading(true);

  return (
    <PageContainer>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(now)}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.is_guest
              ? "You're in the live demo. Ask the library anything, or upload a PDF of your own."
              : "Ask the library anything; every answer cites the page it came from."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openUpload}>
            <Upload />
            Upload
          </Button>
          <Button asChild size="sm">
            <Link to="/chat">
              <MessageSquarePlus />
              New chat
            </Link>
          </Button>
        </div>
      </header>

      <AskBox questions={data?.questions} isLoading={isLoading} />
      <LibraryStats data={data} isLoading={isLoading} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PipelineCard data={data} isLoading={isLoading} />
        </div>
        <CollectionsCard data={data} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentDocuments onUpload={openUpload} />
        </div>
        <RecentChats />
      </div>

      <CoverageChart data={data} isLoading={isLoading} />
      <UploadDialog open={uploading} onOpenChange={setUploading} />
    </PageContainer>
  );
}
