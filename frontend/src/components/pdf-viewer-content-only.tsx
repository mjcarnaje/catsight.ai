"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFViewerContentOnlyProps {
  url: string;
}

export default function PDFViewerContentOnly({
  url,
}: PDFViewerContentOnlyProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [pagesRendered, setPagesRendered] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTime = useRef<number>(0);

  const debouncedSetCurrentPage = (pageNumber: number) => {
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime.current;

    // For fast scrolling (less than 50ms between updates), update immediately
    if (timeSinceLastScroll < 50) {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      setCurrentPage(pageNumber);
      lastScrollTime.current = now;
      return;
    }

    // For slower scrolling, use debounce
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      setCurrentPage(pageNumber);
      lastScrollTime.current = Date.now();
    }, 100);
  };

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!isDocumentLoaded || pagesRendered < numPages) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) return;

        const mostVisible = visibleEntries.reduce((prev, current) => {
          return prev.intersectionRatio > current.intersectionRatio
            ? prev
            : current;
        });

        if (mostVisible.target && mostVisible.intersectionRatio > 0.1) {
          const pageNumber = parseInt(
            mostVisible.target.getAttribute("data-page") || "1"
          );
          if (pageNumber !== currentPage) {
            debouncedSetCurrentPage(pageNumber);
          }
        }
      },
      {
        root: null,
        rootMargin: "-20px 0px", // Slightly reduce the margin to improve accuracy
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0], // Reduced number of thresholds for better performance
      }
    );

    pageRefs.current.forEach((ref) => {
      if (ref) {
        observerRef.current?.observe(ref);
      }
    });

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      observerRef.current?.disconnect();
    };
  }, [isDocumentLoaded, pagesRendered, numPages, currentPage]);

  // Handle page render completion
  const onPageRenderSuccess = () => {
    setPagesRendered((prev) => prev + 1);
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    pageRefs.current = new Array(numPages).fill(null);
    setIsDocumentLoaded(true);
  }

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <p className="text-muted-foreground">No PDF available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-100 dark:bg-zinc-900">
      <div className="flex flex-col flex-1 overflow-hidden">
        <ScrollArea
          className="flex-1 bg-zinc-100 dark:bg-zinc-900"
          ref={mainContentRef}
        >
          <div className="min-h-full py-8">
            <div
              className="flex flex-col items-center mx-auto"
              style={{
                transformOrigin: "top center",
                transition: "transform 0.2s ease-out",
                maxWidth: "1000px",
                width: "100%",
              }}
            >
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<LoadingSpinner />}
              >
                {Array.from({ length: numPages }, (_, index) => (
                  <div
                    key={`page_${index + 1}`}
                    className="w-full mb-8 last:mb-0"
                    id={`page-${index + 1}`}
                    ref={(el) => (pageRefs.current[index] = el)}
                    data-page={index + 1}
                  >
                    <div className="flex justify-center">
                      <div className="overflow-hidden bg-white shadow-xl rounded-xl dark:bg-zinc-950 hover:shadow-2xl ring-1 ring-black/5">
                        <Page
                          pageNumber={index + 1}
                          scale={1}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="!m-0"
                          onRenderSuccess={onPageRenderSuccess}
                          loading={
                            <div className="flex items-center justify-center w-full h-full min-h-[600px] bg-muted/10">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </Document>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
