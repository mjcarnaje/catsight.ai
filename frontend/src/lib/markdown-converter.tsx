import { ListIcon, ListTree, ZapIcon } from "lucide-react";
import React from "react";

export const MARKDOWN_CONVERTERS = {
  marker: {
    value: "marker",
    label: "Marker",
    description:
      "Delivers high-fidelity Markdown output with strong formatting accuracy, best for complex documents.",
    tags: ["accurate", "detailed", "slower"],
    icon: (props: React.ComponentProps<typeof ListIcon>) => <ListIcon {...props} />,
  },
  markitdown: {
    value: "markitdown",
    label: "Markitdown",
    description:
      "Optimized for speed and simplicity, perfect for quick conversions of straightforward content.",
    tags: ["fast", "lightweight", "reliable"],
    icon: (props: React.ComponentProps<typeof ZapIcon>) => <ZapIcon {...props} />,
  },
  docling: {
    value: "docling",
    label: "Docling",
    description:
      "Preserves document semantics and structure meticulously, ideal for structured documents and research.",
    tags: ["accurate", "semantic", "slow"],
    icon: (props: React.ComponentProps<typeof ListTree>) => <ListTree {...props} />,
  },
};
