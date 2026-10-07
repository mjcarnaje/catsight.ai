import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

interface TypewriterOptions {
  /** Milliseconds between tokens. */
  speed?: number;
  startDelay?: number;
  /** When false the output resets to empty, so callers can restart it. */
  enabled?: boolean;
}

/**
 * Streams `text` word by word, the way CATSight's chat streams model tokens.
 * Users who prefer reduced motion get the full text immediately.
 */
export function useTypewriter(
  text: string,
  { speed = 45, startDelay = 0, enabled = true }: TypewriterOptions = {}
) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const [count, setCount] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    if (reduceMotion) {
      setCount(tokens.length);
      return;
    }

    setCount(0);
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setCount((c) => {
          if (c >= tokens.length) {
            clearInterval(interval);
            return c;
          }
          return c + 2; // a word + the whitespace after it
        });
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [tokens, speed, startDelay, enabled, reduceMotion]);

  return {
    output: tokens.slice(0, count).join(""),
    done: count >= tokens.length,
  };
}
