import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const targetDir = process.argv[2] || 'tests';
const fullTargetDir = resolve(targetDir);

function findTestFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findTestFiles(fullPath));
      } else if (entry.name.endsWith('.test.js') || entry.name.endsWith('.test.mjs')) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return results;
}

const files = findTestFiles(fullTargetDir);
if (files.length === 0) {
  console.error(`No test files found in ${targetDir}`);
  process.exit(1);
}

if (process.versions.bun) {
  const res = spawnSync('bun', ['test', ...files], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
} else {
  const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}
