"use client"

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  CodeToggle,
  CreateLink,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo
} from "@mdxeditor/editor"
import { useEffect, useState } from "react"

import "@mdxeditor/editor/style.css"

// Function to sanitize HTML tags in markdown
const sanitizeMarkdown = (markdown: string): string => {
  // Convert <br> to <br />
  return markdown.replace(/<br>/g, '<br />')
}

interface MDXEditorProps {
  markdown: string
  onChange: (markdown: string) => void
}

export default function MDXEditorComponent({ markdown, onChange }: MDXEditorProps) {
  const [mounted, setMounted] = useState(false)

  // This is needed because the MDXEditor is a client component and we need to make sure
  // it's only rendered on the client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Apply sanitization before passing to editor
  const sanitizedMarkdown = sanitizeMarkdown(markdown)

  const handleChange = (newMarkdown: string) => {
    onChange(newMarkdown)
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="w-8 h-8 border-b-2 rounded-full animate-spin border-primary"></div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <MDXEditor
        markdown={sanitizedMarkdown}
        onChange={handleChange}
        contentEditableClassName="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none h-full p-4 overflow-auto"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          tablePlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
          codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', css: 'CSS', html: 'HTML', python: 'Python' } }),
          imagePlugin(),
          diffSourcePlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <Separator />
                <ListsToggle />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <CreateLink />
                <InsertImage />
                <Separator />
                <InsertTable />
                <InsertThematicBreak />
              </>
            )
          })
        ]}
      />
    </div>
  )
}
