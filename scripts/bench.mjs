import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir, platform, arch, cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { parseResume } from '../src/core/validation.js';
import { buildSemanticAtoms } from '../src/web/blocks.js';
import { paginateResume } from '../src/web/paginate.js';
import { initDocument } from '../src/cli/documents.js';
import { applyDocumentTransaction } from '../src/cli/locks.js';

function percentile(arr, p) {
  const idx = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, idx)];
}

console.log('='.repeat(70));
console.log('RESUME STUDIO — SYNTHETIC PERFORMANCE BENCHMARKS');
console.log('='.repeat(70));

const cpuInfo = cpus()[0] ? cpus()[0].model : 'Unknown';
console.log(`Environment: ${platform()} ${arch()} | CPU: ${cpuInfo}`);
console.log(`Node / Bun Runtime: ${process.version} | Timestamp: ${new Date().toISOString()}`);
console.log('-'.repeat(70));

// -----------------------------------------------------------------------------
// 1. Validation Benchmark
// -----------------------------------------------------------------------------
console.log('\n[1/3] Benchmarking Pure Schema & Semantic Validation (200 iterations)...');
const examplePath = resolve('examples/classic-one-page.json');
const normalDocText = readFileSync(examplePath, 'utf-8');

// Build a synthetic ~128 KiB stress document
const baseDoc = JSON.parse(normalDocText);
const largeDoc = JSON.parse(normalDocText);
largeDoc.experience = [];
for (let i = 0; i < 12; i++) {
  largeDoc.experience.push({
    id: `exp-${i}`,
    employer: `Enterprise Systems Inc ${i} with extended legal enterprise name`,
    role: `Principal Software Infrastructure Architect & Staff Systems Engineer Level ${i}`,
    location: 'San Francisco, CA / Remote Global Distributed Hub',
    start: '2020-01',
    end: '2024-01',
    bullets: [
      'Engineered distributed database replication cluster scaling to millions of concurrent reads and sub-millisecond p99 latency guarantees.',
      'Authored RFCs defining zero-trust service mesh authentication policies across Kubernetes nodes.',
      'Reduced cloud infrastructure compute expenditures by 42% through automated capacity scheduling.',
      'Refactored legacy monolith into event-driven stream processing topology with deterministic replay capabilities.',
      'Mentored 18 senior software engineers across distributed global engineering organizations in 5 time zones.',
      'Designed and executed automated multi-region failover disaster recovery tests with zero data loss.',
    ],
  });
}
const largeDocText = JSON.stringify(largeDoc, null, 2);
const largeDocBytes = Buffer.byteLength(largeDocText, 'utf-8');

const RUNS = 200;

// Warmup
for (let i = 0; i < 20; i++) {
  parseResume(normalDocText);
  parseResume(largeDocText);
}

const valTimesNormal = [];
for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  const res = parseResume(normalDocText);
  const t1 = performance.now();
  if (!res.ok) {
    console.error('Validation benchmark failed on normal fixture:', res.issues);
    process.exit(1);
  }
  valTimesNormal.push(t1 - t0);
}
valTimesNormal.sort((a, b) => a - b);

const valTimesLarge = [];
for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  const res = parseResume(largeDocText);
  const t1 = performance.now();
  if (!res.ok) {
    console.error('Validation benchmark failed on stress fixture:', res.issues);
    process.exit(1);
  }
  valTimesLarge.push(t1 - t0);
}
valTimesLarge.sort((a, b) => a - b);

const normP50 = percentile(valTimesNormal, 50);
const normP95 = percentile(valTimesNormal, 95);
const normP99 = percentile(valTimesNormal, 99);

const largeP50 = percentile(valTimesLarge, 50);
const largeP95 = percentile(valTimesLarge, 95);
const largeP99 = percentile(valTimesLarge, 99);

console.log(`Normal Document (~${(Buffer.byteLength(normalDocText) / 1024).toFixed(1)} KiB):`);
console.log(`  p50: ${normP50.toFixed(3)} ms | p95: ${normP95.toFixed(3)} ms (target <= 20 ms) | p99: ${normP99.toFixed(3)} ms`);
console.log(`Stress Document (~${(largeDocBytes / 1024).toFixed(1)} KiB):`);
console.log(`  p50: ${largeP50.toFixed(3)} ms | p95: ${largeP95.toFixed(3)} ms (target <= 20 ms) | p99: ${largeP99.toFixed(3)} ms`);

