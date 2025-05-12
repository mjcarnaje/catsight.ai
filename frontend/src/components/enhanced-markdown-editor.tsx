import React, { useEffect, useState } from "react";
import MDEditor from "@uiw/react-md-editor";

// Import required CSS
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

interface EnhancedMarkdownEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  height?: number;
}

export default function EnhancedMarkdownEditor({
  markdown,
  onChange,
  height = 500,
}: EnhancedMarkdownEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState(markdown);

  // Handle client-side only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update local state when prop changes
  useEffect(() => {
    setValue(markdown);
  }, [markdown]);

  const handleChange = (newValue?: string) => {
    const validValue = newValue || "";
    setValue(validValue);
    onChange(validValue);
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="w-8 h-8 border-b-2 rounded-full animate-spin border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full markdown-editor-container" data-color-mode="light">
      <MDEditor
        value={value}
        onChange={handleChange}
        height={height}
        preview="edit"
        className="w-full"
      />
    </div>
  );
} 