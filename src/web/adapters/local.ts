import type { ResumeV1 } from '../../core/generated/resume.js';

export class LocalBridgeError extends Error {
  public readonly status?: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'LocalBridgeError';
  }
}

export class LocalConflictError extends LocalBridgeError {
  constructor(message: string = 'Conflict: file revision mismatch on local disk.') {
    super(message, 409);
    this.name = 'LocalConflictError';
  }
}

export class LocalUnauthorizedError extends LocalBridgeError {
  constructor(message: string = 'Unauthorized: invalid session capability token.') {
    super(message, 401);
    this.name = 'LocalUnauthorizedError';
  }
}

/**
 * Extracts and immediately removes the session capability from window.location.hash.
 * Replaces browser history state so the token never leaks into navigation, storage, or logs.
 */
export function extractSessionCapability(): string | null {
  if (typeof window === 'undefined' || !window.location.hash) {
    return null;
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  const match = /(?:^|&)local=([0-9a-fA-F]{64})(?:&|$)/.exec(hash);
  if (!match || !match[1]) {
    return null;
  }

  const token = match[1];

  // Immediately strip capability fragment from browser URL via history replacement
  try {
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);
  } catch {
    // Non-fatal if history replacement fails
  }

  return token;
}

export interface DocumentResponse {
  revision: string;
  document: ResumeV1;
}

export interface SaveResponse {
  ok: true;
  revision: string;
}

export interface LocalEventChange {
  revision: string;
  valid: boolean;
}

export interface EventSubscriptionCallbacks {
  onChange: (event: LocalEventChange) => void;
  onDeleted?: () => void;
  onError?: (err: Error) => void;
}

export class LocalBridgeClient {
  private readonly capability: string;
  private readonly baseUrl: string;

  constructor(capability: string, baseUrl: string = '') {
    this.capability = capability;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  get token(): string {
    return this.capability;
  }

  /**
   * Fetches the active document and revision from the loopback server.
   */
  async fetchDocument(): Promise<DocumentResponse> {
    const res = await fetch(`${this.baseUrl}/local/document`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.capability}`,
      },
    });

    if (res.status === 401) {
      throw new LocalUnauthorizedError();
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new LocalBridgeError(`Failed to fetch document: ${res.status} ${errorText}`, res.status);
    }

    return (await res.json()) as DocumentResponse;
  }

  /**
   * Saves document updates to the loopback server under cooperative transaction.
   */
  async saveDocument(expectedRevision: string, document: ResumeV1): Promise<SaveResponse> {
    const res = await fetch(`${this.baseUrl}/local/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.capability}`,
      },
      body: JSON.stringify({ expectedRevision, document }),
    });

    if (res.status === 401) {
      throw new LocalUnauthorizedError();
    }

    if (res.status === 409) {
      throw new LocalConflictError();
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new LocalBridgeError(`Save failed: ${res.status} ${errorText}`, res.status);
    }

    return (await res.json()) as SaveResponse;
  }

  /**
   * Subscribes to Server-Sent Events for external disk change notifications.
   * Uses fetch streaming with Authorization header instead of query token.
   */
  subscribeEvents(callbacks: EventSubscriptionCallbacks): () => void {
    let active = true;
    let abortController = new AbortController();

    const connect = async () => {
      let backoffMs = 500;

      while (active) {
        try {
          abortController = new AbortController();
          const response = await fetch(`${this.baseUrl}/local/events`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.capability}`,
            },
            signal: abortController.signal,
          });

          if (response.status === 401) {
            callbacks.onError?.(new LocalUnauthorizedError());
            return;
          }

          if (!response.ok || !response.body) {
            throw new LocalBridgeError(`SSE connection error: ${response.status}`, response.status);
          }

          backoffMs = 500; // Reset backoff on successful connect
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (active) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = 'message';
            let currentData = '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed === '') {
                // Dispatch event block
                if (currentData) {
                  try {
                    const parsed = JSON.parse(currentData);
                    if (currentEvent === 'change') {
                      callbacks.onChange(parsed);
                    } else if (currentEvent === 'deleted') {
                      callbacks.onDeleted?.();
                    }
                  } catch {
                    // Ignore malformed event payload
                  }
                }
                currentEvent = 'message';
                currentData = '';
              } else if (trimmed.startsWith('event:')) {
                currentEvent = trimmed.slice(6).trim();
              } else if (trimmed.startsWith('data:')) {
                currentData = trimmed.slice(5).trim();
              }
            }
          }
        } catch (err) {
          if (!active || (err instanceof DOMException && err.name === 'AbortError')) {
            return;
          }
          callbacks.onError?.(err as Error);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 5000);
        }
      }
    };

    connect();

    return () => {
      active = false;
      abortController.abort();
    };
  }
}
