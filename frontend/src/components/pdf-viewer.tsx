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

interface PDFViewerProps {
  url: string;
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [pagesRendered, setPagesRendered] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTime = useRef<number>(0);

  // Function to handle page click in preview sidebar
  const handlePageClick = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Scroll the main content to the clicked page
    const pageElement = pageRefs.current[pageNumber - 1];
    if (pageElement) {
      pageElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // Optimized debounced page update function
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

  useEffect(() => {
    if (isDocumentLoaded && thumbnailRefs.current[currentPage - 1]) {
      thumbnailRefs.current[currentPage - 1]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentPage, isDocumentLoaded]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    thumbnailRefs.current = new Array(numPages).fill(null);
    pageRefs.current = new Array(numPages).fill(null);
    setIsDocumentLoaded(true);
  }

  function zoomIn() {
    setScale((prev) => {
      const newScale = Math.min(prev + 0.2, 2.5);
      return Number(newScale.toFixed(1));
    });
  }

  function zoomOut() {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.2, 0.5);
      return Number(newScale.toFixed(1));
    });
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
      {/* Preview Sidebar */}
      <div
        className={cn(
          "border-r bg-white dark:bg-zinc-950 transition-all duration-300 ease-in-out shadow-lg",
          isPreviewOpen ? "w-44" : "w-0"
        )}
      >
        <ScrollArea className="h-full">
          <div className="p-6">
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<LoadingSpinner />}
            >
              <div className="space-y-4">
                {Array.from({ length: numPages }, (_, index) => (
                  <div
                    key={`preview_${index + 1}`}
                    ref={(el) => (thumbnailRefs.current[index] = el)}
                    className={cn(
                      "group cursor-pointer transition-all duration-300",
                      currentPage === index + 1 && "scale-[0.98]"
                    )}
                    onClick={() => handlePageClick(index + 1)}
                  >
                    <div
                      className={cn(
                        "overflow-hidden rounded-lg transition-all w-full aspect-[210/297] duration-300",
                        "border shadow-sm hover:shadow-md",
                        currentPage === index + 1
                          ? "border-primary shadow-primary/20 bg-primary/5"
                          : "border-transparent group-hover:border-primary/30 group-hover:bg-primary/5"
                      )}
                    >
                      <Page
                        pageNumber={index + 1}
                        scale={0.2}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="!w-full !h-full"
                        loading={
                          <div className="flex items-center justify-center w-full h-full bg-muted/10">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          </div>
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Page {index + 1}
                      </p>
                      {currentPage === index + 1 && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Document>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <ScrollArea
          className="flex-1 bg-zinc-100 dark:bg-zinc-900"
          ref={mainContentRef}
        >
          <div className="min-h-full py-8">
            <div
              className="flex flex-col items-center mx-auto"
              style={{
                transform: `scale(${scale})`,
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

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-t bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageClick(currentPage - 1)}
              disabled={currentPage <= 1}
              className="transition-all duration-200 rounded-full hover:shadow-md"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-[100px] text-sm text-center">
              <span className="font-semibold">{currentPage}</span>
              <span className="text-muted-foreground"> / {numPages}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageClick(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="transition-all duration-200 rounded-full hover:shadow-md"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="transition-all duration-200 rounded-full hover:shadow-md"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>

            <span className="w-16 text-sm font-medium text-center">
              {Math.round(scale * 100)}%
            </span>

            <Button
              variant="outline"
              size="icon"
              onClick={zoomIn}
              disabled={scale >= 2.5}
              className="transition-all duration-200 rounded-full hover:shadow-md"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
