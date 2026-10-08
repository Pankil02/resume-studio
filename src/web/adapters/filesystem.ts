/**
 * Client-Side File System Access API Adapter for Resume Studio.
 * Enables live bidirectional synchronization between local JSON on disk
 * and the static browser application via native Chromium File System Access API.
 * Uses Origin IndexedDB to persist the file handle across reloads.
 */

export interface FileSyncState {
  connected: boolean;
  fileName: string | null;
  lastModified: number;
  writable: boolean;
}

export type FileSyncListener = (content: string, revision: string) => void;

export interface FileSyncAdapter {
  isSupported(): boolean;
  linkFile(): Promise<{ name: string; content: string; revision: string }>;
  restoreHandle(): Promise<{ name: string; content: string; revision: string } | null>;
  startWatching(listener: FileSyncListener, intervalMs?: number): void;
  stopWatching(): void;
  writeFile(content: string): Promise<string>;
  disconnect(): Promise<void>;
  getState(): Readonly<FileSyncState>;
}

export interface FileSystemStorageProvider {
  getHandle(): Promise<FileSystemFileHandle | null>;
  setHandle(handle: FileSystemFileHandle): Promise<void>;
  clearHandle(): Promise<void>;
}

export interface FileSystemSyncAdapterOptions {
  storage?: FileSystemStorageProvider;
  filePicker?: () => Promise<FileSystemFileHandle[]>;
}

declare global {
  interface Window {
    showOpenFilePicker?(options?: {
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
      excludeAcceptAllOption?: boolean;
      multiple?: boolean;
    }): Promise<FileSystemFileHandle[]>;
  }
}

const DB_NAME = 'resume-studio-fs';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'active_resume_file';

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export const defaultStorageProvider: FileSystemStorageProvider = {
  async getHandle(): Promise<FileSystemFileHandle | null> {
    try {
      const db = await openIndexedDb();
      return await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(HANDLE_KEY);
        req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  async setHandle(handle: FileSystemFileHandle): Promise<void> {
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Failed to persist FileSystemFileHandle to IndexedDB:', err);
    }
  },

  async clearHandle(): Promise<void> {
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  },
};

/**
 * Computes deterministic SHA-256 hex digest of string content.
 */
export async function computeSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class FileSystemSyncAdapter implements FileSyncAdapter {
  private handle: FileSystemFileHandle | null = null;
  private storage: FileSystemStorageProvider;
  private customFilePicker?: (() => Promise<FileSystemFileHandle[]>) | undefined;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private focusListener: (() => void) | null = null;
  private listener: FileSyncListener | null = null;
  private isWriting = false;

  private state: FileSyncState = {
    connected: false,
    fileName: null,
    lastModified: 0,
    writable: false,
  };

  constructor(options?: FileSystemSyncAdapterOptions) {
    this.storage = options?.storage ?? defaultStorageProvider;
    this.customFilePicker = options?.filePicker;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
  }

  async linkFile(): Promise<{ name: string; content: string; revision: string }> {
    let handles: FileSystemFileHandle[];

    if (this.customFilePicker) {
      handles = await this.customFilePicker();
    } else {
      if (!this.isSupported() || !window.showOpenFilePicker) {
        throw new Error('File System Access API is not supported in this browser.');
      }
      handles = await window.showOpenFilePicker({
        types: [
          {
            description: 'JSON Files',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
        excludeAcceptAllOption: false,
        multiple: false,
      });
    }

    const handle = handles?.[0];
    if (!handle) {
      throw new Error('No file selected');
    }
    if (handle.kind !== 'file') {
      throw new Error('Selected item is not a file');
    }

    const file = await handle.getFile();
    const content = await file.text();
    const revision = await computeSha256(content);

    this.handle = handle;
    this.state = {
      connected: true,
      fileName: handle.name,
      lastModified: file.lastModified,
      writable: true,
    };

    await this.storage.setHandle(handle);

    return {
      name: handle.name,
      content,
      revision,
    };
  }

  async restoreHandle(): Promise<{ name: string; content: string; revision: string } | null> {
    const handle = await this.storage.getHandle();
    if (!handle) {
      return null;
    }

    try {
      // Check query permission if available
      const handleWithPerm = handle as unknown as {
        queryPermission?(desc?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
        requestPermission?(desc?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
      };

      if (typeof handleWithPerm.queryPermission === 'function') {
        const queryResult = await handleWithPerm.queryPermission({ mode: 'readwrite' });
        if (queryResult !== 'granted') {
          // If query is prompt or denied, attempt request or return null if user gesture missing
          if (typeof handleWithPerm.requestPermission === 'function') {
            try {
              const reqResult = await handleWithPerm.requestPermission({ mode: 'readwrite' });
              if (reqResult !== 'granted') {
                return null;
              }
            } catch {
              return null;
            }
          } else {
            return null;
          }
        }
      }

      const file = await handle.getFile();
      const content = await file.text();
      const revision = await computeSha256(content);

      this.handle = handle;
      this.state = {
        connected: true,
        fileName: handle.name,
        lastModified: file.lastModified,
        writable: true,
      };

      return {
        name: handle.name,
        content,
        revision,
      };
    } catch {
      // Handle may have become invalid or permission denied
      return null;
    }
  }

  startWatching(listener: FileSyncListener, intervalMs = 1000): void {
    this.stopWatching();
    this.listener = listener;

    const poll = async () => {
      if (!this.handle || !this.listener || this.isWriting) {
        return;
      }

      try {
        const file = await this.handle.getFile();
        if (file.lastModified > this.state.lastModified) {
          this.state.lastModified = file.lastModified;
          const content = await file.text();
          const revision = await computeSha256(content);
          this.listener(content, revision);
        }
      } catch {
        // File may be locked mid-write by another process; retry on next poll
      }
    };

    this.watchTimer = setInterval(poll, intervalMs);

    if (typeof window !== 'undefined') {
      this.focusListener = () => {
        void poll();
      };
      window.addEventListener('focus', this.focusListener);
    }
  }

  stopWatching(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    if (this.focusListener && typeof window !== 'undefined') {
      window.removeEventListener('focus', this.focusListener);
      this.focusListener = null;
    }
    this.listener = null;
  }

  async writeFile(content: string): Promise<string> {
    if (!this.handle) {
      throw new Error('No file is currently linked for writing');
    }

    this.isWriting = true;
    try {
      const writable = await this.handle.createWritable();
      await writable.write(content);
      await writable.close();

      // Read back lastModified to update internal state and avoid self-triggering
      const file = await this.handle.getFile();
      this.state.lastModified = file.lastModified;

      const revision = await computeSha256(content);
      return revision;
    } finally {
      this.isWriting = false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopWatching();
    await this.storage.clearHandle();
    this.handle = null;
    this.state = {
      connected: false,
      fileName: null,
      lastModified: 0,
      writable: false,
    };
  }

  getState(): Readonly<FileSyncState> {
    return { ...this.state };
  }
}
