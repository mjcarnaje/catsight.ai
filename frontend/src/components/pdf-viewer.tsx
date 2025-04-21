"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFViewerProps {
  url: string
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  function changePage(offset: number) {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset
      return newPageNumber >= 1 && newPageNumber <= (numPages || 1) ? newPageNumber : prevPageNumber
    })
  }

  function zoomIn() {
    setScale((prevScale) => Math.min(prevScale + 0.2, 2.5))
  }

  function zoomOut() {
    setScale((prevScale) => Math.max(prevScale - 0.2, 0.5))
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <p className="text-muted-foreground">No PDF available</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center flex-1 overflow-auto bg-muted/10">
        <Document
          file={url}

          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-b-2 rounded-full animate-spin border-primary"></div>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-full">
              <p className="text-destructive">Failed to load PDF</p>
            </div>
          }
        >
          <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
        </Document>
      </div>

      <div className="flex items-center justify-between p-2 border-t">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <span className="text-sm">
            Page {pageNumber} of {numPages || "-"}
          </span>

          <Button variant="outline" size="icon" onClick={() => changePage(1)} disabled={pageNumber >= (numPages || 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="w-4 h-4" />
          </Button>

          <span className="w-16 text-sm text-center">{Math.round(scale * 100)}%</span>

          <Button variant="outline" size="icon" onClick={zoomIn} disabled={scale >= 2.5}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
