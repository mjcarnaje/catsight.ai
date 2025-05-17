import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";

export function DocumentCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden border h-full">
      {/* Top Section with Image and Basic Info */}
      <div className="flex">
        {/* Preview Image */}
        <div className="relative w-[100px] h-[120px] sm:w-[120px] sm:h-[140px] flex-shrink-0">
          <Skeleton className="w-full h-full" />
        </div>

        {/* Basic Info */}
        <div className="flex-1 p-3 pl-4 overflow-hidden">
          {/* Status Badge - Top right */}
          <div className="flex justify-end mb-1.5">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>

          {/* Title */}
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-5 w-4/5 mb-2" />

          {/* Creation Date and Uploader */}
          <div className="flex items-center justify-between mt-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pt-2 pb-1 flex-grow">
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Document Metadata */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 mt-2 gap-x-2 gap-y-2">
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-8 rounded-md" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center p-3 mt-auto border-t">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </Card>
  );
} 