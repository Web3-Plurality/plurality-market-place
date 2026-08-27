import { useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../utils/env';

export interface SSEContextUpdate {
  contextId: string;
  status: 'completed' | 'inprogress' | 'error';
  errorMessage?: string;
  vectorIds?: string[];
  processingProgress?: number;
  title?: string;
  description?: string;
}

interface UseSSEOptions {
  onContextUpdate?: (data: SSEContextUpdate) => void;
  enabled?: boolean;
}

/**
 * Subscribes to GET /ai/context/events for live context-processing progress.
 *
 * EventSource sends the HttpOnly auth cookie automatically when
 * withCredentials is true; CORS on the backend already allows this. The
 * BucketDetailDialog uses the resulting events to flip a row from
 * "indexing…" to "ready" without polling. Falls back gracefully to silent
 * disconnect after MAX_RECONNECT_ATTEMPTS — callers can poll if they need a
 * stronger guarantee.
 */
export const useSSE = ({ onContextUpdate, enabled = true }: UseSSEOptions) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const connect = useCallback(() => {
    if (!enabled) return;
    if (eventSourceRef.current) eventSourceRef.current.close();

    try {
      const url = `${API_BASE_URL}/ai/context/events`;
      const eventSource = new EventSource(url, { withCredentials: true });

      eventSource.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      eventSource.addEventListener('connected', () => {});
      eventSource.addEventListener('heartbeat', () => {});

      eventSource.addEventListener('context-update', (event) => {
        try {
          const data: SSEContextUpdate = JSON.parse(event.data);
          onContextUpdate?.(data);
        } catch (error) {
          console.error('[SSE] Failed to parse context update:', error);
        }
      });

      eventSource.onerror = (error) => {
        console.warn('[SSE] Connection error:', error);
        eventSource.close();
        eventSourceRef.current = null;

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, delay);
        } else {
          console.warn('[SSE] Max reconnect attempts reached');
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
    }
  }, [enabled, onContextUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    if (enabled) connect();
    else disconnect();
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return {
    isConnected: !!eventSourceRef.current,
    connect,
    disconnect,
  };
};
