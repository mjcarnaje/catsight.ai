"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownPreviewProps {
  content: string
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose-sm prose md:prose-base max-w-none"
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
