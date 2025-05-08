import { useEffect, useRef, useState, useCallback } from "react";

interface SSEOptions {
  url: string;
  onMessage: (event: MessageEvent) => void;
  onError?: (err: Event) => void;
  withCredentials?: boolean;
}

export function useEventSource({
  url,
  onMessage,
  onError,
  withCredentials = true,
}: SSEOptions) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(url, { withCredentials });
    esRef.current = es;
    es.onmessage = onMessage; // handle standard `data:` events :contentReference[oaicite:0]{index=0}
    if (onError) es.onerror = onError; // cleanup on error :contentReference[oaicite:1]{index=1}

    return () => {
      es.close(); // close connection on unmount or url change :contentReference[oaicite:2]{index=2}
    };
  }, [url, onMessage, onError, withCredentials]);

  const restart = useCallback(() => {
    esRef.current?.close();
    esRef.current = new EventSource(url, { withCredentials });
    esRef.current.onmessage = onMessage;
    if (onError) esRef.current.onerror = onError;
  }, [url, onMessage, onError, withCredentials]);

  return { restart };
}
