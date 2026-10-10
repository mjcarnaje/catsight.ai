import { Link } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Privacy", href: "#privacy" },
];

export function SiteFooter() {
  return (
    <footer className="border-t px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <BrandLogo size="sm" />
          <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} · CATSight</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
          <Link to="/terms-and-conditions" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link to="/privacy-policy" className="transition-colors hover:text-foreground">
            Privacy policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
