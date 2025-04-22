"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"

interface MarkdownPreviewProps {
  content: string
  highlight?: string
}

export default function MarkdownPreview({ content, highlight }: MarkdownPreviewProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // If a highlight term is provided, wrap matches in <mark> tags before markdown parsing
  const getHighlightedContent = () => {
    if (!highlight) return content
    // Escape special regex chars in highlight term
    const escaped = highlight.replace(/[-\\/\\^$*+?.()|[\]{}]/g, "\\$&")
    const regex = new RegExp(`(${escaped})`, "gi")
    // Replace matches with <mark> so rehypeRaw will output real <mark> nodes
    return content.replace(regex, "<mark>$1</mark>")
  }

  const processedContent = getHighlightedContent()

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        // Ensure <mark> tags render correctly
        components={{
          mark: ({ children }) => <mark>{children}</mark>
        }}
        className="prose-sm prose md:prose-base max-w-none"
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
