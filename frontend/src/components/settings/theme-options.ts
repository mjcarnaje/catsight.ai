import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import type { Theme } from "@/lib/theme";

/** The theme choices, in the order the settings page and account menu show them. */
export const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];