if (normP95 > 20 || largeP95 > 20) {
  console.error('FAIL: Validation p95 latency exceeded 20ms budget!');
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 2. Pagination & Layout Pipeline Benchmark
// -----------------------------------------------------------------------------
console.log('\n[2/3] Benchmarking Measured Pagination Algorithm (200 iterations)...');
const execTwoPagePath = resolve('examples/executive-two-page.json');
const execTwoPage = JSON.parse(readFileSync(execTwoPagePath, 'utf-8'));

// Synthetic mock measure function matching typical DOM element heights
function mockMeasureAtoms(atoms, widthMm) {
  let height = 0;
  for (const a of atoms) {
    if (a.type === 'header') height += 120;
    else if (a.type === 'section-heading') height += 35;
    else if (a.type === 'entry-heading') height += 30;
    else if (a.type === 'bullet') height += 22;
    else if (a.type === 'skill-group') height += 28;
    else height += 25;
  }
  return height;
}

const pageCapacityPx = 1016.69; // 269mm @ 96 DPI
const atomsClassic = buildSemanticAtoms(baseDoc);
const atomsExec = buildSemanticAtoms(execTwoPage);

// Warmup
for (let i = 0; i < 20; i++) {
  paginateResume({ resume: baseDoc, atoms: atomsClassic, pageCapacityPx, measureFn: mockMeasureAtoms });
  paginateResume({ resume: execTwoPage, atoms: atomsExec, pageCapacityPx, measureFn: mockMeasureAtoms });
}

const pagTimesClassic = [];
for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  paginateResume({ resume: baseDoc, atoms: atomsClassic, pageCapacityPx, measureFn: mockMeasureAtoms });
  const t1 = performance.now();
  pagTimesClassic.push(t1 - t0);
}
pagTimesClassic.sort((a, b) => a - b);

const pagTimesExec = [];
for (let i = 0; i < RUNS; i++) {
  const t0 = performance.now();
  paginateResume({ resume: execTwoPage, atoms: atomsExec, pageCapacityPx, measureFn: mockMeasureAtoms });
  const t1 = performance.now();
  pagTimesExec.push(t1 - t0);
}
pagTimesExec.sort((a, b) => a - b);

const pagClassP50 = percentile(pagTimesClassic, 50);
const pagClassP95 = percentile(pagTimesClassic, 95);
const pagClassP99 = percentile(pagTimesClassic, 99);

const pagExecP50 = percentile(pagTimesExec, 50);
const pagExecP95 = percentile(pagTimesExec, 95);
const pagExecP99 = percentile(pagTimesExec, 99);

console.log(`Classic 1-Page Layout:`);
console.log(`  p50: ${pagClassP50.toFixed(3)} ms | p95: ${pagClassP95.toFixed(3)} ms (target <= 100 ms) | p99: ${pagClassP99.toFixed(3)} ms`);
console.log(`Executive 2-Page (Sidebar + Continuation) Layout:`);
console.log(`  p50: ${pagExecP50.toFixed(3)} ms | p95: ${pagExecP95.toFixed(3)} ms (target <= 100 ms) | p99: ${pagExecP99.toFixed(3)} ms`);

if (pagClassP95 > 100 || pagExecP95 > 100) {
  console.error('FAIL: Pagination p95 latency exceeded 100ms budget!');
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 3. Document Save Transaction Benchmark
// -----------------------------------------------------------------------------
console.log('\n[3/3] Benchmarking Local Save Transaction (Lock, Backup, Atomic Rename) (200 iterations)...');
const tempDir = mkdtempSync(join(tmpdir(), 'resume-bench-save-'));
const saveDocPath = join(tempDir, 'bench-save.json');
let { revision: currentRev } = initDocument({ filePath: saveDocPath });

const saveTimes = [];
for (let i = 0; i < RUNS; i++) {
  const modDoc = JSON.parse(normalDocText);
  modDoc.profile.name = `Benchmark Iteration ${i}`;
  const candidateText = JSON.stringify(modDoc, null, 2) + '\n';

  const t0 = performance.now();
  const res = await applyDocumentTransaction({
    targetPath: saveDocPath,
    candidateContent: candidateText,
    expectedRevision: currentRev,
  });
  const t1 = performance.now();
  currentRev = res.revision;
  saveTimes.push(t1 - t0);
}
saveTimes.sort((a, b) => a - b);
rmSync(tempDir, { recursive: true, force: true });

const saveP50 = percentile(saveTimes, 50);
const saveP95 = percentile(saveTimes, 95);
const saveP99 = percentile(saveTimes, 99);

console.log(`Local Disk Save Transaction:`);
console.log(`  p50: ${saveP50.toFixed(3)} ms | p95: ${saveP95.toFixed(3)} ms (target <= 150 ms) | p99: ${saveP99.toFixed(3)} ms`);

if (saveP95 > 150) {
  console.error('FAIL: Save transaction p95 latency exceeded 150ms budget!');
  process.exit(1);
}

console.log('\n' + '='.repeat(70));
console.log('ALL PERFORMANCE BENCHMARKS PASSED WITHIN BUDGET');
console.log('='.repeat(70));
