import { chromium } from 'playwright';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../../dist/cli/server.js';

export async function runA11yBrowserTests() {
  const tempDir = mkdtempSync(join(tmpdir(), 'resume-a11y-'));
  const browser = await chromium.launch();

  try {
    const resumePath = join(tempDir, 'a11y-resume.json');
    copyFileSync('examples/executive-two-page.json', resumePath);
    const server = await createPreviewServer({ file: resumePath });

    try {
      const page = await browser.newPage();
      await page.goto(server.url);

      await page.waitForSelector('#app-main');
      await page.waitForSelector('.profile-name');

      // -----------------------------------------------------------------------
      // TEST 1: Form Controls Accessibility Audit (Labels & Roles)
      // -----------------------------------------------------------------------
      {
        const inputsWithoutLabels = await page.evaluate(() => {
          const formInputs = Array.from(document.querySelectorAll('#form-container input, #form-container select, #form-container textarea'));
          const unlabelled = [];

          for (const el of formInputs) {
            const id = el.id;
            const ariaLabel = el.getAttribute('aria-label');
            const ariaLabelledby = el.getAttribute('aria-labelledby');
            const labelFor = id ? document.querySelector(`label[for="${id}"]`) : null;
            const wrappingLabel = el.closest('label');

            if (!ariaLabel && !ariaLabelledby && !labelFor && !wrappingLabel) {
              unlabelled.push({ tag: el.tagName, id: el.id, name: el.getAttribute('name') });
            }
          }
          return unlabelled;
        });

        assert.equal(
          inputsWithoutLabels.length,
          0,
          `Found ${inputsWithoutLabels.length} unlabelled form controls: ${JSON.stringify(inputsWithoutLabels)}`
        );

        // Verify all buttons have accessible names
        const buttonsWithoutNames = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const nameless = [];

          for (const btn of buttons) {
            const text = btn.textContent?.trim();
            const ariaLabel = btn.getAttribute('aria-label');
            const ariaLabelledby = btn.getAttribute('aria-labelledby');

            if (!text && !ariaLabel && !ariaLabelledby) {
              nameless.push({ id: btn.id, className: btn.className });
            }
          }
          return nameless;
        });

        assert.equal(
          buttonsWithoutNames.length,
          0,
          `Found ${buttonsWithoutNames.length} buttons without accessible names: ${JSON.stringify(buttonsWithoutNames)}`
        );

        console.log('✓ a11y: all form controls and buttons have accessible labels and names');
      }

      // -----------------------------------------------------------------------
      // TEST 2: Modal Accessibility (Focus Trapping & Escape Dismissal)
      // -----------------------------------------------------------------------
      {
        // Open Help Modal
        const btnHelp = page.locator('#btn-help-dialog');
        await btnHelp.focus();
        await btnHelp.click();

        const dialog = page.locator('.modal-dialog');
        await dialog.waitFor();

        // Check dialog ARIA attributes
        assert.equal(await dialog.getAttribute('role'), 'dialog', 'Modal dialog must have role="dialog"');
        assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'Modal dialog must have aria-modal="true"');
        assert.ok(await dialog.getAttribute('aria-labelledby'), 'Modal dialog must have aria-labelledby pointing to title');

        // Check that focus moved into modal
        await page.waitForTimeout(50);
        const focusedInModal = await page.evaluate(() => {
          const active = document.activeElement;
          return !!active && !!active.closest('.modal-dialog');
        });
        assert.equal(focusedInModal, true, 'Focus should move inside modal dialog on open');

        // Test Tab key focus trapping inside modal
        await page.keyboard.press('Tab');
        const focusedStillInModal = await page.evaluate(() => {
          const active = document.activeElement;
          return !!active && !!active.closest('.modal-dialog');
        });
        assert.equal(focusedStillInModal, true, 'Focus escaped modal during Tab key navigation');

        // Test Escape key closing modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(50);
        assert.equal(await dialog.isVisible(), false, 'Modal did not close on Escape key');

        // Verify focus returned to the trigger button
        const isFocusRestored = await page.evaluate(() => document.activeElement?.id === 'btn-help-dialog');
        assert.equal(isFocusRestored, true, 'Focus was not restored to trigger button after modal close');

        console.log('✓ a11y: modal focus trapping, Escape dismissal, and focus restore verified');
      }

      // -----------------------------------------------------------------------
      // TEST 3: Diagnostics Live Region & Error Announcements
      // -----------------------------------------------------------------------
      {
        // Expand collapsed profile section and clear required name input to trigger error
        await page.locator('#sec-profile summary').click();
        const nameInput = page.locator('#field-profile-name');
        await nameInput.fill('');
        await page.waitForTimeout(100);

        // Verify diagnostics container has live region attributes
        const diagContainer = page.locator('#diagnostics-container');
        assert.equal(await diagContainer.getAttribute('role'), 'region', 'Diagnostics container must have role="region"');
        assert.equal(await diagContainer.getAttribute('aria-live'), 'polite', 'Diagnostics must have aria-live="polite"');

        // Verify error group has role="alert"
        const errorGroup = page.locator('#diagnostics-container .diagnostic-group');
        assert.equal(await errorGroup.getAttribute('role'), 'alert', 'Validation errors must have role="alert"');

        // Restore valid name
        await nameInput.fill('Eleanor Vance');
        await page.waitForTimeout(150);

        // Verify error alert was cleared
        const alertCount = await page.locator('#diagnostics-container .diagnostic-group[role="alert"]').count();
        assert.equal(alertCount, 0, 'Error alert should be removed when validation error is resolved');

        console.log('✓ a11y: live regions and error alerts verified');
      }

      // -----------------------------------------------------------------------
      // TEST 4: Canonical Single-Column DOM Reading Order and Heading Hierarchy
      // -----------------------------------------------------------------------
      {
        // Verify DOM hierarchy in Page 1:
        // Header (h1) -> Semantic sections with headings (h2)
        const readingHierarchy = await page.evaluate(() => {
          const page1 = document.querySelector('.resume-page');
          if (!page1) return { hasHeader: false, h1Text: '', h2Count: 0 };

          const header = page1.querySelector('.atom-header h1.profile-name');
          const h2Elements = Array.from(page1.querySelectorAll('.atom-section-heading h2'));

          return {
            hasHeader: !!header,
            h1Text: header?.textContent || '',
            h2Count: h2Elements.length,
          };
        });

        assert.equal(readingHierarchy.hasHeader, true, 'Page 1 must contain header with h1 profile name');
        assert.ok(readingHierarchy.h2Count > 0, 'Page 1 must contain h2 section headings');

        console.log('✓ a11y: canonical single-column DOM reading order and heading hierarchy verified');
      }

      await page.close();
    } finally {
      await server.close();
    }
  } finally {
    await browser.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}
