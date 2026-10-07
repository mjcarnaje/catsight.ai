import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";
import { ProductPreview } from "./product-preview";
import { Reveal } from "./reveal";

export function Hero() {
  const { user } = useSession();

  return (
    <section id="top" className="px-4 pt-28 sm:px-6 sm:pt-40">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h1 className="max-w-3xl text-[2.75rem] font-medium leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            Ask your documents anything.
          </h1>
        </Reveal>

        <Reveal delay={0.08} className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            <span className="text-foreground">CATSight.AI reads the PDFs, scans and memos your campus runs on.</span>{" "}
            Ask in your own words and get an answer with the page it came from.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="lg" className="px-5">
              <Link to={user ? "/dashboard" : "/register"}>{user ? "Open dashboard" : "Get started"}</Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="ghost" className="px-5 text-muted-foreground hover:text-foreground">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.16} className="mx-auto mt-16 max-w-6xl sm:mt-20">
        <div className="mask-fade-bottom">
          <ProductPreview />
        </div>
      </Reveal>
    </section>
  );
}
