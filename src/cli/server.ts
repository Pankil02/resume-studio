import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from 'node:http';
import {
  existsSync,
  lstatSync,
  realpathSync,
  readFileSync,
  watch,
  type FSWatcher,
} from 'node:fs';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  assertSafeDocumentPath,
  readDocument,
  computeRevision,
  DocumentConflictError,
  DocumentIoError,
} from './documents.js';
import { applyDocumentTransaction, LockTimeoutError } from './locks.js';
import { validateResume } from '../core/validation.js';
import { openBrowser } from './open-browser.js';

export const MAX_SAVE_BODY_BYTES = 160 * 1024; // 160 KiB
const RECONCILIATION_INTERVAL_MS = 3000;
const WATCH_DEBOUNCE_MS = 100;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export interface PreviewServerOptions {
  file: string;
  port?: number;
  open?: boolean;
}

export interface PreviewServerHandle {
  server: Server;
  port: number;
  capability: string;
  url: string;
  close: () => Promise<void>;
}

export function createPreviewServer(options: PreviewServerOptions): Promise<PreviewServerHandle> {
  const targetFile = assertSafeDocumentPath(options.file);
  if (!existsSync(targetFile)) {
    throw new DocumentIoError(`Document file not found: '${targetFile}'`, 'FILE_NOT_FOUND');
  }

  // Ensure built assets exist in dist/web
  const distWebDir = resolve('dist/web');
  if (!existsSync(distWebDir)) {
    throw new DocumentIoError(
      `Built assets not found in '${distWebDir}'. Please run 'bun run build' or 'npm run build' first.`,
      'MISSING_BUILD'
    );
  }
  const realDistWeb = realpathSync(distWebDir);

  // Generate cryptographic 256-bit session capability
  const capability = randomBytes(32).toString('hex');

  // Track SSE connections
  const sseClients = new Set<ServerResponse>();
  let lastKnownRevision = '';
  try {
    const initialDoc = readDocument(targetFile);
    lastKnownRevision = initialDoc.revision;
  } catch {
    // Handled on subsequent reads
  }

  // Set up watcher on parent directory
  const parentDir = dirname(targetFile);
  const targetFilename = basename(targetFile);
  let watcher: FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  let reconciliationTimer: NodeJS.Timeout | null = null;

  function broadcastEvent(eventName: string, data: Record<string, unknown>): void {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function checkRevisionAndNotify(): void {
    if (!existsSync(targetFile)) {
      if (lastKnownRevision !== '__DELETED__') {
        lastKnownRevision = '__DELETED__';
        broadcastEvent('deleted', {});
      }
      return;
    }

    try {
      const doc = readDocument(targetFile);
      if (doc.revision !== lastKnownRevision) {
        lastKnownRevision = doc.revision;
        broadcastEvent('change', {
          revision: doc.revision,
          valid: doc.validation.ok,
        });
      }
    } catch {
      // Malformed or locked external edit
    }
  }

  function onFsChange(filename: string | null): void {
    if (!filename || filename === targetFilename) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkRevisionAndNotify();
      }, WATCH_DEBOUNCE_MS);
    }
  }

  try {
    watcher = watch(parentDir, (_eventType, filename) => {
      onFsChange(filename);
    });
  } catch {
    // Fall back to periodic reconciliation timer if directory watch is unavailable
  }

  reconciliationTimer = setInterval(() => {
    checkRevisionAndNotify();
  }, RECONCILIATION_INTERVAL_MS);

  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const actualPort = (server.address() as { port: number }).port;
      const expectedHost = `127.0.0.1:${actualPort}`;
      const expectedOrigin = `http://127.0.0.1:${actualPort}`;

      // 1. Strict Host validation on ALL requests (DNS rebinding protection)
      const hostHeader = req.headers['host'];
      if (!hostHeader || hostHeader !== expectedHost) {
        res.writeHead(403, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(JSON.stringify({ error: 'Forbidden: invalid host header' }));
        return;
      }

      const urlObj = new URL(req.url || '/', `http://${expectedHost}`);
      const pathname = urlObj.pathname;

      // 2. Dispatch /local/* authenticated routes
      if (pathname.startsWith('/local/')) {
        handleLocalApiRoute(req, res, pathname, {
          targetFile,
          capability,
          expectedOrigin,
          sseClients,
          onRevisionChange: (newRev) => {
            lastKnownRevision = newRev;
            broadcastEvent('change', { revision: newRev, valid: true });
          },
        });
        return;
      }

      // 3. Static asset serving from realDistWeb
      handleStaticAsset(req, res, pathname, realDistWeb);
    });

    server.on('error', (err) => {
      if (watcher) watcher.close();
      if (reconciliationTimer) clearInterval(reconciliationTimer);
      rejectPromise(err);
    });

    const bindPort = options.port ?? 0;
    server.listen(bindPort, '127.0.0.1', () => {
      const address = server.address() as { port: number; address: string };
      const actualPort = address.port;
      const previewUrl = `http://127.0.0.1:${actualPort}/#local=${capability}`;

      const handle: PreviewServerHandle = {
        server,
        port: actualPort,
        capability,
        url: previewUrl,
        close: async () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          if (reconciliationTimer) clearInterval(reconciliationTimer);
          if (watcher) watcher.close();
          for (const client of sseClients) {
            try {
              client.end();
            } catch {
              // Ignore
            }
          }
          sseClients.clear();
          await new Promise<void>((cb) => server.close(() => cb()));
        },
      };

      if (options.open) {
        openBrowser(previewUrl);
      }

      resolvePromise(handle);
    });
  });
}

