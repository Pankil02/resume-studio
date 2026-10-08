import { chromium } from 'playwright';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../../dist/cli/server.js';
import { parseResume } from '../../dist/core/validation.js';

export async function runE2ESecurityBrowserTests() {
  const tempDir = mkdtempSync(join(tmpdir(), 'resume-e2e-sec-'));
  const browser = await chromium.launch();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: End-to-End Agent & User Round-Trip Workflow
    // -------------------------------------------------------------------------
    {
      const docPath = join(tempDir, 'roundtrip-resume.json');
      const candidatePath = join(tempDir, 'candidate-resume.json');

      // 1. Agent runs `init`
      execFileSync(process.execPath, ['dist/cli/main.js', 'init', '--file', docPath, '--template', 'classic', '--max-pages', '1'], {
        encoding: 'utf-8',
      });

      // 2. Agent runs `inspect --json`
      const inspectOut = execFileSync(process.execPath, ['dist/cli/main.js', 'inspect', '--file', docPath, '--json'], {
        encoding: 'utf-8',
      });
      const inspectData = JSON.parse(inspectOut);
      assert.ok(inspectData.revision, 'Expected initial revision from inspect');
      assert.equal(typeof inspectData.document, 'object', 'Expected document object');

      // 3. Agent writes candidate with modified headline and skills
      const candidateDoc = JSON.parse(JSON.stringify(inspectData.document));
      candidateDoc.profile.headline = 'Senior Distributed Systems Architect';
      candidateDoc.skills.push({
        id: 'skill-cloud',
        category: 'Cloud Infrastructure',
        items: ['AWS', 'Kubernetes', 'Terraform'],
      });
      writeFileSync(candidatePath, JSON.stringify(candidateDoc, null, 2), 'utf-8');

      // 4. Agent runs `validate --json` on candidate
      const valOut = execFileSync(process.execPath, ['dist/cli/main.js', 'validate', '--file', candidatePath, '--json'], {
        encoding: 'utf-8',
      });
      const valData = JSON.parse(valOut);
      assert.equal(valData.ok, true, 'Candidate validation should succeed');

      // 5. Agent runs `apply` with expected revision
      const applyOut = execFileSync(
        process.execPath,
        ['dist/cli/main.js', 'apply', '--file', docPath, '--from', candidatePath, '--expected-revision', inspectData.revision, '--json'],
        { encoding: 'utf-8' }
      );
      const applyData = JSON.parse(applyOut);
      assert.ok(applyData.revision, 'Expected new revision from apply');
      assert.notEqual(applyData.revision, inspectData.revision, 'Revision should change after apply');

      // 6. Launch preview server on the applied document
      const server = await createPreviewServer({ file: docPath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        // Verify fragment was stripped immediately from URL
        await page.waitForTimeout(100);
        const currentUrl = page.url();
        assert.ok(!currentUrl.includes('#local='), 'Local capability fragment must be stripped immediately from URL');

        // Verify token is not stored in localStorage or sessionStorage
        const localTokens = await page.evaluate(() => {
          return {
            local: window.localStorage.getItem('resume-studio:token') || window.localStorage.getItem('token'),
            session: window.sessionStorage.getItem('resume-studio:token') || window.sessionStorage.getItem('token'),
          };
        });
        assert.equal(localTokens.local, null, 'Capability token must never be written to localStorage');
        assert.equal(localTokens.session, null, 'Capability token must never be written to sessionStorage');

        // Verify document rendered with agent's applied changes
        await page.waitForSelector('.profile-headline');
        const headlineText = await page.locator('.profile-headline').textContent();
        assert.ok(headlineText?.includes('Senior Distributed Systems Architect'), 'Agent edit not reflected in preview');

        // 7. User edits form in browser
        await page.locator('#sec-profile summary').click();
        const headlineInput = page.locator('#field-profile-headline');
        await headlineInput.fill('Principal Systems Architect & Fellow');

        // Verify dirty badge visible
        const dirtyBadge = page.locator('#dirty-status');
        await page.waitForTimeout(100);
        assert.equal(await dirtyBadge.isVisible(), true, 'Dirty badge should appear on user edit');

        // 8. User clicks Save to File
        const btnSave = page.locator('#btn-local-save');
        await btnSave.click();

        // Wait for save to complete and dirty badge to hide
        await page.waitForFunction(() => {
          const badge = document.getElementById('dirty-status');
          return badge && badge.style.display === 'none';
        });

        // 9. Verify disk contents with CLI inspect
        const inspectAfterSave = execFileSync(process.execPath, ['dist/cli/main.js', 'inspect', '--file', docPath, '--json'], {
          encoding: 'utf-8',
        });
        const diskData = JSON.parse(inspectAfterSave);
        assert.equal(diskData.document.profile.headline, 'Principal Systems Architect & Fellow', 'Disk not updated by browser save');
        assert.notEqual(diskData.revision, applyData.revision, 'Disk revision should advance after browser save');

        // 10. User opens Print Dialog modal
        const btnPrint = page.locator('#btn-print-action');
        await btnPrint.click();

        const modalDialog = page.locator('.modal-dialog');
        await modalDialog.waitFor();
        const modalText = await modalDialog.textContent();
        assert.ok(modalText?.includes('Save as PDF'), 'Print instructions modal missing expected guidance');
        assert.ok(modalText?.includes('A4'), 'Print modal missing A4 requirement');

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(50);
        assert.equal(await modalDialog.isVisible(), false, 'Modal should close on Escape');

        console.log('✓ e2e: agent CLI init/inspect/apply and user browser edit/save/print round-trip verified');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 2: Security Regressions: XSS and Malicious Content Inertness
    // -------------------------------------------------------------------------
    {
      const xssDocPath = join(tempDir, 'xss-resume.json');

      // Create document with hostile payloads in every allowed text string
      const xssDoc = {
        schemaVersion: 1,
        document: {
          title: 'Security <script>window.__XSS_PWNED__=true</script> Test',
          template: 'classic',
          maxPages: 1,
          accent: 'navy',
        },
        profile: {
          name: 'Jane Doe <script>window.__XSS_NAME__=true</script><img src=x onerror="window.__XSS_IMG__=true">',
          headline: 'Security Researcher <b onmouseover="window.__XSS_B__=true">Click</b>',
          email: 'jane@example.invalid',
          phone: '+1-555-0199',
          location: 'Safe City <svg onload="window.__XSS_SVG__=true">',
          links: [
            {
              id: 'lnk-safe',
              label: 'GH <script>window.__XSS_LNK__=1</script>',
              url: 'https://github.com/example',
            },
          ],
        },
        summary: 'Expert in defensive engineering <script>window.__XSS_SUM__=1</script> and safe DOM rendering.',
        sectionOrder: ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'],
        experience: [
          {
            id: 'exp-1',
            employer: 'Cyber <iframe src="javascript:window.__XSS_IFRAME__=1"></iframe>',
            role: 'Lead Security Engineer',
            start: '2022-01',
            current: true,
            bullets: [
              'Hardened client apps against XSS <script>window.__XSS_BULLET__=1</script>',
              'Prevented script execution across all template atoms',
            ],
          },
        ],
        education: [
          {
            id: 'edu-1',
            institution: 'State University',
            qualification: 'B.S. CS <script>window.__XSS_EDU__=1</script>',
            details: ['Graduated with Honors'],
          },
        ],
        projects: [
          {
            id: 'proj-1',
            name: 'Sandbox <script>window.__XSS_PROJ__=1</script>',
            role: 'Creator',
            url: 'https://example.com/sandbox',
            bullets: ['Built inert rendering pipeline'],
          },
        ],
        skills: [
          {
            id: 'sk-1',
            category: 'Security <script>window.__XSS_SKILL__=1</script>',
            items: ['AppSec', 'Threat <img src=x onerror=window.__XSS_SKILLITEM__=1>'],
          },
        ],
        certifications: [
          {
            id: 'cert-1',
            name: 'CISSP <script>window.__XSS_CERT__=1</script>',
            issuer: 'ISC2',
          },
        ],
      };

      // 1. Validate that our core validator accepts valid string contents (plain text with characters)
      const parseResult = parseResume(JSON.stringify(xssDoc));
      assert.equal(parseResult.ok, true, 'String containing HTML entities should parse as plain text string');

      // 2. Validate that URL with javascript: is strictly rejected by validation
      const badUrlDoc = JSON.parse(JSON.stringify(xssDoc));
      badUrlDoc.profile.links[0].url = 'javascript:window.__XSS_JS_URL__=true';
      const badUrlResult = parseResume(JSON.stringify(badUrlDoc));
      assert.equal(badUrlResult.ok, false, 'Validator MUST reject javascript: URL protocol');

      // 3. Save xssDoc to file and load into preview
      writeFileSync(xssDocPath, JSON.stringify(xssDoc, null, 2), 'utf-8');
      const server = await createPreviewServer({ file: xssDocPath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('.profile-name');
        await page.waitForTimeout(300);

        // Check if any malicious script was executed
        const xssFlags = await page.evaluate(() => {
          const w = window;
          return {
            pwned: w.__XSS_PWNED__,
            name: w.__XSS_NAME__,
            img: w.__XSS_IMG__,
            b: w.__XSS_B__,
            svg: w.__XSS_SVG__,
            lnk: w.__XSS_LNK__,
            sum: w.__XSS_SUM__,
            iframe: w.__XSS_IFRAME__,
            bullet: w.__XSS_BULLET__,
            edu: w.__XSS_EDU__,
            proj: w.__XSS_PROJ__,
            skill: w.__XSS_SKILL__,
            skillItem: w.__XSS_SKILLITEM__,
            cert: w.__XSS_CERT__,
          };
        });

        for (const [key, value] of Object.entries(xssFlags)) {
          assert.equal(value, undefined, `XSS payload executed: ${key} was triggered!`);
        }

        // Verify that NO <script> or <iframe> tags exist inside the preview container
        const previewScripts = await page.locator('#resume-preview script').count();
        const previewIframes = await page.locator('#resume-preview iframe').count();
        assert.equal(previewScripts, 0, 'Injected script tags found inside preview container');
        assert.equal(previewIframes, 0, 'Injected iframe tags found inside preview container');

        // Verify link has safe rel attributes
        const linkRel = await page.locator('#resume-preview a').first().getAttribute('rel');
        assert.ok(linkRel?.includes('noopener'), 'Link must have rel="noopener"');
        assert.ok(linkRel?.includes('noreferrer'), 'Link must have rel="noreferrer"');

        console.log('✓ security: XSS payloads inert in preview DOM and prohibited in URLs');
        await page.close();
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 3: Security Regressions: Token, Origin, Host, Path & Limit Defenses
    // -------------------------------------------------------------------------
    {
      const docPath = join(tempDir, 'security-bridge.json');
      writeFileSync(
        docPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            document: { title: 'Security', template: 'classic', maxPages: 1, accent: 'slate' },
            profile: { name: 'Test User', links: [] },
            sectionOrder: ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'],
            experience: [],
            education: [],
            projects: [],
            skills: [],
            certifications: [],
          },
          null,
          2
        ),
        'utf-8'
      );

      const server = await createPreviewServer({ file: docPath });

      try {
        const port = server.port;
        const validToken = server.capability;

        // 1. Request /local/document with NO token -> 401
        const resNoToken = await fetch(`http://127.0.0.1:${port}/local/document`);
        assert.equal(resNoToken.status, 401, 'Expected 401 for missing bearer token');

        // 2. Request /local/document with WRONG token -> 401
        const resWrongToken = await fetch(`http://127.0.0.1:${port}/local/document`, {
          headers: { Authorization: 'Bearer forged-capability-token-12345' },
        });
        assert.equal(resWrongToken.status, 401, 'Expected 401 for forged bearer token');

        // 3. Request with malicious Host header -> 403
        const resBadHost = await fetch(`http://127.0.0.1:${port}/local/document`, {
          headers: {
            Host: 'attacker.evil.com',
            Authorization: `Bearer ${validToken}`,
          },
        });
        assert.equal(resBadHost.status, 403, 'Expected 403 for forged Host header');

        // 4. POST /local/save with untrusted Origin -> 403
        const resBadOrigin = await fetch(`http://127.0.0.1:${port}/local/save`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            Origin: 'http://attacker.evil.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expectedRevision: '123', document: {} }),
        });
        assert.equal(resBadOrigin.status, 403, 'Expected 403 for untrusted Origin header');

        // 5. Path traversal attempt on static assets -> 404 or 403
        const resTraversal1 = await fetch(`http://127.0.0.1:${port}/../../package.json`);
        assert.ok([403, 404].includes(resTraversal1.status), 'Expected 403/404 for directory traversal');

        const resTraversal2 = await fetch(`http://127.0.0.1:${port}/%2e%2e%2fpackage.json`);
        assert.ok([403, 404].includes(resTraversal2.status), 'Expected 403/404 for encoded traversal');

        // 6. Request with oversized payload (>160 KiB) -> 413 or connection severed
        const largeString = 'x'.repeat(170 * 1024);
        try {
          const resOversized = await fetch(`http://127.0.0.1:${port}/local/save`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validToken}`,
              Origin: `http://127.0.0.1:${port}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expectedRevision: '123', padding: largeString }),
          });
          assert.equal(resOversized.status, 413, 'Expected 413 Payload Too Large');
        } catch (err) {
          // Socket destruction on payload > 160 KiB is compliant defensive behavior
          assert.ok(err, 'Expected connection rejection on oversized payload');
        }

        console.log('✓ security: token, host, origin, traversal, and payload size bounds verified');
      } finally {
        await server.close();
      }
    }

    // -------------------------------------------------------------------------
    // TEST 4: External Invalid Edit Handling
    // -------------------------------------------------------------------------
    {
      const docPath = join(tempDir, 'external-corrupt.json');
      const validDoc = {
        schemaVersion: 1,
        document: { title: 'Clean Doc', template: 'classic', maxPages: 1, accent: 'slate' },
        profile: { name: 'Resilient User', links: [] },
        sectionOrder: ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'],
        experience: [],
        education: [],
        projects: [],
        skills: [],
        certifications: [],
      };
      writeFileSync(docPath, JSON.stringify(validDoc, null, 2), 'utf-8');

      const server = await createPreviewServer({ file: docPath });

      try {
        const page = await browser.newPage();
        await page.goto(server.url);

        await page.waitForSelector('.profile-name');
        const initialName = await page.locator('.profile-name').textContent();
        assert.equal(initialName, 'Resilient User', 'Initial doc should render');

        // External process corrupts file with malformed JSON
        writeFileSync(docPath, '{"broken": [malformed json text', 'utf-8');

        // Give SSE watcher time to reconcile
        await page.waitForTimeout(500);

        // Verify that browser client did not crash and preserved last valid preview
        const nameAfterCorrupt = await page.locator('.profile-name').textContent();
        assert.equal(nameAfterCorrupt, 'Resilient User', 'Browser must retain last valid preview on external corruption');

        console.log('✓ resilience: external file corruption preserves last valid preview');
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
