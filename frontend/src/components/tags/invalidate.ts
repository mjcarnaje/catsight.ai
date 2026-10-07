import type { QueryClient } from "@tanstack/react-query";

import { keys } from "@/lib/queries";

/** Everything that shows tag names or counts: the tag list, the dashboard, and documents. */
export function invalidateTagViews(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.tags }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard }),
    queryClient.invalidateQueries({ queryKey: ["documents"] }),
    queryClient.invalidateQueries({ queryKey: ["document"] }),
  ]);
}
