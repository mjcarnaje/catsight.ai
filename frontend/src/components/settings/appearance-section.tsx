import { SettingsSection } from "@/components/settings/section";
import { THEMES } from "@/components/settings/theme-options";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/** Light, dark, or follow the operating system; saved in this browser. */
export function AppearanceSection() {
  const [theme, setTheme] = useTheme();
  return (
    <SettingsSection id="settings-appearance" label="Appearance" description="Saved in this browser.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 p-5">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              theme === value
                ? "border-foreground/40 bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </SettingsSection>
  );
}
