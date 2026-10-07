import { useSyncExternalStore } from "react";

import { setTheme, storedTheme, subscribeTheme, type Theme } from "@/lib/theme";

/** The saved theme choice and a setter; re-renders when it changes in any tab. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribeTheme, storedTheme, () => "dark" as Theme);
  return [theme, setTheme];
}