interface LocalApiContext {
  targetFile: string;
  capability: string;
  expectedOrigin: string;
  sseClients: Set<ServerResponse>;
  onRevisionChange: (rev: string) => void;
}

function handleLocalApiRoute(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  ctx: LocalApiContext
): void {
  // Common security headers for /local/*
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Verify Bearer token authorization
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized: missing bearer token' }));
    return;
  }

  const token = authHeader.slice(7).trim();
  if (token !== ctx.capability) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized: invalid capability token' }));
    return;
  }

  // Origin check for state-changing POST /local/save
  if (pathname === '/local/save') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const origin = req.headers['origin'];
    if (!origin || origin !== ctx.expectedOrigin) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: origin not allowed for local save' }));
      return;
    }

    handleLocalSave(req, res, ctx);
    return;
  }

  // Origin check if present on GET routes
  const origin = req.headers['origin'];
  if (origin && origin !== ctx.expectedOrigin) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: untrusted origin' }));
    return;
  }

  // Route: GET /local/document
  if (pathname === '/local/document') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const doc = readDocument(ctx.targetFile);
      if (!doc.validation.ok) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Document validation failed',
            issues: doc.validation.issues,
          })
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          revision: doc.revision,
          document: doc.validation.value,
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // Route: GET /local/events
  if (pathname === '/local/events') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`: stream connected\n\n`);
    ctx.sseClients.add(res);

    req.on('close', () => {
      ctx.sseClients.delete(res);
    });
    return;
  }

  // Unknown /local/* endpoint
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

function handleLocalSave(req: IncomingMessage, res: ServerResponse, ctx: LocalApiContext): void {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Content-Type must be application/json' }));
    return;
  }

  let bodyBytes = 0;
  const chunks: Buffer[] = [];
  let isTooLarge = false;

  req.on('data', (chunk: Buffer) => {
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_SAVE_BODY_BYTES) {
      isTooLarge = true;
      req.destroy();
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: `Payload too large. Exceeds maximum allowed ${MAX_SAVE_BODY_BYTES} bytes (160 KiB).`,
        })
      );
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    if (isTooLarge) return;

    let payload: { expectedRevision?: string; document?: unknown };
    try {
      const rawText = Buffer.concat(chunks).toString('utf-8');
      payload = JSON.parse(rawText);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
      return;
    }

    if (!payload.expectedRevision || typeof payload.expectedRevision !== 'string' || !payload.document) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload must contain expectedRevision and document object' }));
      return;
    }

    // Validate candidate document
    const validation = validateResume(payload.document);
    if (!validation.ok) {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Document validation failed',
          issues: validation.issues,
        })
      );
      return;
    }

    const candidateText = JSON.stringify(payload.document, null, 2) + '\n';

    try {
      const result = await applyDocumentTransaction({
        targetPath: ctx.targetFile,
        candidateContent: candidateText,
        expectedRevision: payload.expectedRevision,
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, revision: result.revision }));

      setImmediate(() => {
        ctx.onRevisionChange(result.revision);
      });
    } catch (err) {
      if (err instanceof DocumentConflictError || err instanceof LockTimeoutError) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message, conflict: true }));
        return;
      }
      if (err instanceof DocumentIoError) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });
}

function handleStaticAsset(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  realDistWeb: string
): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // Reject path traversal attacks: null characters, backslashes, double dots
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Default / to /index.html
  const decodedPath = decodeURIComponent(pathname);
  const relPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const candidatePath = resolve(realDistWeb, relPath);

  if (!existsSync(candidatePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // Assert canonical realpath is strictly contained within realDistWeb
  try {
    const canonicalPath = realpathSync(candidatePath);
    if (!canonicalPath.startsWith(realDistWeb)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const stat = lstatSync(canonicalPath);
    if (!stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = extname(canonicalPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const content = readFileSync(canonicalPath);
    res.end(content);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

export async function startPreviewServer(options: PreviewServerOptions): Promise<void> {
  const handle = await createPreviewServer(options);

  process.stdout.write(`\nPreview server started for: ${options.file}\n`);
  process.stdout.write(`Local URL: ${handle.url}\n\n`);
  process.stdout.write(`Security: Bound to 127.0.0.1 (IPv4 loopback only).\n`);
  process.stdout.write(`Press Ctrl+C to stop.\n\n`);

  // Handle graceful shutdown on signals
  const cleanup = async () => {
    process.stdout.write('\nShutting down preview server...\n');
    await handle.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep alive
  await new Promise(() => {});
}
