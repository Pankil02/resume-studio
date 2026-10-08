import { runBridgeBrowserTests } from '../tests/browser/bridge.test.mjs';
import { runLayoutBrowserTests } from '../tests/browser/layout.test.mjs';
import { runEditorBrowserTests } from '../tests/browser/editor.test.mjs';
import { runE2ESecurityBrowserTests } from '../tests/browser/e2e-security.test.mjs';
import { runA11yBrowserTests } from '../tests/browser/a11y.test.mjs';

const args = process.argv.slice(2);
let grepPattern = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--grep' || args[i] === '-g') {
    grepPattern = args[i + 1] || null;
    i++;
  } else if (args[i].startsWith('--grep=')) {
    grepPattern = args[i].slice(7);
  }
}

const tests = [
  { name: 'local bridge: session bootstrap and hosted isolation', fn: runBridgeBrowserTests },
  { name: 'layout: A4 templates, pagination, PDF, and overflow diagnostics', fn: runLayoutBrowserTests },
  { name: 'editor: form interactions, dirty tracking, conflicts, and PDF action', fn: runEditorBrowserTests },
  { name: 'e2e & security: agent round-trip, XSS inertness, and attack boundaries', fn: runE2ESecurityBrowserTests },
  { name: 'accessibility: form labels, roles, modal focus trapping, and DOM hierarchy', fn: runA11yBrowserTests },
];

async function main() {
  console.log(`Running browser test suite via Playwright Chromium...`);
  const regex = grepPattern ? new RegExp(grepPattern, 'i') : null;
  let executed = 0;

  for (const t of tests) {
    if (regex && !regex.test(t.name)) {
      continue;
    }
    console.log(`\n• Running: ${t.name}`);
    const start = Date.now();
    try {
      await t.fn();
      const elapsed = Date.now() - start;
      console.log(`  PASSED (${elapsed}ms)`);
      executed++;
    } catch (err) {
      console.error(`  FAILED: ${(err && err.message) || err}`);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    }
  }

  console.log(`\nBrowser test suite passed (${executed} test suite(s) executed).`);
}

main().catch((err) => {
  console.error('Fatal browser test runner error:', err);
  process.exit(1);
});
