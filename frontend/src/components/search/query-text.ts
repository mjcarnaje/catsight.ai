/** Pure helpers for showing why a passage matched: term extraction, highlighting and snippets. */

const STOPWORDS = new Set([
  "the", "and", "for", "are", "was", "were", "who", "what", "when", "where", "why", "how", "which",
  "that", "this", "with", "from", "into", "than", "then", "does", "did", "has", "have", "had",
  "can", "could", "should", "would", "about", "there", "their", "they", "will", "been", "being", "not", "any", "all",
  "its", "our", "you", "your", "but", "also", "such", "some", "more", "most", "other", "only", "ano", "sino", "kailan", "saan", "paano", "bakit", "ang", "mga", "sa", "ng",
]);

/** Search words worth highlighting: lowercase, de-duplicated, longest first. */
export function queryTerms(query: string): string[] {
  const terms = new Set<string>();
  for (const raw of query.toLowerCase().split(/[^\p{L}\p{N}-]+/u)) {
    const term = raw.replace(/^-+|-+$/g, "");
    if (!term || STOPWORDS.has(term)) continue;
    if (term.length < 3 && !/\d/.test(term)) continue;
    terms.add(term);
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One case-insensitive pattern for all terms, matching at the start of a word.
 * It has a single capture group so `text.split(pattern)` puts matches at odd indexes.
 */
export function termsPattern(terms: string[]): RegExp | null {
  if (!terms.length) return null;
  const body = terms.map(escapeRegExp).join("|");
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])(${body})`, "giu");
  } catch {
    // Engines without lookbehind support: match anywhere
    return new RegExp(`(${body})`, "gi");
  }
}

/** Collapses the blank-line runs OCR text tends to have. */
export function tidy(text: string) {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface Snippet {
  text: string;
  before: boolean;
  after: boolean;
}

/** A window of about `max` characters around the first match, cut at word boundaries. */
export function snippet(text: string, pattern: RegExp | null, max = 300): Snippet {
  if (text.length <= max) return { text, before: false, after: false };
  const hit = pattern ? text.search(pattern) : -1;
  let start = hit > 80 ? hit - 80 : 0;
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space - start < 24) start = space + 1;
  }
  let end = Math.min(start + max, text.length);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > start + max * 0.7) end = space;
  }
  return { text: text.slice(start, end).trim(), before: start > 0, after: end < text.length };
}
