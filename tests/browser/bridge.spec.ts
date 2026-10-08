import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewServer, type PreviewServerHandle } from '../../src/cli/server.js';
import { initDocument } from '../../src/cli/documents.js';

test.describe('local bridge', () => {
  let tempDir: string;
  let serverHandle: PreviewServerHandle;
  let resumePath: string;

  test.beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'resume-browser-test-'));
    resumePath = join(tempDir, 'resume.json');
    initDocument({ filePath: resumePath, template: 'classic', maxPages: 1 });
    serverHandle = await createPreviewServer({ file: resumePath });
  });

  test.afterAll(async () => {
    if (serverHandle) {
      await serverHandle.close();
    }
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test('bootstraps session capability, strips URL fragment, and displays connected status', async ({ page }) => {
    const launchUrl = `${serverHandle.url}`;
    await page.goto(launchUrl);

    // Verify fragment is immediately removed from browser URL
    await page.waitForFunction('!window.location.hash.includes("local=")');
    expect(page.url()).not.toContain('local=');

    // Verify connected status element is populated
    const statusEl = page.locator('#bridge-status');
    await expect(statusEl).toBeVisible();
    await expect(statusEl).toContainText('Connected to local bridge');
  });

  test('hosted mode without fragment does not probe local bridge', async ({ page }) => {
    const hostedUrl = `http://127.0.0.1:${serverHandle.port}/`;
    await page.goto(hostedUrl);

    // Verify hosted mode status
    const statusText = page.locator('#app-main');
    await expect(statusText).toContainText('Application initialized in hosted mode.');

    // Local bridge status element should not exist
    const bridgeStatus = page.locator('#bridge-status');
    await expect(bridgeStatus).toHaveCount(0);
  });
});
