import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface DocumentTableSkeletonProps {
  rows?: number;
}

export function DocumentTableSkeleton({ rows = 5 }: DocumentTableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="w-[50px] font-medium">Preview</TableHead>
          <TableHead className="w-[200px] md:w-[280px] font-medium">Title</TableHead>
          <TableHead className="font-medium hidden sm:table-cell">Status</TableHead>
          <TableHead className="font-medium hidden md:table-cell">Uploader</TableHead>
          <TableHead className="font-medium hidden md:table-cell">Created</TableHead>
          <TableHead className="font-medium hidden sm:table-cell">Chunks</TableHead>
          <TableHead className="font-medium hidden sm:table-cell">Pages</TableHead>
          <TableHead className="text-right font-medium">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array(rows).fill(0).map((_, index) => (
          <TableRow key={index}>
            <TableCell className="w-[50px]">
              <Skeleton className="h-14 w-10 rounded-sm" />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-40" />
                  <div className="sm:hidden mt-1">
                    <Skeleton className="h-5 w-20 rounded-full mt-1" />
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Skeleton className="h-5 w-24 rounded-full" />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Skeleton className="h-6 w-12 rounded-full" />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Skeleton className="h-6 w-12 rounded-full" />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end space-x-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 