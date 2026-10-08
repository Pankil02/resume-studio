import { chromium } from 'playwright';
import { mkdtempSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../../dist/cli/server.js';

export async function runLayoutBrowserTests() {
  const tempDir = mkdtempSync(join(tmpdir(), 'resume-browser-layout-'));

  const browser = await chromium.launch();
  try {
    // -------------------------------------------------------------------------
    // TEST 1: Classic 1-Page Layout Geometry, Typography, and Conservation
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'classic.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('.resume-page');
        const pages = page.locator('.resume-page');
        const pageCount = await pages.count();
        assert.equal(pageCount, 1, `Expected 1 page for classic starter, got ${pageCount}`);

        // Verify physical A4 dimensions (~793.7px x ~1122.5px @ 96 DPI)
        const box = await pages.first().boundingBox();
        assert.ok(box, 'Missing page bounding box');
        assert.ok(Math.abs(box.width - 793.7) < 3, `Expected width ~794px, got ${box.width}`);
        assert.ok(Math.abs(box.height - 1122.5) < 3, `Expected height ~1123px, got ${box.height}`);

        // Verify typography: Serif font family
        const fontFamily = await pages.first().evaluate((el) => window.getComputedStyle(el).fontFamily);
        assert.ok(fontFamily.includes('serif'), `Expected serif font family, got ${fontFamily}`);

        // Verify no overflow banner
        const overflowCount = await page.locator('.resume-overflow-banner').count();
        assert.equal(overflowCount, 0, 'Unexpected overflow banner on valid 1-page document');

        // Verify text content is selectable and readable
        const nameText = await page.locator('.profile-name').textContent();
        assert.equal(nameText, 'Morgan Reed');

        // Generate headless Chromium PDF and verify
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        assert.ok(pdfBuffer.length > 5000, 'PDF buffer unexpectedly small');
        const pdfString = pdfBuffer.toString('latin1');
        assert.ok(pdfString.startsWith('%PDF-'), 'Not a valid PDF file');

        // Verify page count in PDF stream (/Type /Page occurs once)
        const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
        assert.equal(pageMatches?.length, 1, `Expected exactly 1 page in PDF, got ${pageMatches?.length}`);

        console.log('✓ layout: classic 1-page geometry, serif typography, and PDF verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 2: Classic 2-Page Layout, Pagination, and PDF
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'two-page.json');
      copyFileSync('examples/modern-two-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('.resume-page');
        await page.waitForFunction(() => document.querySelectorAll('.resume-page').length === 2);
        const pages = page.locator('.resume-page');
        const pageCount = await pages.count();
        assert.equal(pageCount, 2, `Expected 2 pages for two-page example, got ${pageCount}`);

        // Typography: Serif font family
        const fontFamily = await pages.first().evaluate((el) => window.getComputedStyle(el).fontFamily);
        assert.ok(
          fontFamily.includes('serif'),
          `Expected serif font family, got ${fontFamily}`
        );

        // Verify second page has valid content
        const p2Box = await pages.nth(1).boundingBox();
        assert.ok(p2Box, 'Page 2 bounding box missing');
        assert.ok(Math.abs(p2Box.width - 793.7) < 3);

        // Verify no overflow banner
        const overflowCount = await page.locator('.resume-overflow-banner').count();
        assert.equal(overflowCount, 0, 'Unexpected overflow banner on fitting 2-page document');

        // Generate headless Chromium PDF and verify 2 pages
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        const pdfString = pdfBuffer.toString('latin1');
        const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
        assert.equal(pageMatches?.length, 2, `Expected exactly 2 pages in PDF, got ${pageMatches?.length}`);

        console.log('✓ layout: classic 2-page pagination, serif typography, and 2-page PDF verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 3: Multi-Page Entry Splitting and Single-Column Flow
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'split.json');
      copyFileSync('tests/fixtures/layout/long-entry-split.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('.resume-page');
        await page.waitForFunction(() => document.querySelectorAll('.resume-page').length === 2);
        const pages = page.locator('.resume-page');
        const pageCount = await pages.count();
        assert.equal(pageCount, 2, `Expected 2 pages for split example, got ${pageCount}`);

        // Verify single-column layout across both pages
        const p1 = pages.nth(0);
        const p2 = pages.nth(1);
        assert.equal(await p1.locator('.resume-page-content').count(), 1, 'Page 1 missing page content');
        assert.equal(await p2.locator('.resume-page-content').count(), 1, 'Page 2 missing page content');

        // Verify PDF export
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        const pdfString = pdfBuffer.toString('latin1');
        const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
        assert.equal(pageMatches?.length, 2, `Expected exactly 2 pages in PDF, got ${pageMatches?.length}`);

        console.log('✓ layout: entry splitting and single-column flow verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 4: Overflow Fixture Blocks Print and Displays Diagnostics List
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'overflow.json');
      copyFileSync('tests/fixtures/layout/classic-one-line-over.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('.resume-overflow-banner');

        const banner = page.locator('.resume-overflow-banner');
        assert.equal(await banner.count(), 1, 'Overflow banner must be visible');
        const bannerText = await banner.textContent();
        assert.ok(bannerText?.includes('Page Limit Exceeded'), 'Banner missing expected heading');

        // Verify affected JSON paths are rendered in the diagnostics list
        const paths = page.locator('.overflow-item-path');
        const allPaths = await paths.allTextContents();
        assert.ok(allPaths.length > 0, 'Diagnostics list must display unplaced paths');
        assert.ok(
          allPaths.some((p) => p.includes('projects') || p.includes('skills') || p.includes('experience')),
          `Expected paths to include overflowed sections, got ${allPaths.join(', ')}`
        );

        // Verify that exactly 1 page was rendered (since maxPages was 1)
        const pages = page.locator('.resume-page');
        assert.equal(await pages.count(), 1, 'Should render 1 page with overflow banner');

        console.log('✓ layout: overflow banner and unplaced JSON paths diagnostics verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 5: Long Strings Wrapping and Layout Boundary Containment
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'long-strings.json');
      copyFileSync('tests/fixtures/layout/long-strings.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('.resume-page');
        const pages = page.locator('.resume-page');

        // Check horizontal containment: scrollWidth must equal clientWidth
        const isContained = await pages.first().evaluate((el) => {
          return el.scrollWidth <= el.clientWidth + 1; // 1px rounding tolerance
        });
        assert.ok(isContained, 'Long strings caused horizontal overflow');

        console.log('✓ layout: boundary wrapping and horizontal containment verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 6: Print Media Geometry and Zero Print Chrome under Preview Zoom
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'print-zoom-test.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.goto(server.url);

        await page.waitForSelector('.resume-page');
        await page.waitForSelector('#btn-zoom-fit');

        // Apply Fit zoom factor (typically ~0.75-0.85 in 1400px viewport)
        await page.locator('#btn-zoom-fit').click();

        const screenZoom = await page.evaluate(() => {
          const el = document.getElementById('preview-pane');
          return getComputedStyle(el).getPropertyValue('--preview-zoom');
        });
        assert.ok(parseFloat(screenZoom) < 0.95, `Expected preview zoom to be scaled down on screen, got ${screenZoom}`);

        // Emulate print media
        await page.emulateMedia({ media: 'print' });

        // Verify zero print chrome: toolbar, vertical controls, header, and editor pane hidden
        const controlsVisible = await page.locator('.preview-vertical-controls').isVisible();
        assert.equal(controlsVisible, false, 'Preview zoom controls should be hidden in print');

        const headerVisible = await page.locator('#app-header').isVisible();
        assert.equal(headerVisible, false, 'App header should be hidden in print');

        const editorVisible = await page.locator('#editor-pane').isVisible();
        assert.equal(editorVisible, false, 'Editor pane should be hidden in print');

        // Verify container zoom reset to 1:1 in print media
        const printZoom = await page.evaluate(() => {
          const el = document.querySelector('.resume-pages-container');
          return window.getComputedStyle(el).zoom;
        });
        assert.equal(printZoom, '1', `Container zoom must reset to 1 in print, got ${printZoom}`);

        // Verify physical A4 page box matches exact 210mm x 297mm (~793.7px x ~1122.5px @ 96 DPI)
        const box = await page.locator('.resume-page').first().boundingBox();
        assert.ok(box, 'Missing page bounding box in print');
        assert.ok(Math.abs(box.width - 793.7) < 3, `Expected print width ~794px, got ${box.width}`);
        assert.ok(Math.abs(box.height - 1122.5) < 3, `Expected print height ~1123px, got ${box.height}`);

        // Verify PDF generation matches 1 page
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        const pdfString = pdfBuffer.toString('latin1');
        const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
        assert.equal(pageMatches?.length, 1, `Expected exactly 1 page in PDF under scaled preview, got ${pageMatches?.length}`);

        console.log('✓ layout: print media geometry, hidden controls, and zoom reset verified');
        await page.close();
      } finally {
        await server.close();
      }
    }
  } finally {
    await browser.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}
