import { SparkleIcon } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Markdown } from "./markdown";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

const cardClassName = "mb-8 border-0 shadow-md";

export const SearchSummary = ({ summary }: { summary: string }) => {
  return (
    <Card
      className={cn(
        cardClassName,
        "transition-all duration-300 hover:shadow-lg"
      )}
    >
      <CardContent className="flex items-start gap-4 pt-6">
        <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 transition-transform duration-300 rounded-full shadow-inner bg-primary/20 hover:scale-105">
          <SparkleIcon className="w-7 h-7 text-primary animate-pulse" />
        </div>
        <div className="flex-1">
          <h2 className="mb-2 text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Summary
          </h2>
          <Markdown
            content={summary}
            className="prose prose-p:mb-2 prose-p:mt-0 prose-p:leading-snug prose-p:text-muted-foreground"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export const SearchSummarySkeleton = () => {
  return (
    <Card className={cardClassName}>
      <CardContent className="flex items-start gap-4 pt-6">
        <div className="flex-shrink-0">
          <Skeleton className="w-12 h-12 rounded-full bg-primary/20" />
        </div>
        <div className="flex-1">
          <Skeleton className="w-32 h-8 mb-4 rounded bg-primary/20" />
          <div className="space-y-3">
            <Skeleton className="w-full h-4 rounded bg-primary/10" />
            <Skeleton className="w-[85%] h-4 rounded bg-primary/10" />
            <Skeleton className="w-[70%] h-4 rounded bg-primary/10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
