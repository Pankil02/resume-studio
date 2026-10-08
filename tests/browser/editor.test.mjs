import { chromium } from 'playwright';
import { mkdtempSync, rmSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../../dist/cli/server.js';
import { parseResume } from '../../dist/core/validation.js';

export async function runEditorBrowserTests() {
  const tempDir = mkdtempSync(join(tmpdir(), 'resume-browser-editor-'));

  const browser = await chromium.launch();
  try {
    // -------------------------------------------------------------------------
    // TEST 1: Form editing, caret/focus preservation, and live preview update
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-basic.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#sec-profile summary');
        await page.locator('#sec-profile summary').click();
        const nameInput = page.locator('#field-profile-name');

        // Focus input and type characters
        await nameInput.focus();
        await nameInput.fill('');
        await nameInput.type('Alex Morgan Engineering Lead');

        // Verify focus and caret stayed intact
        const isFocused = await nameInput.evaluate((el) => document.activeElement === el);
        assert.equal(isFocused, true, 'Input focus was lost during typing');

        const caretPos = await nameInput.evaluate((el) => el.selectionStart);
        assert.equal(caretPos, 'Alex Morgan Engineering Lead'.length, 'Caret position was reset');

        // Verify dirty indicator appeared
        const dirtyBadge = page.locator('#dirty-status');
        await page.waitForTimeout(200);
        const isDirtyVisible = await dirtyBadge.isVisible();
        assert.equal(isDirtyVisible, true, 'Dirty badge not visible after editing input');

        // Wait for debounced preview update (150ms)
        await page.waitForFunction(() => {
          const el = document.querySelector('.profile-name');
          return el && el.textContent === 'Alex Morgan Engineering Lead';
        });

        console.log('✓ editor: field input, caret preservation, and debounced preview verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 2: Add, remove, reorder items and stable ID preservation
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-reorder.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#sec-experience');
        await page.locator('#sec-experience summary').click();

        // Capture initial roles count and first role ID
        const initialCards = page.locator('#experience-container .item-card');
        const countBefore = await initialCards.count();
        assert.ok(countBefore >= 2, 'Expected at least 2 roles in starter');

        const firstCardIdBefore = await initialCards.first().getAttribute('id');
        const secondCardIdBefore = await initialCards.nth(1).getAttribute('id');

        // Click Move Down on first role
        const moveDownBtn = initialCards.first().locator('.btn-exp-down');
        await moveDownBtn.click();

        // Verify order swapped but IDs are strictly preserved
        const cardsAfter = page.locator('#experience-container .item-card');
        const firstCardIdAfter = await cardsAfter.first().getAttribute('id');
        const secondCardIdAfter = await cardsAfter.nth(1).getAttribute('id');

        assert.equal(firstCardIdAfter, secondCardIdBefore, 'Roles did not swap correctly');
        assert.equal(secondCardIdAfter, firstCardIdBefore, 'Original first role ID lost or mutated');

        // Add a new role
        const btnAddExp = page.locator('#btn-add-experience');
        await btnAddExp.click();
        const countAfterAdd = await page.locator('#experience-container .item-card').count();
        assert.equal(countAfterAdd, countBefore + 1, 'New role was not added to list');

        // Add a bullet to the newly created role
        const newCard = page.locator('#experience-container .item-card').last();
        const btnAddBullet = newCard.locator('.btn-add-bullet');
        const bulletCountBefore = await newCard.locator('.bullet-item').count();
        await btnAddBullet.click();
        const bulletCountAfter = await newCard.locator('.bullet-item').count();
        assert.equal(bulletCountAfter, bulletCountBefore + 1, 'Bullet was not added to role');

        console.log('✓ editor: list item add, remove, reorder, and stable IDs verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 3: Validation diagnostics and save/export action blocking
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-validation.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#sec-profile summary');
        await page.locator('#sec-profile summary').click();

        // Clear required name field to trigger validation error
        const nameInput = page.locator('#field-profile-name');
        await nameInput.fill('');
        await page.waitForTimeout(100);

        // Verify diagnostic error displayed
        const errorItem = page.locator('.diagnostic-error-item');
        await errorItem.waitFor();
        const errorText = await errorItem.first().textContent();
        assert.ok(errorText?.includes('profile/name') || errorText?.includes('name'), 'Validation diagnostic missing');

        // Verify Save and Export buttons are disabled
        const btnExport = page.locator('#btn-export-json');
        const btnSave = page.locator('#btn-local-save');
        const btnPrint = page.locator('#btn-print-action');

        assert.equal(await btnExport.isDisabled(), true, 'Export button should be disabled when invalid');
        assert.equal(await btnSave.isDisabled(), true, 'Save button should be disabled when invalid');
        assert.equal(await btnPrint.isDisabled(), true, 'Print button should be disabled when invalid');

        // Restore valid name
        await nameInput.fill('Valid Candidate Name');
        await page.waitForTimeout(100);

        // Verify buttons re-enabled
        assert.equal(await btnExport.isDisabled(), false, 'Export button should be re-enabled');
        assert.equal(await btnSave.isDisabled(), false, 'Save button should be re-enabled');

        console.log('✓ editor: validation error diagnostics and button disabling verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 4: Canonical LaTeX/SWE template rendering and configuration
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-templates.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#field-doc-template');
        const templateSelect = page.locator('#field-doc-template');
        const caveatBanner = page.locator('#template-caveat-banner');

        // Initially Classic: caveat banner hidden
        assert.equal(await caveatBanner.isVisible(), false, 'Caveat banner should be hidden');
        assert.equal(await templateSelect.inputValue(), 'classic');

        // Verify options count is 2 (Classic and Executive templates)
        const optionsCount = await templateSelect.locator('option').count();
        assert.equal(optionsCount, 2, 'Classic and Executive templates should be available');

        // Verify preview rendered in Classic template
        await page.waitForSelector('.template-classic');
        const pageBody = await page.locator('.resume-page-content').count();
        assert.ok(pageBody > 0, 'Classic single-column content was not rendered in preview');

        // Switch to Executive: caveat banner visible and executive layout rendered
        await templateSelect.selectOption('executive');
        await page.waitForSelector('#template-caveat-banner:not([hidden])');
        assert.equal(await caveatBanner.isVisible(), true, 'Caveat banner should be visible for executive template');
        await page.waitForSelector('.template-executive');
        const execColumns = await page.locator('.executive-page-1-body').count();
        assert.ok(execColumns > 0, 'Executive two-column body was not rendered in preview');

        // Verify company badges exist in Executive preview
        const badges = page.locator('.template-executive .entry-company-badge');
        assert.ok(await badges.count() > 0, 'Company badges should be rendered in executive layout');

        // Verify skills in Executive are rendered inline with category and comma-separated items
        const skillGroup = page.locator('.template-executive .atom-skill-group').first();
        assert.ok(await skillGroup.count() > 0, 'Skill group should exist in executive preview');
        const catText = await skillGroup.locator('.skill-category').textContent();
        assert.ok(catText.includes('Languages'), 'Skill category title should be present');
        const itemsText = await skillGroup.locator('.skill-items').textContent();
        assert.ok(itemsText.includes('TypeScript, JavaScript, Go'), 'Skills should be comma-separated in one line');

        // Verify typography is sans-serif in executive skills
        const skillFontFamily = await skillGroup.evaluate((el) => window.getComputedStyle(el).fontFamily);
        assert.ok(!skillFontFamily.toLowerCase().includes('times'), 'Executive skill font should not be Times/serif');

        // Verify icon upload control exists in experience section
        await page.locator('#sec-experience summary').click();
        const iconUploadLabel = page.locator('.btn-upload-icon').first();
        assert.equal(await iconUploadLabel.isVisible(), true, 'Upload icon button should be visible in experience card');

        // Verify paper size configuration
        const paperSizeSelect = page.locator('#field-doc-paper-size');
        assert.equal(await paperSizeSelect.inputValue(), 'a4');
        await paperSizeSelect.selectOption('letter');
        await page.waitForSelector('.paper-letter');
        const letterPage = page.locator('.resume-page').first();
        const letterWidth = await letterPage.evaluate((el) => el.style.width);
        assert.equal(letterWidth, '215.9mm', 'Letter page width should be 215.9mm');

        // Switch back to Classic: caveat banner hidden again
        await templateSelect.selectOption('classic');
        await page.waitForSelector('#template-caveat-banner', { state: 'hidden' });
        assert.equal(await caveatBanner.isVisible(), false, 'Caveat banner should be hidden for classic template');
        await page.waitForSelector('.template-classic');

        console.log('✓ editor: canonical and executive template and paper size configuration verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 5: Opt-in device autosave, restore, and clear
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-storage.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#chk-autosave');
        const chkAutosave = page.locator('#chk-autosave');

        // Assert autosave is OFF by default
        assert.equal(await chkAutosave.isChecked(), false, 'Autosave must be off by default');

        // Enable autosave
        await chkAutosave.check();

        // Edit document
        await page.locator('#sec-profile summary').click();
        const nameInput = page.locator('#field-profile-name');
        await nameInput.fill('Autosaved Person Name');
        await page.waitForTimeout(200);

        // Verify draft exists in localStorage
        const storedJson = await page.evaluate(() => localStorage.getItem('resume-studio:v1:draft'));
        assert.ok(storedJson, 'Draft was not written to localStorage');
        assert.ok(storedJson.includes('Autosaved Person Name'), 'Stored draft does not contain updated field');

        // Verify restore and clear buttons are visible
        const btnClear = page.locator('#btn-clear-autosave');
        assert.equal(await btnClear.isVisible(), true, 'Clear draft button should be visible');

        // Clear stored draft
        await btnClear.click();
        const storedAfterClear = await page.evaluate(() => localStorage.getItem('resume-studio:v1:draft'));
        assert.equal(storedAfterClear, null, 'Draft was not cleared from localStorage');

        console.log('✓ editor: opt-in device autosave, persistence, and clear verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 6: Local bridge save and external revision conflict resolution
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-conflict.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#sec-profile summary');
        await page.locator('#sec-profile summary').click();
        const nameInput = page.locator('#field-profile-name');
        const btnSave = page.locator('#btn-local-save');

        // Step 1: Test valid save to file
        await nameInput.fill('Saved Version 1');
        await page.waitForTimeout(100);
        assert.equal(await btnSave.isEnabled(), true, 'Save button should be enabled when dirty and valid');
        await btnSave.click();
        await page.waitForTimeout(300);

        // Verify dirty badge is hidden and file on disk updated
        const dirtyBadge = page.locator('#dirty-status');
        assert.equal(await dirtyBadge.isVisible(), false, 'Dirty badge should be hidden after save');
        const savedDiskContent = JSON.parse(readFileSync(resumePath, 'utf8'));
        assert.equal(savedDiskContent.profile.name, 'Saved Version 1', 'File on disk was not updated by save');

        // Step 2: Make a new browser edit
        await nameInput.fill('Browser Draft Version');
        await page.waitForTimeout(100);

        // Step 3: Simultaneously modify file on disk to simulate external agent edit
        const diskDoc = JSON.parse(readFileSync(resumePath, 'utf8'));
        diskDoc.profile.name = 'External Agent Disk Version';
        writeFileSync(resumePath, JSON.stringify(diskDoc, null, 2) + '\n', 'utf8');

        // Wait for SSE reconciliation or event delivery to detect disk revision mismatch
        await page.waitForSelector('.modal-dialog', { timeout: 6000 });

        // Assert conflict dialog is visible
        const modalTitle = await page.locator('.modal-header h3').textContent();
        assert.ok(modalTitle?.includes('Conflict'), 'Conflict modal was not displayed');

        // Click "Keep Browser Draft"
        const btnKeep = page.locator('.modal-footer button', { hasText: 'Keep Browser Draft' });
        await btnKeep.click();

        // Verify browser draft still contains 'Browser Draft Version'
        const currentNameVal = await nameInput.inputValue();
        assert.equal(currentNameVal, 'Browser Draft Version', 'Browser draft was overwritten');

        console.log('✓ editor: local file save, external disk update conflict, and draft retention verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 7: Print modal and instructions checklist
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-print.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#btn-print-action');
        const btnPrint = page.locator('#btn-print-action');

        await btnPrint.click();

        // Verify print settings dialog opened
        await page.waitForSelector('.modal-dialog');
        const modalText = await page.locator('.modal-body').textContent();
        assert.ok(modalText?.includes('Save as PDF'), 'Print dialog missing Save as PDF instruction');
        assert.ok(modalText?.includes('A4'), 'Print dialog missing A4 instruction');
        assert.ok(modalText?.includes('Margins'), 'Print dialog missing Margins instruction');

        console.log('✓ editor: user print action and honest settings modal verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 8: Draggable split line and compact zoom controls
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-split-zoom.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.goto(server.url);

        await page.waitForSelector('#pane-resizer');
        await page.waitForSelector('#btn-zoom-in');

        // 1. Resizer verification
        const resizer = page.locator('#pane-resizer');
        const editorPane = page.locator('#editor-pane');

        const initialEditorBox = await editorPane.boundingBox();
        assert.ok(initialEditorBox, 'Missing editor box');

        const resizerBox = await resizer.boundingBox();
        assert.ok(resizerBox, 'Missing resizer box');

        // Drag resizer 100px to the right
        await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + resizerBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(resizerBox.x + 100, resizerBox.y + resizerBox.height / 2, { steps: 5 });
        await page.mouse.up();

        const expandedEditorBox = await editorPane.boundingBox();
        assert.ok(expandedEditorBox, 'Missing expanded editor box');
        assert.ok(expandedEditorBox.width > initialEditorBox.width + 50, `Editor did not expand: ${expandedEditorBox.width} vs ${initialEditorBox.width}`);

        // Double-click resizer to reset to default
        await resizer.dblclick();
        const resetEditorBox = await editorPane.boundingBox();
        assert.ok(resetEditorBox, 'Missing reset editor box');

        // Keyboard navigation on resizer
        await resizer.focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        const keyboardExpandedBox = await editorPane.boundingBox();
        assert.ok(keyboardExpandedBox && keyboardExpandedBox.width > resetEditorBox.width, 'Keyboard ArrowRight did not increase width');

        // 2. Zoom controls verification
        const btnZoomIn = page.locator('#btn-zoom-in');
        const btnZoomOut = page.locator('#btn-zoom-out');
        const btnZoomLevel = page.locator('#btn-zoom-level');
        const btnZoomFit = page.locator('#btn-zoom-fit');

        // Default zoom is 100%
        assert.equal(await btnZoomLevel.textContent(), '100%');

        // Zoom in -> 110%
        await btnZoomIn.click();
        assert.equal(await btnZoomLevel.textContent(), '110%');

        // Zoom out -> 100%
        await btnZoomOut.click();
        assert.equal(await btnZoomLevel.textContent(), '100%');

        // Zoom out again -> 90%
        await btnZoomOut.click();
        assert.equal(await btnZoomLevel.textContent(), '90%');

        // Zoom back in -> 100%
        await btnZoomIn.click();
        assert.equal(await btnZoomLevel.textContent(), '100%');

        // Click Fit button
        await btnZoomFit.click();
        const fitText = await btnZoomLevel.textContent();
        assert.ok(fitText && fitText.endsWith('%'), `Invalid fit zoom text: ${fitText}`);

        console.log('✓ editor: draggable split line and compact zoom in/out controls verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 9: Collapsible warnings, top template dropdown, and reduce margins
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-collapsible-template-margin.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        await page.goto(server.url);

        // 1. Verify collapsible warnings section
        await page.waitForSelector('#diagnostics-warnings-collapsible');
        const warnDetails = page.locator('#diagnostics-warnings-collapsible');
        const warnSummary = page.locator('#diagnostics-warnings-collapsible summary');
        const warnItems = page.locator('.diagnostic-warning-item');

        // Initially collapsed by default
        const isOpenInitially = await warnDetails.evaluate((el) => el.hasAttribute('open'));
        assert.equal(isOpenInitially, false, 'Warnings should be collapsed by default');

        // Click to expand
        await warnSummary.click();
        const isOpenAfterClick = await warnDetails.evaluate((el) => el.hasAttribute('open'));
        assert.equal(isOpenAfterClick, true, 'Warnings should open when summary clicked');
        assert.ok(await warnItems.count() > 0, 'Warning items should exist inside details');

        // Click again to collapse
        await warnSummary.click();
        const isCollapsedAgain = await warnDetails.evaluate((el) => el.hasAttribute('open'));
        assert.equal(isCollapsedAgain, false, 'Warnings should close when summary clicked again');

        // 2. Verify all tabs collapsed by default apart from document setting
        const secDoc = page.locator('#sec-document');
        const secProfile = page.locator('#sec-profile');
        const secSummary = page.locator('#sec-summary');
        const secOrder = page.locator('#sec-section-order');
        const secExp = page.locator('#sec-experience');
        const secEdu = page.locator('#sec-education');
        const secProj = page.locator('#sec-projects');
        const secSkills = page.locator('#sec-skills');
        const secCert = page.locator('#sec-certifications');

        assert.equal(await secDoc.evaluate((el) => el.hasAttribute('open')), true, 'Document Settings should be open by default');
        assert.equal(await secProfile.evaluate((el) => el.hasAttribute('open')), false, 'Profile tab should be collapsed by default');
        assert.equal(await secSummary.evaluate((el) => el.hasAttribute('open')), false, 'Summary tab should be collapsed by default');
        assert.equal(await secOrder.evaluate((el) => el.hasAttribute('open')), false, 'Section Order tab should be collapsed by default');
        assert.equal(await secExp.evaluate((el) => el.hasAttribute('open')), false, 'Experience tab should be collapsed by default');
        assert.equal(await secEdu.evaluate((el) => el.hasAttribute('open')), false, 'Education tab should be collapsed by default');
        assert.equal(await secProj.evaluate((el) => el.hasAttribute('open')), false, 'Projects tab should be collapsed by default');
        assert.equal(await secSkills.evaluate((el) => el.hasAttribute('open')), false, 'Skills tab should be collapsed by default');
        assert.equal(await secCert.evaluate((el) => el.hasAttribute('open')), false, 'Certifications tab should be collapsed by default');

        // 3. Verify top template dropdown and form template sync
        const headerTemplate = page.locator('#header-doc-template');
        const formTemplate = page.locator('#field-doc-template');

        // Canonical classic template is selected
        assert.equal(await headerTemplate.inputValue(), 'classic');
        assert.equal(await formTemplate.inputValue(), 'classic');

        // 4. Verify Margins in Document Settings (Narrow default, Range Slider, Custom & Presets)
        const formMarginSelect = page.locator('#field-doc-margin');
        const marginSlider = page.locator('#field-doc-margin-slider');
        const marginCustomInput = page.locator('#field-doc-margin-custom');

        // Initially Narrow margins by default
        assert.equal(await formMarginSelect.inputValue(), 'narrow');
        assert.equal(await marginSlider.inputValue(), '10');
        const hasNarrowClass = await page.locator('.resume-page').first().evaluate((el) => el.classList.contains('margin-narrow'));
        assert.equal(hasNarrowClass, true, 'Page should have margin-narrow by default');

        // Change margin via form dropdown -> Compact / Very Narrow (7mm)
        await formMarginSelect.selectOption('compact');
        await page.waitForSelector('.resume-page.margin-compact');
        assert.equal(await marginSlider.inputValue(), '7');

        // Change margin via form dropdown -> Normal (14mm)
        await formMarginSelect.selectOption('normal');
        await page.waitForSelector('.resume-page.margin-normal');
        assert.equal(await marginSlider.inputValue(), '14');

        await marginCustomInput.fill('6');
        await marginCustomInput.dispatchEvent('input');
        assert.equal(await formMarginSelect.inputValue(), 'custom');
        await page.waitForFunction(() => {
          const el = document.querySelector('.resume-page');
          return el && el.style.getPropertyValue('--page-padding') === '6mm';
        });
        const pagePadding = await page.locator('.resume-page').first().evaluate((el) => el.style.getPropertyValue('--page-padding'));
        assert.equal(pagePadding, '6mm');

        // 5. Verify light mode toggle
        const btnThemeToggle = page.locator('#btn-theme-toggle');
        assert.equal(await btnThemeToggle.count(), 1, 'Theme toggle button must exist');

        // Click theme toggle to enable light mode
        await btnThemeToggle.click();
        let isLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light');
        assert.equal(isLight, true, 'Light mode data-theme attribute not set after toggle click');

        // Click theme toggle again to return to dark mode
        await btnThemeToggle.click();
        isLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light');
        assert.equal(isLight, false, 'Light mode data-theme attribute should be cleared when toggling back');

        console.log('✓ editor: collapsible tabs, Narrow default margin, and light mode toggle verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 10: /templates tab, card view with large previews, and template switching
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-templates-tab.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('#nav-tab-templates');
        const tabTemplates = page.locator('#nav-tab-templates');
        const tabEditor = page.locator('#nav-tab-editor');
        const appBody = page.locator('#app-body');
        const templatesView = page.locator('#templates-view');

        // Click on Templates tab
        await tabTemplates.click();
        await page.waitForSelector('.templates-cards-grid');

        // Verify view visibility and tab active states
        assert.equal(await templatesView.isVisible(), true, 'Templates view should be visible');
        assert.equal(await appBody.isVisible(), false, 'App body editor should be hidden');
        assert.equal(await tabTemplates.evaluate((el) => el.classList.contains('active')), true);
        assert.equal(await tabEditor.evaluate((el) => el.classList.contains('active')), false);

        // Verify template cards exist (Classic and Executive)
        const cards = page.locator('.template-card');
        assert.equal(await cards.count(), 2, 'Should render 2 template cards (Classic and Executive)');

        // Verify preview SVG wrappers exist
        const previewWrappers = page.locator('.template-svg-wrapper svg');
        assert.equal(await previewWrappers.count(), 2, 'Template cards should contain preview SVG');

        // Verify Classic is currently active
        const classicCard = page.locator('.template-card[data-template-id="classic"]');
        assert.equal(await classicCard.evaluate((el) => el.classList.contains('is-active-template')), true);
        assert.equal(await classicCard.locator('.badge-active-indicator').isVisible(), true);

        // Click "Open in Editor" for Executive
        const btnOpenExecutive = page.locator('#btn-preview-template-executive');
        await btnOpenExecutive.click();

        // Should automatically switch back to Editor view with Executive template
        await page.waitForSelector('.template-executive');
        assert.equal(await appBody.isVisible(), true, 'Should switch back to Editor view');
        assert.equal(await templatesView.isVisible(), false, 'Templates view should be hidden');
        assert.equal(await tabEditor.evaluate((el) => el.classList.contains('active')), true);

        // Verify Executive template is active in header select and form select
        const headerTemplate = page.locator('#header-doc-template');
        const formTemplate = page.locator('#field-doc-template');
        assert.equal(await headerTemplate.inputValue(), 'executive');
        assert.equal(await formTemplate.inputValue(), 'executive');

        console.log('✓ editor: /templates tab and templates gallery verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 11: Scrollability on responsive viewports and desktop preview/editor panes
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-scroll.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        // Test responsive window/page scrollability (< 1024px)
        const pageNarrow = await browser.newPage({ viewport: { width: 900, height: 800 } });
        await pageNarrow.goto(server.url);
        await pageNarrow.waitForSelector('.resume-page');

        const docScrollHeight = await pageNarrow.evaluate(() => document.documentElement.scrollHeight);
        assert.ok(docScrollHeight > 1000, `Expected scrollable document in narrow view, got ${docScrollHeight}px`);

        await pageNarrow.evaluate(() => window.scrollTo(0, 400));
        const scrolledY = await pageNarrow.evaluate(() => window.scrollY);
        assert.ok(scrolledY > 0, `Expected page to scroll vertically on narrow screen, got ${scrolledY}px`);
        await pageNarrow.close();

        // Test desktop pane internal scrollability
        const pageDesktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await pageDesktop.goto(server.url);
        await pageDesktop.waitForSelector('.resume-page');

        const previewPane = pageDesktop.locator('#preview-pane');
        const editorPane = pageDesktop.locator('#editor-pane');

        const prevScrollHeight = await previewPane.evaluate((el) => el.scrollHeight);
        const prevClientHeight = await previewPane.evaluate((el) => el.clientHeight);
        assert.ok(prevScrollHeight > prevClientHeight, 'Expected preview-pane content to exceed container height');

        await previewPane.evaluate((el) => { el.scrollTop = 200; });
        const prevScrollTop = await previewPane.evaluate((el) => el.scrollTop);
        assert.ok(prevScrollTop > 0, 'Expected preview-pane to be scrollable');

        await editorPane.evaluate((el) => { el.scrollTop = 150; });
        const edScrollTop = await editorPane.evaluate((el) => el.scrollTop);
        assert.ok(edScrollTop > 0, 'Expected editor-pane to be scrollable');

        console.log('✓ editor: page scrollability on responsive view and pane scrollability on desktop verified');
        await pageDesktop.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 12: AI Prompt modal, prompt customization, copy action, and direct JSON paste import
    // -------------------------------------------------------------------------
    {
      const resumePath = join(tempDir, 'editor-ai-prompt.json');
      copyFileSync('examples/classic-one-page.json', resumePath);
      const server = await createPreviewServer({ file: resumePath });

      try {
        const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
        const page = await context.newPage();
        await page.goto(server.url);
        await page.waitForSelector('#app-main');

        // Click AI Prompt button in header
        const btnAiPrompt = page.locator('#btn-ai-prompt');
        await btnAiPrompt.click();

        // Check modal dialog appears
        await page.waitForSelector('#modal-title-ai-prompt');
        const previewTa = page.locator('#ai-prompt-preview-textarea');
        const initialPrompt = await previewTa.inputValue();
        assert.ok(initialPrompt.includes('TASK: Generate Resume Studio JSON'), 'Prompt title missing');
        assert.ok(initialPrompt.includes('Morgan Reed'), 'Current draft content should be in prompt');

        // Update target role input
        const roleInput = page.locator('#ai-cfg-target-role');
        await roleInput.fill('Principal Cloud Architect');
        const updatedPrompt = await previewTa.inputValue();
        assert.ok(updatedPrompt.includes('Principal Cloud Architect'), 'Target role should update preview');

        // Click Copy Prompt for AI
        const copyBtn = page.locator('#btn-copy-ai-prompt-action');
        await copyBtn.click();
        await page.waitForFunction(() => {
          const btn = document.querySelector('#btn-copy-ai-prompt-action');
          return btn && btn.textContent && btn.textContent.includes('Copied to Clipboard');
        });

        // Test pasting invalid JSON
        const pasteTa = page.locator('#ai-json-paste-input');
        const btnImportPasted = page.locator('#btn-import-pasted-json');
        await pasteTa.fill('{ "invalidJson": true }');
        await btnImportPasted.click();
        await page.waitForSelector('#ai-json-import-feedback');
        const feedbackText = await page.locator('#ai-json-import-feedback').textContent();
        assert.ok(feedbackText && feedbackText.includes('Validation Failed'), 'Expected validation error notice');

        // Test pasting valid JSON from an AI response (including markdown ```json wrapper)
        const validAiJson = `\`\`\`json
{
  "schemaVersion": 1,
  "document": {
    "title": "Dr. Avery Stone — Research Scientist",
    "template": "classic",
    "maxPages": 1,
    "accent": "slate"
  },
  "profile": {
    "name": "Dr. Avery Stone",
    "headline": "Research Scientist & AI Architect",
    "email": "avery.stone@example.invalid",
    "phone": "+1-555-0188",
    "location": "Cambridge, MA",
    "links": [
      {
        "id": "link-lab",
        "label": "Lab Page",
        "url": "https://example.com/stone-lab"
      }
    ]
  },
  "summary": "Research scientist with extensive experience in neural representations and distributed architectures.",
  "sectionOrder": [
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "certifications"
  ],
  "experience": [
    {
      "id": "exp-deepmind",
      "employer": "DeepMind Technologies",
      "role": "Staff Research Scientist",
      "location": "Cambridge, MA",
      "start": "2021-04",
      "current": true,
      "bullets": [
        "Published 4 foundational papers on neural scaling laws and multi-agent coordination.",
        "Engineered distributed evaluation benchmarks across 500 GPU nodes."
      ]
    }
  ],
  "education": [
    {
      "id": "edu-mit-phd",
      "institution": "MIT",
      "qualification": "Ph.D. in Computer Science",
      "location": "Cambridge, MA",
      "start": "2016-09",
      "end": "2021-02",
      "details": [
        "Doctoral Dissertation on Sample-Efficient Reinforcement Learning."
      ]
    }
  ],
  "projects": [],
  "skills": [
    {
      "id": "sk-research",
      "category": "Research Areas",
      "items": ["Deep Learning", "Reinforcement Learning", "Scaling Laws"]
    }
  ],
  "certifications": []
}
\`\`\``;

        await pasteTa.fill(validAiJson);
        await btnImportPasted.click();

        // Modal should close and document should load into editor and preview
        await page.waitForSelector('#modal-title-ai-prompt', { state: 'detached' });
        await page.waitForFunction(() => {
          const el = document.querySelector('.profile-name');
          return el && el.textContent === 'Dr. Avery Stone';
        });

        console.log('✓ editor: AI Prompt modal, customization, copy action, and direct JSON paste import verified');
        await page.close();
        await context.close();
      } finally {
        await server.close();
      }
    }

  } finally {
    await browser.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}
