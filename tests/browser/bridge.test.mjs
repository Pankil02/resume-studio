import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../../dist/cli/server.js';
import { initDocument } from '../../dist/cli/documents.js';

export async function runBridgeBrowserTests() {
  const tempDir = mkdtempSync(join(tmpdir(), 'resume-browser-bridge-'));
  const resumePath = join(tempDir, 'resume.json');
  initDocument({ filePath: resumePath, template: 'classic', maxPages: 1 });
  const server = await createPreviewServer({ file: resumePath });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    // Test 1: Session capability bootstrap, URL fragment stripping, and connected status
    await page.goto(server.url);

    // Assert that the fragment is immediately stripped
    await page.waitForFunction(() => !window.location.hash.includes('local='));
    const cleanUrl = page.url();
    assert.equal(cleanUrl.includes('local='), false, 'Fragment was not removed from browser URL');

    // Assert connected status
    const statusEl = await page.waitForSelector('#bridge-status');
    const text = await statusEl.textContent();
    assert.equal(
      text?.includes('Connected to local bridge'),
      true,
      `Expected status text to include 'Connected to local bridge', got '${text}'`
    );

    // Test 2: Hosted mode without fragment does not probe local bridge
    await page.goto(`http://127.0.0.1:${server.port}/`);
    const appMain = await page.waitForSelector('#app-main');
    const hostedText = await appMain.textContent();
    assert.equal(
      hostedText?.includes('Application initialized in hosted mode.'),
      true,
      'Hosted mode text missing'
    );

    const bridgeCount = await page.locator('#bridge-status').count();
    assert.equal(bridgeCount, 0, 'Bridge status element should not exist in hosted mode');

    // Test 3: Hosted mode File System Sync toolbar controls are initialized
    const syncStatusEl = page.locator('#sync-status');
    assert.equal(await syncStatusEl.isVisible(), true, 'Sync status pill should be visible in hosted mode');
    const syncText = await syncStatusEl.textContent();
    assert.equal(syncText?.includes('Not Linked'), true, 'Sync status should indicate Not Linked initially');

    const btnSyncFile = page.locator('#btn-sync-file');
    assert.equal(await btnSyncFile.isVisible(), true, 'Link File button should be visible in hosted mode');

    console.log('✓ browser: local bridge session bootstrap and hosted isolation verified');
  } finally {
    await browser.close();
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}
