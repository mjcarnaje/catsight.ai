import { useQuery } from "@tanstack/react-query";

import { statisticsApi } from "@/lib/api";

/** Dashboard statistics, shared by every widget through one cached query. */
export function useStatistics() {
  return useQuery({
    queryKey: ["statistics"],
    queryFn: () => statisticsApi.getStatistics(),
    staleTime: 60_000,
  });
}
