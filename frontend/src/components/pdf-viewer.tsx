"use client"

import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut } from "lucide-react"
import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFViewerProps {
  url: string
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState(1)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  function zoomIn() {
    setScale((prev) => Math.min(prev + 0.2, 2.5))
  }

  function zoomOut() {
    setScale((prev) => Math.max(prev - 0.2, 0.5))
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
          {Array.from({ length: numPages }, (_, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          ))}
        </Document>
      </div>

      <div className="flex items-center justify-end p-2 border-t">
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
