import { StatusHistory } from "@/types";
import { formatDistanceToNow, differenceInMilliseconds } from "date-fns";
import { Clock } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Progress } from "./ui/progress";
import { getDocumentStatusDisplay } from "@/lib/document-status-config";

interface StatusHistoryPopoverProps {
  statusHistory: StatusHistory[];
  progress: number;
}

export function StatusHistoryPopover({ statusHistory, progress }: StatusHistoryPopoverProps) {
  // Filter and sort status changes
  const completedStatuses = statusHistory
    .filter(s => s.changed_at !== null)
    .sort((a, b) => {
      return new Date(b.changed_at!).getTime() - new Date(a.changed_at!).getTime();
    });

  // Calculate elapsed time between status changes
  const statusesWithElapsed = completedStatuses.map((status, index) => {
    let elapsedTime = 0;

    // If there is a next status (remember we sorted in reverse chronological order)
    if (index < completedStatuses.length - 1) {
      const currentDate = new Date(status.changed_at!);
      const previousDate = new Date(completedStatuses[index + 1].changed_at!);
      elapsedTime = differenceInMilliseconds(currentDate, previousDate);
    }

    return {
      ...status,
      elapsedTime
    };
  });

  // Calculate total elapsed time
  const totalElapsedTime = statusesWithElapsed.reduce((total, status) => total + status.elapsedTime, 0);

  // Format milliseconds to human-readable format
  const formatElapsedTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

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
            {statusesWithElapsed.map((statusChange) => (
              <div key={statusChange.id} className="flex justify-between text-sm">
                <div>
                  <span>{getDocumentStatusDisplay(statusChange.status).label}</span>
                  {statusChange.elapsedTime > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (took {formatElapsedTime(statusChange.elapsedTime)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {totalElapsedTime > 0 && (
            <div className="pt-1 mt-1 text-xs border-t text-muted-foreground">
              Total processing time: {formatElapsedTime(totalElapsedTime)}
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