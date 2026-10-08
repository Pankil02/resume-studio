import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const webDir = resolve('dist/web');
if (!existsSync(webDir)) {
  console.error('Error: dist/web does not exist. Run build first.');
  process.exit(1);
}

function getAllFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllFiles(webDir);
let totalJsGzip = 0;
let totalCssGzip = 0;
let totalPayloadGzip = 0;

// Allowlist of permissible patterns in dist/web
const ALLOWED_EXTENSIONS = new Set(['.html', '.js', '.css', '.svg', '.ico', '']); // '' for _headers
const FORBIDDEN_EXTENSIONS = new Set(['.json', '.ts', '.map', '.bak', '.env', '.md', '.txt', '.lock']);

let allowlistFailures = [];

for (const file of files) {
  const relPath = relative(webDir, file);
  const content = readFileSync(file);
  const gz = gzipSync(content);
  totalPayloadGzip += gz.length;

  // Strict file allowlist enforcement
  const baseName = relPath.split('/').pop() || '';
  const ext = baseName.includes('.') ? `.${baseName.split('.').pop()}` : '';

  if (baseName === '_headers') {
    // Valid Cloudflare Pages configuration header
  } else if (FORBIDDEN_EXTENSIONS.has(ext.toLowerCase())) {
    allowlistFailures.push(`Forbidden file extension in dist/web: ${relPath}`);
  } else if (!ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
    allowlistFailures.push(`Unrecognized file in dist/web: ${relPath}`);
  }

  if (file.endsWith('.js')) {
    totalJsGzip += gz.length;
    // Check for forbidden node-builtins or schema compilers
    const text = content.toString('utf-8');
    if (text.includes('ajv/') || text.includes('node:fs') || text.includes('node:path') || text.includes('node:http') || text.includes('child_process')) {
      console.error(`Error: Found forbidden Node/compiler reference in ${file}`);
      process.exit(1);
    }
  } else if (file.endsWith('.css')) {
    totalCssGzip += gz.length;
  }

  // Check forbidden private patterns
  const lower = file.toLowerCase();
  if (lower.includes('backup') || lower.includes('.env') || lower.includes('.key') || lower.includes('resume.json')) {
    console.error(`Error: Private or sensitive file found in dist/web: ${file}`);
    process.exit(1);
  }
}

if (allowlistFailures.length > 0) {
  console.error('Allowlist validation failed for dist/web:');
  for (const failure of allowlistFailures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

const JS_BUDGET_BYTES = 50 * 1024; // 50 KiB
const CSS_BUDGET_BYTES = 20 * 1024; // 20 KiB
const TOTAL_BUDGET_BYTES = 100 * 1024; // 100 KiB

console.log(`Build check report:`);
console.log(`- Total JS (gzip): ${(totalJsGzip / 1024).toFixed(2)} KiB (budget: 50 KiB)`);
console.log(`- Total CSS (gzip): ${(totalCssGzip / 1024).toFixed(2)} KiB (budget: 20 KiB)`);
console.log(`- Total Initial Payload (gzip): ${(totalPayloadGzip / 1024).toFixed(2)} KiB (budget: 100 KiB)`);
console.log(`- Verified file allowlist: all ${files.length} static assets strictly allowed.`);

let failed = false;
if (totalJsGzip > JS_BUDGET_BYTES) {
  console.error(`FAIL: JS exceeds 50 KiB budget!`);
  failed = true;
}
if (totalCssGzip > CSS_BUDGET_BYTES) {
  console.error(`FAIL: CSS exceeds 20 KiB budget!`);
  failed = true;
}
if (totalPayloadGzip > TOTAL_BUDGET_BYTES) {
  console.error(`FAIL: Total payload exceeds 100 KiB budget!`);
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('Build check passed.');
