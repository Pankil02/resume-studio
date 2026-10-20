#!/usr/bin/env node
/**
 * Backwards-compatible wrapper delegating to bin/openresume.mjs install
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSkills } from '../bin/openresume.mjs';

const args = process.argv.slice(2);
const local = args.includes('--local') || args.includes('-l');
const symlink = args.includes('--symlink') || args.includes('-s');

console.log(`Installing openresume skill (${local ? 'Workspace' : 'Global'})...`);
const installed = installSkills({ local, symlink });
for (const p of installed) {
  console.log(`  📁 ${p}`);
}
console.log(`\nSuccessfully installed 'openresume' to ${installed.length} target location(s).`);

