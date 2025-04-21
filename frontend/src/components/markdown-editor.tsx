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

  if (!mounted) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="w-8 h-8 border-b-2 rounded-full animate-spin border-primary"></div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <MDXEditor
        markdown={markdown}
        onChange={onChange}
        contentEditableClassName="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none min-h-[calc(100vh-12rem)] p-4"
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
