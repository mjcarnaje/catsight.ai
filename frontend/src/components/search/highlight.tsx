import { Fragment } from "react";

/** Text with the query's terms wrapped in <mark>. */
export function Highlight({ text, pattern }: { text: string; pattern: RegExp | null }) {
  if (!pattern) return <>{text}</>;
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="-mx-0.5 rounded-sm bg-gold/20 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  );
}
