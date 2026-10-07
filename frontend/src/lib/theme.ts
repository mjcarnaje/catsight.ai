/**
 * Light / dark / system theme. Dark is the default; the choice is kept per browser.
 *
 * index.html applies the saved theme before the first paint (no flash of the wrong
 * theme); this module owns it after that.
 */
export type Theme = "light" | "dark" | "system";

const KEY = "catsight:theme";
const CHANGE = "catsight:theme-change";
const prefersLight = () => window.matchMedia("(prefers-color-scheme: light)");

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && !prefersLight().matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0c0b0a" : "#ffffff");
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice lasts until the page reloads
  }
  apply(theme);
  window.dispatchEvent(new Event(CHANGE));
}

/** Notifies on changes from this tab, other tabs, and (for "system") the OS setting. */
export function subscribeTheme(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Keeps the page in sync with other tabs and with the OS when the theme is "system". */
export function initTheme() {
  apply(storedTheme());
  window.addEventListener("storage", (e) => e.key === KEY && apply(storedTheme()));
  prefersLight().addEventListener("change", () => storedTheme() === "system" && apply("system"));
}
