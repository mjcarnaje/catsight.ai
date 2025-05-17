import { DOCUMENT_STATUS_CONFIG, getDocumentProgress } from "@/lib/document-status-config";
import { StatusHistory } from "@/types";
import { differenceInMilliseconds } from "date-fns";
import {
  Brain,
  CheckCircle2,
  CircleDot,
  Clock,
  FileSearch,
  FileText,
  Network
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Progress } from "./ui/progress";
import { useEffect, useState } from "react";

type StatusHistoryWithElapsedTime = StatusHistory & { elapsedTime: number; isLatestInProgress?: boolean };

interface StatusHistoryPopoverProps {
  statusHistory: StatusHistory[];
}

export function StatusHistoryPopover({ statusHistory }: StatusHistoryPopoverProps) {
  const progress = getDocumentProgress(statusHistory);
  const [statusesWithElapsed, setStatusesWithElapsed] = useState<StatusHistoryWithElapsedTime[]>([]);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);

  // Process status history and calculate elapsed times
  useEffect(() => {
    function getStatusHistoryWithElapsedTime(): StatusHistoryWithElapsedTime[] {
      const sortedStatusHistory: StatusHistoryWithElapsedTime[] = statusHistory
        .filter(s => s.changed_at !== null)
        .sort((a, b) => {
          if (!a.changed_at || !b.changed_at) return 0;
          if (!a.changed_at) return 1;
          if (!b.changed_at) return -1;
          return new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime();
        }).map(s => ({ ...s, elapsedTime: 0 }));

      const result: StatusHistoryWithElapsedTime[] = [];

      // Skip if there are no status updates
      if (sortedStatusHistory.length === 0) return result;

      // Check if the latest status is in progress
      const latestStatus = sortedStatusHistory[0];
      const isLatestInProgress = latestStatus.status !== "completed";

      // Calculate elapsed time between status changes
      for (let i = 0; i < sortedStatusHistory.length - 1; i++) {
        const currentStatus = sortedStatusHistory[i];
        const previousStatus = sortedStatusHistory[i + 1];

        if (currentStatus.changed_at && previousStatus.changed_at) {
          const currentDate = new Date(currentStatus.changed_at);
          const previousDate = new Date(previousStatus.changed_at);
          currentStatus.elapsedTime = differenceInMilliseconds(currentDate, previousDate);
        }

        result.push(currentStatus);
      }

      // Add the last status
      if (sortedStatusHistory.length > 0) {
        result.push(sortedStatusHistory[sortedStatusHistory.length - 1]);
      }

      // Mark the latest status as in progress if it's not completed
      if (isLatestInProgress && result.length > 0) {
        result[0].isLatestInProgress = true;
      }

      return result;
    }

    const processed = getStatusHistoryWithElapsedTime();
    setStatusesWithElapsed(processed);

    // Calculate total elapsed time excluding real-time counter
    const total = processed.reduce((total, status) => total + status.elapsedTime, 0);
    setTotalElapsedTime(total);
  }, [statusHistory]);

  // Set up real-time counter for the latest status if it's in progress
  const [latestElapsedTime, setLatestElapsedTime] = useState(0);

  useEffect(() => {
    if (statusesWithElapsed.length === 0) return;

    const latestStatus = statusesWithElapsed[0];
    if (!latestStatus.isLatestInProgress) return;

    // Calculate initial elapsed time
    const startTime = new Date(latestStatus.changed_at!);
    const initialElapsed = differenceInMilliseconds(new Date(), startTime);
    setLatestElapsedTime(initialElapsed);

    // Update elapsed time every second
    const interval = setInterval(() => {
      const currentElapsed = differenceInMilliseconds(new Date(), startTime);
      setLatestElapsedTime(currentElapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [statusesWithElapsed]);

  const formatElapsedTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "text_extracting":
      case "text_extracted":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "generating_summary":
      case "summary_generated":
        return <Brain className="w-4 h-4 text-blue-500" />;
      case "embedding_text":
      case "embedded_text":
        return <Network className="w-4 h-4 text-blue-500" />;
      case "pending":
        return <CircleDot className="w-4 h-4 text-gray-500" />;
      default:
        return <FileSearch className="w-4 h-4 text-blue-500" />;
    }
  };

  const displayTotalTime = totalElapsedTime + (statusesWithElapsed[0]?.isLatestInProgress ? latestElapsedTime : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="ml-2 h-7 w-7">
          <Clock className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium">Status History</h4>
          <div className="space-y-1">
            {statusesWithElapsed.map((statusChange, index) => (
              <div key={statusChange.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {getStatusIcon(statusChange.status)}
                  <span className={statusChange.status === "completed" ? "font-medium text-green-600" : ""}>
                    {DOCUMENT_STATUS_CONFIG[statusChange.status].label}
                  </span>
                  {index === 0 && statusChange.isLatestInProgress ? (
                    <span className="text-xs text-muted-foreground animate-pulse">
                      (running for {formatElapsedTime(latestElapsedTime)})
                    </span>
                  ) : statusChange.elapsedTime > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (took {formatElapsedTime(statusChange.elapsedTime)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {displayTotalTime > 0 && (
            <div className="pt-1 mt-1 text-xs border-t text-muted-foreground">
              Total processing time: {formatElapsedTime(displayTotalTime)}
            </div>
          )}
          <div className="pt-2 mt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mt-1" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 