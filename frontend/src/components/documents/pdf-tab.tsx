import { FileX, ExternalLink } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// react-pdf is heavy; only load it when this tab is opened
const PDFViewer = lazy(() => import("@/components/pdf-viewer"));

const NARROW = "(max-width: 767px)";

/** Read synchronously so phones never start downloading the viewer. */
function useIsNarrow() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(NARROW).matches,
    () => false
  );
}

/**
 * The viewer has no "start at page" prop, so scroll its page list ourselves: wait for the page
 * to exist, keep it aligned while the pages above it finish rendering, and stop as soon as
 * the reader scrolls, taps or presses a key.
 */
function useScrollToPage(container: RefObject<HTMLElement>, page: number | undefined, enabled: boolean) {
  useEffect(() => {
    const root = container.current;
    if (!root || !page || !enabled) return;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((name) => root.addEventListener(name, cancel, { passive: true }));

    const align = () => {
      const target = root.querySelector<HTMLElement>(`[data-page="${page}"]`);
      const viewport = target?.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
      if (!target || !viewport) return;
      const offset = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
      if (Math.abs(offset) > 2) viewport.scrollTop += offset;
    };

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (cancelled || Date.now() - startedAt > 8000) window.clearInterval(timer);
      else align();
    }, 250);

    return () => {
      window.clearInterval(timer);
      events.forEach((name) => root.removeEventListener(name, cancel));
    };
  }, [container, page, enabled]);
}

/**
 * The document's PDF in the shared viewer. `page` (from `?page=N`) opens it at that page.
 *
 * @example
 * <PdfTab url={doc.file_url} page={3} />
 */
export function PdfTab({ url, page }: { url: string; page?: number }) {
  const narrow = useIsNarrow();
  const container = useRef<HTMLDivElement>(null);
  useScrollToPage(container, page, Boolean(url) && !narrow);

  if (!url) {
    return <EmptyState icon={FileX} title="The PDF isn't available" description="The original file could not be found for this document." />;
  }

  if (narrow) {
    return (
      <EmptyState
        icon={ExternalLink}
        title="Open the PDF in your browser"
        description="The page viewer needs a wider screen. Your browser's own viewer works better on phones."
        action={
          <Button asChild size="sm">
            <a href={page ? `${url}#page=${page}` : url} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open PDF
            </a>
          </Button>
        }
      />
    );
  }

  return (
    <div ref={container} className="h-[calc(100dvh-16rem)] min-h-[480px] overflow-hidden rounded-lg border">
      <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
        <PDFViewer url={url} />
      </Suspense>
    </div>
  );
}
