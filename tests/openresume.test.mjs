import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

import { validateResumeJson } from '../skills/openresume/validate.mjs';
import {
  renderResumeHtml,
  renderFile,
} from '../skills/openresume/render.mjs';
import {
  installSkills,
  manageProfile,
  initResume,
  startPreviewServer,
  isMainModule,
  promptInteractiveSetup,
} from '../bin/openresume.mjs';

test('validateResumeJson: accepts valid starter document', () => {
  const starter = readFileSync('skills/openresume/starter.json', 'utf8');
  const res = validateResumeJson(starter);
  assert.equal(res.ok, true);
  assert.equal(res.issues.length, 0);
  assert.equal(res.value.document.title, 'Alex Morgan — Software Engineer');

  // Verify times font passes validation
  const docTimes = JSON.parse(starter);
  docTimes.document.font = 'times';
  const timesRes = validateResumeJson(JSON.stringify(docTimes));
  assert.equal(timesRes.ok, true);
  assert.equal(timesRes.issues.length, 0);
});

test('validateResumeJson: rejects invalid JSON syntax, >128 KiB, duplicate IDs, and inverted dates', () => {
  const starter = readFileSync('skills/openresume/starter.json', 'utf8');

  // Syntax
  const syntaxRes = validateResumeJson('{ broken json');
  assert.equal(syntaxRes.ok, false);
  assert.equal(syntaxRes.issues[0].path, '/');

  // >128 KiB
  const huge = ' '.repeat(131073);
  const hugeRes = validateResumeJson(huge);
  assert.equal(hugeRes.ok, false);
  assert.ok(hugeRes.issues[0].message.includes('128 KiB limit'));

  // Duplicate IDs
  const docDup = JSON.parse(starter);
  docDup.education.push({ ...docDup.education[0] });
  const dupRes = validateResumeJson(JSON.stringify(docDup));
  assert.equal(dupRes.ok, false);
  assert.ok(dupRes.issues.some((i) => i.message.includes('Duplicate item ID')));

  // Inverted dates
  const docInv = JSON.parse(starter);
  docInv.experience[1].start = '2022-01';
  docInv.experience[1].end = '2020-01';
  const invRes = validateResumeJson(JSON.stringify(docInv));
  assert.equal(invRes.ok, false);
  assert.ok(invRes.issues.some((i) => i.path === '/experience/1/end'));

  // Bad date format
  const docBadDate = JSON.parse(starter);
  docBadDate.experience[1].start = 'January 2020';
  const badDateRes = validateResumeJson(JSON.stringify(docBadDate));
  assert.equal(badDateRes.ok, false);
  assert.ok(badDateRes.issues.some((i) => i.path === '/experience/1/start'));

  // Unsafe URL
  const docBadUrl = JSON.parse(starter);
  docBadUrl.profile.links[0].url = 'javascript:alert(1)';
  const badUrlRes = validateResumeJson(JSON.stringify(docBadUrl));
  assert.equal(badUrlRes.ok, false);
  assert.ok(badUrlRes.issues.some((i) => i.path.includes('/url')));

  // Invalid margin
  const docBadMargin = JSON.parse(starter);
  docBadMargin.document.margin = 'ultra-wide';
  const badMarginRes = validateResumeJson(JSON.stringify(docBadMargin));
  assert.equal(badMarginRes.ok, false);
  assert.ok(badMarginRes.issues.some((i) => i.path === '/document/margin'));

  // Invalid profile.links non-array
  const docBadLinks = JSON.parse(starter);
  docBadLinks.profile.links = 'links-as-string';
  const badLinksRes = validateResumeJson(JSON.stringify(docBadLinks));
  assert.equal(badLinksRes.ok, false);
  assert.ok(badLinksRes.issues.some((i) => i.path === '/profile/links'));

  // Invalid font
  const docBadFont = JSON.parse(starter);
  docBadFont.document.font = 'comic-sans';
  const badFontRes = validateResumeJson(JSON.stringify(docBadFont));
  assert.equal(badFontRes.ok, false);
  assert.ok(badFontRes.issues.some((i) => i.path === '/document/font'));

  // Invalid textSize
  const docBadSize = JSON.parse(starter);
  docBadSize.document.textSize = '16';
  const badSizeRes = validateResumeJson(JSON.stringify(docBadSize));
  assert.equal(badSizeRes.ok, false);
  assert.ok(badSizeRes.issues.some((i) => i.path === '/document/textSize'));
});

test('renderResumeHtml: produces dual template views and interactive toolbar', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  const html = renderResumeHtml(starter);

  // Dual views
  assert.ok(html.includes('data-template-view="classic"'));
  assert.ok(html.includes('data-template-view="executive"'));

  // Toolbar
  assert.ok(html.includes('preview-toolbar'));
  assert.ok(html.includes('data-set-template="classic"'));
  assert.ok(html.includes('data-set-template="executive"'));
  assert.ok(html.includes('id="select-font"'));
  assert.ok(html.includes('id="select-sheet"'));
  assert.ok(html.includes('id="select-size"'));
  assert.ok(html.includes('value="system"'));
  assert.ok(html.includes('value="serif"'));
  assert.ok(html.includes('value="times"'));
  assert.ok(!html.includes('value="jakarta"'));
  assert.ok(!html.includes('value="inter"'));
  assert.ok(html.includes('value="10"'));
  assert.ok(html.includes('value="11"'));
  assert.ok(html.includes('value="12"'));
  assert.ok(html.includes('id="select-accent"'));
  assert.ok(html.includes('id="select-margin"'));
  assert.ok(html.includes('id="btn-download-json"'));
  assert.ok(html.includes('id="btn-print-pdf"'));
});

test('renderResumeHtml: renders times font and custom size correctly', () => {
  const doc = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  doc.document.font = 'times';
  doc.document.textSize = '12';
  const html = renderResumeHtml(doc);

  assert.ok(html.includes('data-active-font="times"'));
  assert.ok(html.includes('data-active-size="12"'));
  assert.ok(html.includes('class="margin-narrow font-times size-12"'));
  assert.ok(html.includes('--font-times: \'Times New Roman\', Times, \'Liberation Serif\', serif;'));
  assert.ok(html.includes('--font-current: var(--font-times);'));
  assert.ok(html.includes('body[data-active-font="times"], .font-times'));
  assert.ok(html.includes('<option value="times" selected>Times New Roman</option>'));
  assert.ok(html.includes('<option value="12" selected>12pt (Large)</option>'));
  assert.ok(html.includes('.template-classic {\n  font-family: var(--font-current);'));
  assert.ok(html.includes('.template-executive {\n  font-family: var(--font-current);'));
});

test('renderResumeHtml: sanitizes XSS and renders bold tags correctly', () => {
  const xssDoc = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  xssDoc.profile.name = 'Test <script>alert(1)</script>';
  xssDoc.profile.links[0].url = 'javascript:evil()';
  xssDoc.experience[0].bullets[0] = '**Architected** telemetry with <b>high speed</b>, *low latency*, <small>compact footprint</small>, and <span class="text-lg">high scale</span>.';

  const html = renderResumeHtml(xssDoc);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('href="javascript:evil()"'));
  assert.ok(html.includes('<strong>Architected</strong>'));
  assert.ok(html.includes('<strong>high speed</strong>'));
  assert.ok(html.includes('<em>low latency</em>'));
  assert.ok(html.includes('<small>compact footprint</small>'));
  assert.ok(html.includes('<span class="text-lg">high scale</span>'));
});

test('renderResumeHtml: renders 2-page split properly for classic and executive', () => {
  const twoPageDoc = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  twoPageDoc.document.maxPages = 2;
  twoPageDoc.experience = [
    { id: 'exp-1', employer: 'E1', role: 'R1', start: '2020-01', end: '2021-01', bullets: ['b1'] },
    { id: 'exp-2', employer: 'E2', role: 'R2', start: '2019-01', end: '2020-01', bullets: ['b2'] },
    { id: 'exp-3', employer: 'E3', role: 'R3', start: '2018-01', end: '2019-01', bullets: ['b3'] },
    { id: 'exp-4', employer: 'E4', role: 'R4', start: '2017-01', end: '2018-01', bullets: ['b4'] },
  ];
  twoPageDoc.projects = [
    { id: 'proj-1', name: 'OpenProject One', bullets: ['Engineered pipeline'] },
  ];

  const html = renderResumeHtml(twoPageDoc);
  assert.ok(html.includes('data-page="2"'));
  assert.ok(html.includes('executive-page-continued-body'));
  assert.ok(html.includes('executive-continued-content'));
  assert.ok(html.includes('E4'));
  assert.ok(html.includes('OpenProject One'));
});

test('renderFile: compiles JSON to HTML file and validates on error', () => {
  const outPath = join(tmpdir(), `test-render-${Date.now()}.html`);
  const res = renderFile('skills/openresume/starter.json', outPath);

  assert.ok(existsSync(outPath));
  assert.equal(res.outputPath, resolve(outPath));

  assert.throws(() => {
    renderFile('package.json', outPath);
  });

  rmSync(outPath, { force: true });
});

test('installSkills: installs all 5 files to temporary directories and cleans up legacy resume-studio', () => {
  const testRoot = join(tmpdir(), `openresume-install-test-${Date.now()}`);
  mkdirSync(testRoot, { recursive: true });
  const originalHome = process.env.OPENRESUME_HOME;
  process.env.OPENRESUME_HOME = join(testRoot, '.openresume');

  try {
    // 1. Workspace test
    const legacyWorkspace = join(testRoot, '.agents', 'skills', 'resume-studio');
    mkdirSync(legacyWorkspace, { recursive: true });
    assert.ok(existsSync(legacyWorkspace));

    const localInstalled = installSkills({ local: true, cwd: testRoot });
    assert.equal(existsSync(legacyWorkspace), false, 'Legacy resume-studio must be removed');
    assert.ok(existsSync(join(testRoot, '.agents', 'skills', 'openresume', 'SKILL.md')));
    assert.ok(existsSync(join(testRoot, '.agents', 'skills', 'openresume', 'schema.json')));
    assert.ok(existsSync(join(testRoot, '.agents', 'skills', 'openresume', 'starter.json')));
    assert.ok(existsSync(join(testRoot, '.agents', 'skills', 'openresume', 'validate.mjs')));
    assert.ok(existsSync(join(testRoot, '.agents', 'skills', 'openresume', 'render.mjs')));

    // 2. Global test
    const legacyGlobal = join(testRoot, '.pi', 'skills', 'resume-studio');
    mkdirSync(legacyGlobal, { recursive: true });
    assert.ok(existsSync(legacyGlobal));

    const globalInstalled = installSkills({ local: false, cwd: testRoot });
    assert.equal(existsSync(legacyGlobal), false, 'Legacy global resume-studio must be removed');
    assert.ok(existsSync(join(testRoot, '.pi', 'skills', 'openresume', 'SKILL.md')));
    assert.ok(existsSync(join(testRoot, '.gemini', 'config', 'skills', 'openresume', 'SKILL.md')));
    assert.ok(existsSync(process.env.OPENRESUME_HOME));

    // 3. Default (no local flag passed) must default to local workspace folder only
    const defaultTestRoot = join(tmpdir(), `openresume-default-test-${Date.now()}`);
    mkdirSync(defaultTestRoot, { recursive: true });
    try {
      const defaultInstalled = installSkills({ cwd: defaultTestRoot });
      assert.ok(existsSync(join(defaultTestRoot, '.agents', 'skills', 'openresume', 'SKILL.md')));
      assert.ok(existsSync(join(defaultTestRoot, '.pi', 'skills', 'openresume', 'SKILL.md')));
      // Global folder inside testRoot should NOT exist
      assert.equal(existsSync(join(defaultTestRoot, '.gemini', 'config', 'skills', 'openresume')), false);
    } finally {
      rmSync(defaultTestRoot, { recursive: true, force: true });
    }
  } finally {
    process.env.OPENRESUME_HOME = originalHome;
    rmSync(testRoot, { recursive: true, force: true });
  }
});

test('isMainModule: matches direct path and realpath symlinks', () => {
  const cliPath = resolve('bin/openresume.mjs');
  assert.equal(isMainModule(`file://${cliPath}`, cliPath), true);
  assert.equal(isMainModule(`file://${cliPath}`, 'nonexistent/path/foo.mjs'), false);
  assert.equal(isMainModule(`file://${cliPath}`, undefined), false);
});

test('promptInteractiveSetup: installs to local workspace in non-interactive environment and writes README.md', async () => {
  const testRoot = join(tmpdir(), `openresume-prompt-test-${Date.now()}`);
  mkdirSync(testRoot, { recursive: true });
  const origCwd = process.cwd();
  process.chdir(testRoot);
  try {
    const res = await promptInteractiveSetup(['--yes']);
    assert.equal(res.local, true);
    assert.ok(existsSync(join(testRoot, '.agents', 'skills', 'openresume', 'SKILL.md')));
    assert.ok(existsSync(join(testRoot, '.pi', 'skills', 'openresume', 'SKILL.md')));
    assert.ok(existsSync(join(testRoot, 'README.md')), 'README.md must be created in current folder');

    // Test agent-specific filtering
    const agentTestRoot = join(tmpdir(), `openresume-agent-test-${Date.now()}`);
    mkdirSync(agentTestRoot, { recursive: true });
    try {
      const antigravityInstalled = installSkills({ local: true, cwd: agentTestRoot, agent: 'antigravity' });
      assert.ok(existsSync(join(agentTestRoot, '.agents', 'skills', 'openresume', 'SKILL.md')));
      assert.equal(existsSync(join(agentTestRoot, '.pi', 'skills', 'openresume')), false);

      const piInstalled = installSkills({ local: true, cwd: agentTestRoot, agent: 'pi' });
      assert.ok(existsSync(join(agentTestRoot, '.pi', 'skills', 'openresume', 'SKILL.md')));
    } finally {
      rmSync(agentTestRoot, { recursive: true, force: true });
    }
  } finally {
    process.chdir(origCwd);
    rmSync(testRoot, { recursive: true, force: true });
  }
});

test('promptInteractiveSetup: updates existing skill files when invoked with update command', async () => {
  const testRoot = join(tmpdir(), `openresume-update-test-${Date.now()}`);
  mkdirSync(testRoot, { recursive: true });
  const origCwd = process.cwd();
  process.chdir(testRoot);
  try {
    // Initial install
    await promptInteractiveSetup(['--yes']);
    const skillMdPath = join(testRoot, '.agents', 'skills', 'openresume', 'SKILL.md');
    assert.ok(existsSync(skillMdPath));

    // Overwrite with outdated dummy content
    writeFileSync(skillMdPath, 'outdated dummy content', 'utf8');
    assert.equal(readFileSync(skillMdPath, 'utf8'), 'outdated dummy content');

    // Run update command
    const updateRes = await promptInteractiveSetup(['update']);
    assert.equal(updateRes.isUpdate, true);
    assert.equal(updateRes.local, true);

    // Verify file was updated/replaced with official release content
    const updatedContent = readFileSync(skillMdPath, 'utf8');
    assert.ok(updatedContent.includes('name: openresume'));
    assert.notEqual(updatedContent, 'outdated dummy content');
  } finally {
    process.chdir(origCwd);
    rmSync(testRoot, { recursive: true, force: true });
  }
});

test('manageProfile and initResume: imports profile and initializes workspace resume', async () => {
  const testProfileHome = join(tmpdir(), `openresume-profile-test-${Date.now()}`);
  const originalHome = process.env.OPENRESUME_HOME;
  process.env.OPENRESUME_HOME = testProfileHome;

  try {
    // Import starter JSON into personal profile
    const importRes = await manageProfile('import', 'skills/openresume/starter.json');
    assert.equal(importRes.type, 'json');
    assert.ok(existsSync(join(testProfileHome, 'resume.json')));
    assert.ok(existsSync(join(testProfileHome, 'profile.md')));

    const mdContent = readFileSync(join(testProfileHome, 'profile.md'), 'utf8');
    assert.ok(mdContent.includes('Alex Morgan'));
    assert.ok(mdContent.includes('Beacon Analytics'));

    // Initialize workspace resume from saved master profile
    const initTarget = join(tmpdir(), `test-init-${Date.now()}.json`);
    const initRes = initResume(initTarget, { template: 'executive' });
    assert.ok(existsSync(initTarget));
    assert.ok(initRes.source.includes('master profile'));

    const initDoc = JSON.parse(readFileSync(initTarget, 'utf8'));
    assert.equal(initDoc.document.template, 'executive');
    assert.equal(initDoc.profile.name, 'Alex Morgan');

    rmSync(initTarget, { force: true });
  } finally {
    process.env.OPENRESUME_HOME = originalHome;
    rmSync(testProfileHome, { recursive: true, force: true });
  }
});

test('startPreviewServer: serves HTML on GET / and updates resume.json on POST /api/settings', async () => {
  const testPreviewJson = join(tmpdir(), `test-preview-${Date.now()}.json`);
  const starterContent = readFileSync('skills/openresume/starter.json', 'utf8');
  writeFileSync(testPreviewJson, starterContent, 'utf8');

  const preview = await startPreviewServer(testPreviewJson, { port: 0, open: false });
  assert.ok(preview.port > 0);

  try {
    // 1. GET /
    const getRes = await fetch(`http://127.0.0.1:${preview.port}/`);
    assert.equal(getRes.status, 200);
    const getHtml = await getRes.text();
    assert.ok(getHtml.includes('openResume'));
    assert.ok(getHtml.includes('Classic (ATS)'));

    // 2. POST /api/settings
    const postRes = await fetch(`http://127.0.0.1:${preview.port}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: 'executive', accent: 'navy', margin: 'compact' }),
    });
    assert.equal(postRes.status, 200);
    const postJson = await postRes.json();
    assert.equal(postJson.ok, true);

    // Verify written to disk
    const updatedDoc = JSON.parse(readFileSync(testPreviewJson, 'utf8'));
    assert.equal(updatedDoc.document.template, 'executive');
    assert.equal(updatedDoc.document.accent, 'navy');
    assert.equal(updatedDoc.document.margin, 'compact');

    // 3. POST /api/save (valid edited document)
    updatedDoc.profile.name = 'Alex Morgan, Ph.D.';
    updatedDoc.experience[0].role = 'Principal Staff Software Engineer';
    updatedDoc.experience[0].bullets[0] = 'Architected **high-throughput** distributed pipelines.';
    updatedDoc.profile.photo = {
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      shape: 'circle',
      align: 'right',
      size: 75,
      zoom: 1.1,
      offsetX: 0,
      offsetY: 0,
    };
    const saveRes = await fetch(`http://127.0.0.1:${preview.port}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: updatedDoc }),
    });
    assert.equal(saveRes.status, 200);
    const saveJson = await saveRes.json();
    assert.equal(saveJson.ok, true);
    assert.equal(saveJson.message, 'Saved successfully');

    // Verify atomic disk write
    const savedDoc = JSON.parse(readFileSync(testPreviewJson, 'utf8'));
    assert.equal(savedDoc.profile.name, 'Alex Morgan, Ph.D.');
    assert.equal(savedDoc.experience[0].role, 'Principal Staff Software Engineer');
    assert.equal(savedDoc.experience[0].bullets[0], 'Architected **high-throughput** distributed pipelines.');
    assert.equal(savedDoc.profile.photo.shape, 'circle');
    assert.equal(savedDoc.profile.photo.size, 75);

    // 4. POST /api/save (invalid document rejection)
    const invalidDoc = JSON.parse(JSON.stringify(updatedDoc));
    invalidDoc.experience[0].start = 'invalid-date-format';
    const badSaveRes = await fetch(`http://127.0.0.1:${preview.port}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: invalidDoc }),
    });
    assert.equal(badSaveRes.status, 400);
    const badSaveJson = await badSaveRes.json();
    assert.equal(badSaveJson.ok, false);
    assert.ok(badSaveJson.issues.length > 0);

    // Verify disk content was not corrupted
    const postRejectDoc = JSON.parse(readFileSync(testPreviewJson, 'utf8'));
    assert.equal(postRejectDoc.profile.name, 'Alex Morgan, Ph.D.');
  } finally {
    preview.close();
    rmSync(testPreviewJson, { force: true });
  }
});

test('renderResumeHtml: includes live in-place editing tags, toolbar buttons, and controller script', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  const html = renderResumeHtml(starter);

  // Toolbar buttons and badges
  assert.ok(html.includes('id="btn-toggle-edit"'));
  assert.ok(html.includes('id="btn-save-changes"'));
  assert.ok(html.includes('id="save-status"'));
  assert.ok(html.includes('toolbar-edit-hint'));
  assert.ok(html.includes('id="toolbar-edit-tools"'));
  assert.ok(html.includes('id="floating-format-bubble"'));
  assert.ok(html.includes('data-add-section="experience"'));
  assert.ok(html.includes('class="entry-delete-btn no-print"'));

  // Editable elements tagged with data-editable
  assert.ok(html.includes('data-editable="true" data-field="name"'));
  assert.ok(html.includes('data-editable="true" data-field="role"'));
  assert.ok(html.includes('data-editable="true" data-field="employer"'));
  assert.ok(html.includes('class="entry-bullet" data-editable="true"'));
  assert.ok(html.includes('data-editable="true" data-field="summary"'));

  // Key event listeners and bold converter in script
  assert.ok(html.includes('htmlToMarkdownBold'));
  assert.ok(html.includes('formatSelectionSize'));
  assert.ok(html.includes('handleFormatAction'));
  assert.ok(html.includes('extractDocFromDom'));
  assert.ok(html.includes('/api/save'));

  // Controller script must have zero syntax errors and include dynamic multi-page overflow handler
  const scriptMatch = html.match(/<script class="no-print">([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Must contain a controller script tag');
  assert.ok(html.includes('paginateOnOverflow'));
  assert.ok(html.includes('id="page-count-badge"'));
  assert.doesNotThrow(() => {
    new Function(scriptMatch[1]);
  }, 'Controller script must be 100% syntactically valid JavaScript without syntax errors');
});

test('renderResumeHtml: renders movable/draggable sections with handles, move buttons, and column switching', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  const html = renderResumeHtml(starter);

  // Resume section container tags
  assert.ok(html.includes('class="resume-section" data-section-id="experience"'));
  assert.ok(html.includes('class="resume-section" data-section-id="summary"'));
  assert.ok(html.includes('class="resume-section" data-section-id="skills"'));
  assert.ok(html.includes('class="resume-section" data-section-id="projects"'));

  // Section drag controls & handles
  assert.ok(html.includes('class="section-drag-controls no-print"'));
  assert.ok(html.includes('class="drag-handle-pill"'));
  assert.ok(html.includes('class="drag-grip"'));
  assert.ok(html.includes('data-sec-dir="up"'));
  assert.ok(html.includes('data-sec-dir="down"'));
  assert.ok(html.includes('data-sec-dir="toggle-col"'));

  // Drag and drop events & sync functions in controllerScript
  assert.ok(html.includes('onSectionOrderChanged'));
  assert.ok(html.includes('syncTemplatesFromDoc'));
  assert.ok(html.includes('draggedSection'));
  assert.ok(html.includes('drop-target-above'));
  assert.ok(html.includes('column-drag-over'));
});

test('validateResumeJson: accepts valid sidebarSections in document config', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  starter.document.sidebarSections = ['skills', 'education', 'certifications'];
  const res = validateResumeJson(JSON.stringify(starter));
  assert.strictEqual(res.ok, true);

  starter.document.sidebarSections = ['invalid_section'];
  const invalidRes = validateResumeJson(JSON.stringify(starter));
  assert.strictEqual(invalidRes.ok, false);
  assert.ok(invalidRes.issues.some((i) => i.path === '/document/sidebarSections'));
});

test('validateResumeJson: validates profile.photo config (align, shape, size, zoom)', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  starter.profile.photo = {
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    shape: 'circle',
    align: 'right',
    size: 72,
    zoom: 1.2,
    offsetX: 10,
    offsetY: -5,
  };
  const validRes = validateResumeJson(JSON.stringify(starter));
  assert.strictEqual(validRes.ok, true);

  // Invalid align
  starter.profile.photo.align = 'top';
  const invalidAlignRes = validateResumeJson(JSON.stringify(starter));
  assert.strictEqual(invalidAlignRes.ok, false);
  assert.ok(invalidAlignRes.issues.some((i) => i.path === '/profile/photo/align'));

  // Invalid shape
  starter.profile.photo.align = 'left';
  starter.profile.photo.shape = 'hexagon';
  const invalidShapeRes = validateResumeJson(JSON.stringify(starter));
  assert.strictEqual(invalidShapeRes.ok, false);
  assert.ok(invalidShapeRes.issues.some((i) => i.path === '/profile/photo/shape'));
});

test('renderResumeHtml: renders executive company logo upload badge, overlay, and company logo modal', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));

  // Without photo: header has NO photo placeholder and toolbar has NO photo button
  const htmlWithoutPhoto = renderResumeHtml(starter);
  assert.ok(!htmlWithoutPhoto.includes('id="btn-toolbar-photo"'));
  assert.ok(!htmlWithoutPhoto.includes('profile-photo-placeholder'));

  // Includes company logo modal and interactive badges in executive template
  assert.ok(htmlWithoutPhoto.includes('id="company-logo-modal"'));
  assert.ok(htmlWithoutPhoto.includes('id="logo-preview-frame"'));
  assert.ok(htmlWithoutPhoto.includes('id="logo-file-input"'));
  assert.ok(htmlWithoutPhoto.includes('id="logo-fit-control"'));
  assert.ok(htmlWithoutPhoto.includes('id="logo-zoom-slider"'));
  assert.ok(htmlWithoutPhoto.includes('class="entry-company-badge " data-entry-index="0"'));
  assert.ok(htmlWithoutPhoto.includes('class="entry-badge-overlay no-print"'));

  // With company logo: renders company-badge-img inside badge with has-icon class
  starter.experience[0].icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const htmlWithLogo = renderResumeHtml(starter);
  assert.ok(htmlWithLogo.includes('class="entry-company-badge has-icon" data-entry-index="0"'));
  assert.ok(htmlWithLogo.includes('class="company-badge-img"'));
});

test('renderResumeHtml: renders skills as comma-separated text without bullet dots in executive template', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  const html = renderResumeHtml(starter);

  // Executive sidebar skills
  assert.ok(html.includes('class="sidebar-skill-items"'));
  assert.ok(html.includes('TypeScript, JavaScript, Go, Python, SQL, HTML/CSS'));
  assert.ok(!html.includes('class="sidebar-skill-inline-item"'));
});

test('validateResumeJson: validates experience icon format and length', () => {
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  starter.experience[0].icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const validRes = validateResumeJson(JSON.stringify(starter));
  assert.strictEqual(validRes.ok, true);

  // Non-string icon
  starter.experience[0].icon = 12345;
  const invalidRes = validateResumeJson(JSON.stringify(starter));
  assert.strictEqual(invalidRes.ok, false);
  assert.ok(invalidRes.issues.some((i) => i.path === '/experience/0/icon'));
});

test('startPreviewServer: saves logo image to disk and serves it via /images/ on POST /api/save', async () => {
  const tmpDir = join(tmpdir(), `test-preview-img-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const resumePath = join(tmpDir, 'resume.json');
  const starter = JSON.parse(readFileSync('skills/openresume/starter.json', 'utf8'));
  starter.experience[0].icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  writeFileSync(resumePath, JSON.stringify(starter, null, 2), 'utf8');

  const { server, port } = await startPreviewServer(resumePath, { port: 0 });
  try {
    // Send POST /api/save with icon data
    const res = await fetch(`http://127.0.0.1:${port}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: starter }),
    });
    assert.strictEqual(res.status, 200);

    // Verify image file was written to disk in tmpDir/images
    const expectedImgPath = join(tmpDir, 'images', `${starter.experience[0].id}-logo.png`);
    assert.strictEqual(existsSync(expectedImgPath), true);

    // Verify server serves the image
    const imgRes = await fetch(`http://127.0.0.1:${port}/images/${starter.experience[0].id}-logo.png`);
    assert.strictEqual(imgRes.status, 200);
    assert.strictEqual(imgRes.headers.get('content-type'), 'image/png');
  } finally {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('validateResumeJson: accepts system, serif, and times fonts and rejects jakarta or inter', () => {
  const starter = JSON.parse(readFileSync(join(process.cwd(), 'skills/openresume/starter.json'), 'utf8'));

  starter.document.font = 'system';
  assert.strictEqual(validateResumeJson(JSON.stringify(starter)).ok, true);

  starter.document.font = 'times';
  assert.strictEqual(validateResumeJson(JSON.stringify(starter)).ok, true);

  starter.document.font = 'serif';
  assert.strictEqual(validateResumeJson(JSON.stringify(starter)).ok, true);

  starter.document.font = 'jakarta';
  assert.strictEqual(validateResumeJson(JSON.stringify(starter)).ok, false);

  starter.document.font = 'inter';
  assert.strictEqual(validateResumeJson(JSON.stringify(starter)).ok, false);
});

test('renderResumeHtml: sets exact sheet dimensions and supports A4 and Letter paperSize', () => {
  const starter = JSON.parse(readFileSync(join(process.cwd(), 'skills/openresume/starter.json'), 'utf8'));

  // Test A4
  starter.document.paperSize = 'a4';
  const htmlA4 = renderResumeHtml(starter);
  assert.ok(htmlA4.includes('--page-width: 210mm;'));
  assert.ok(htmlA4.includes('--page-height: 297mm;'));
  assert.ok(htmlA4.includes('size: A4 portrait;'));
  assert.ok(htmlA4.includes('id="sheet-size-badge">A4<'));

  // Test Letter
  starter.document.paperSize = 'letter';
  const htmlLetter = renderResumeHtml(starter);
  assert.ok(htmlLetter.includes('--page-width: 215.9mm;'));
  assert.ok(htmlLetter.includes('--page-height: 279.4mm;'));
  assert.ok(htmlLetter.includes('size: letter portrait;'));
  assert.ok(htmlLetter.includes('id="sheet-size-badge">Letter<'));
});

test('startPreviewServer: persists paperSize on POST /api/settings', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'test-paper-'));
  const resumePath = join(tmpDir, 'resume.json');
  const starter = JSON.parse(readFileSync(join(process.cwd(), 'skills/openresume/starter.json'), 'utf8'));
  starter.document.paperSize = 'a4';
  writeFileSync(resumePath, JSON.stringify(starter, null, 2), 'utf8');

  const { server, port } = await startPreviewServer(resumePath, { port: 0 });
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperSize: 'letter' }),
    });
    assert.strictEqual(res.status, 200);

    const savedDoc = JSON.parse(readFileSync(resumePath, 'utf8'));
    assert.strictEqual(savedDoc.document.paperSize, 'letter');
  } finally {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderResumeHtml: attaches data-entry-id on all items in both templates and equips live edit toolbar', () => {
  const starter = JSON.parse(readFileSync(join(process.cwd(), 'skills/openresume/starter.json'), 'utf8'));
  const html = renderResumeHtml(starter);

  // Check data-entry-id attributes
  starter.experience.forEach((item) => {
    assert.ok(html.includes(`data-entry-id="${item.id}"`), `Missing data-entry-id for experience ${item.id}`);
  });
  starter.education.forEach((item) => {
    assert.ok(html.includes(`data-entry-id="${item.id}"`), `Missing data-entry-id for education ${item.id}`);
  });
  starter.projects.forEach((item) => {
    assert.ok(html.includes(`data-entry-id="${item.id}"`), `Missing data-entry-id for project ${item.id}`);
  });
  starter.skills.forEach((group) => {
    assert.ok(html.includes(`data-entry-id="${group.id}"`), `Missing data-entry-id for skill group ${group.id}`);
  });
  starter.certifications.forEach((cert) => {
    assert.ok(html.includes(`data-entry-id="${cert.id}"`), `Missing data-entry-id for cert ${cert.id}`);
  });

  // Check editing mode and toolbar buttons
  assert.ok(html.includes('id="btn-toggle-edit"'));
  assert.ok(html.includes('id="btn-save-changes"'));
  assert.ok(html.includes('id="floating-format-bubble"'));
  assert.ok(html.includes('data-add-section="experience"'));
  assert.ok(html.includes('data-add-section="education"'));
  assert.ok(html.includes('data-add-section="projects"'));
  assert.ok(html.includes('data-add-section="skills"'));
  assert.ok(html.includes('data-add-section="certifications"'));
});

test('startPreviewServer: validates and persists live edits on POST /api/save', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'test-live-edit-'));
  const resumePath = join(tmpDir, 'resume.json');
  const starter = JSON.parse(readFileSync(join(process.cwd(), 'skills/openresume/starter.json'), 'utf8'));
  writeFileSync(resumePath, JSON.stringify(starter, null, 2), 'utf8');

  const { server, port } = await startPreviewServer(resumePath, { port: 0 });
  try {
    const editedDoc = JSON.parse(JSON.stringify(starter));
    editedDoc.profile.name = 'Pankil Live Edit';
    editedDoc.experience[0].role = 'Principal Staff Engineer';
    editedDoc.experience[0].bullets.push('Architected live editing two-way synchronization engine.');

    const res = await fetch(`http://127.0.0.1:${port}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: editedDoc }),
    });
    assert.strictEqual(res.status, 200);

    const savedDoc = JSON.parse(readFileSync(resumePath, 'utf8'));
    assert.strictEqual(savedDoc.profile.name, 'Pankil Live Edit');
    assert.strictEqual(savedDoc.experience[0].role, 'Principal Staff Engineer');
    assert.ok(savedDoc.experience[0].bullets.includes('Architected live editing two-way synchronization engine.'));
  } finally {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

let chromium;
try {
  const pw = await import('@playwright/test');
  chromium = pw.chromium;
} catch {
  // Playwright not available
}

test('browser: preview server starts and loads without any script or reference errors', { timeout: 30000 }, async () => {
  if (!chromium) return;
  const tmpDir = mkdtempSync(join(tmpdir(), 'test-browser-'));
  const resumePath = join(tmpDir, 'resume.json');
  const demoResume = JSON.parse(readFileSync(join(process.cwd(), 'demo/resume.json'), 'utf8'));
  demoResume.document.template = 'executive';
  writeFileSync(resumePath, JSON.stringify(demoResume, null, 2), 'utf8');

  const { server, port } = await startPreviewServer(resumePath, { port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForTimeout(600);

    assert.deepStrictEqual(pageErrors, [], `Expected 0 page errors, got: ${pageErrors.join(', ')}`);
  } finally {
    await browser.close();
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('browser: overflowing content is paginated cleanly and kept off page 1', { timeout: 30000 }, async () => {
  if (!chromium) return;
  const tmpDir = mkdtempSync(join(tmpdir(), 'test-overflow-'));
  const resumePath = join(tmpDir, 'resume.json');
  const demoResume = JSON.parse(readFileSync(join(process.cwd(), 'demo/resume.json'), 'utf8'));
  demoResume.document.template = 'executive';
  writeFileSync(resumePath, JSON.stringify(demoResume, null, 2), 'utf8');

  const { server, port } = await startPreviewServer(resumePath, { port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForTimeout(600);

    const layout = await page.evaluate(() => {
      const pages = Array.from(document.querySelectorAll('.template-view[data-template-view="executive"] .resume-page'));
      return pages.map((p, idx) => ({
        page: idx + 1,
        clientHeight: p.clientHeight,
        scrollHeight: p.scrollHeight,
        sidebarSections: Array.from(p.querySelectorAll('.executive-sidebar-column > .resume-section')).map(s => s.dataset.sectionId),
      }));
    });

    assert.ok(layout.length >= 2, `Expected at least 2 pages due to sidebar content, got ${layout.length}`);
    assert.strictEqual(layout[0].scrollHeight, layout[0].clientHeight, 'Page 1 must not overflow its height');
    assert.ok(layout[0].sidebarSections.includes('projects'));
    assert.ok(layout[0].sidebarSections.includes('skills'));
    assert.ok(!layout[0].sidebarSections.includes('education'), 'Education must be paginated to subsequent page');
    assert.ok(layout[1].sidebarSections.includes('education'), 'Education must be on Page 2');
  } finally {
    await browser.close();
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('browser: every interactive button functions properly and persists cleanly in Executive template', { timeout: 30000 }, async () => {
  if (!chromium) return;
  const tmpDir = mkdtempSync(join(tmpdir(), 'test-buttons-exec-'));
  const resumePath = join(tmpDir, 'resume.json');
  const demoResume = JSON.parse(readFileSync(join(process.cwd(), 'demo/resume.json'), 'utf8'));
  demoResume.document.template = 'executive';
  writeFileSync(resumePath, JSON.stringify(demoResume, null, 2), 'utf8');

  const { server, port } = await startPreviewServer(resumePath, { port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('dialog', async (d) => { await d.dismiss(); });

    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForTimeout(600);

    // 1. Add Experience Role
    const expBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="experience"]').length);
    await page.locator('.template-view[data-template-view="executive"] [data-add-section="experience"]').click();
    await page.waitForTimeout(200);
    const expAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="experience"]').length);
    assert.strictEqual(expAfter, expBefore + 1, 'Add Experience Role button should add 1 entry');

    // 2. Add Project
    const projBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="projects"]').length);
    await page.locator('.template-view[data-template-view="executive"] [data-add-section="projects"]').click();
    await page.waitForTimeout(200);
    const projAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="projects"]').length);
    assert.strictEqual(projAfter, projBefore + 1, 'Add Project button should add 1 entry');

    // 3. Add Skill Group
    const skillBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] .sidebar-skill-group').length);
    await page.locator('.template-view[data-template-view="executive"] [data-add-section="skills"]').click();
    await page.waitForTimeout(200);
    const skillAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] .sidebar-skill-group').length);
    assert.strictEqual(skillAfter, skillBefore + 1, 'Add Skill Group button should add 1 group');

    // 4. Add Education
    const eduBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="education"]').length);
    await page.locator('.template-view[data-template-view="executive"] [data-add-section="education"]').click();
    await page.waitForTimeout(200);
    const eduAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="education"]').length);
    assert.strictEqual(eduAfter, eduBefore + 1, 'Add Education button should add 1 entry');

    // 5. Add Certification
    const certBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="certifications"]').length);
    await page.locator('.template-view[data-template-view="executive"] [data-add-section="certifications"]').click();
    await page.waitForTimeout(200);
    const certAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type="certifications"]').length);
    assert.strictEqual(certAfter, certBefore + 1, 'Add Certification button should add 1 entry');

    // 6. Delete entry
    const totalBeforeDel = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type]').length);
    await page.locator('.template-view[data-template-view="executive"] .entry-delete-btn').first().click({ force: true });
    await page.waitForTimeout(200);
    const totalAfterDel = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="executive"] [data-entry-type]').length);
    assert.strictEqual(totalAfterDel, totalBeforeDel - 1, 'Delete button should remove 1 entry');

    // 7. Toggle edit mode
    await page.click('#btn-toggle-edit');
    await page.waitForTimeout(200);
    const isEditingOff = await page.evaluate(() => document.body.classList.contains('is-editing'));
    assert.strictEqual(isEditingOff, false, 'Edit mode toggle should deactivate edit mode');

    await page.click('#btn-toggle-edit');
    await page.waitForTimeout(200);
    const isEditingOn = await page.evaluate(() => document.body.classList.contains('is-editing'));
    assert.strictEqual(isEditingOn, true, 'Edit mode toggle should re-activate edit mode');

    // 8. Save changes to disk
    await page.click('#btn-save-changes');
    await page.waitForTimeout(500);
    const statusText = await page.evaluate(() => document.getElementById('save-status')?.textContent);
    assert.ok(statusText.includes('Saved'), `Expected status Saved, got: ${statusText}`);

    // Verify written JSON on disk validates without duplicate IDs
    const saved = JSON.parse(readFileSync(resumePath, 'utf8'));
    const valRes = validateResumeJson(JSON.stringify(saved));
    assert.strictEqual(valRes.ok, true, `Saved resume JSON must be valid: ${JSON.stringify(valRes.issues)}`);

    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await browser.close();
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('browser: every interactive button functions properly in Classic template', { timeout: 30000 }, async () => {
  if (!chromium) return;
  const tmpDir = mkdtempSync(join(tmpdir(), 'test-buttons-classic-'));
  const resumePath = join(tmpDir, 'resume.json');
  const demoResume = JSON.parse(readFileSync(join(process.cwd(), 'demo/resume.json'), 'utf8'));
  demoResume.document.template = 'classic';
  writeFileSync(resumePath, JSON.stringify(demoResume, null, 2), 'utf8');

  const { server, port } = await startPreviewServer(resumePath, { port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('dialog', async (d) => { await d.dismiss(); });

    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForTimeout(600);

    // Switch to classic template
    await page.click('button[data-set-template="classic"]');
    await page.waitForTimeout(300);

    // 1. Add Experience Role
    const expBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="experience"]').length);
    await page.locator('.template-view[data-template-view="classic"] [data-add-section="experience"]').click();
    await page.waitForTimeout(200);
    const expAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="experience"]').length);
    assert.strictEqual(expAfter, expBefore + 1, 'Classic: Add Experience Role should add 1 entry');

    // 2. Add Project
    const projBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="projects"]').length);
    await page.locator('.template-view[data-template-view="classic"] [data-add-section="projects"]').click();
    await page.waitForTimeout(200);
    const projAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="projects"]').length);
    assert.strictEqual(projAfter, projBefore + 1, 'Classic: Add Project should add 1 entry');

    // 3. Add Skill Group
    const skillBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] .atom-skill-group').length);
    await page.locator('.template-view[data-template-view="classic"] [data-add-section="skills"]').click();
    await page.waitForTimeout(200);
    const skillAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] .atom-skill-group').length);
    assert.strictEqual(skillAfter, skillBefore + 1, 'Classic: Add Skill Group should add 1 group');

    // 4. Add Education
    const eduBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="education"]').length);
    await page.locator('.template-view[data-template-view="classic"] [data-add-section="education"]').click();
    await page.waitForTimeout(200);
    const eduAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="education"]').length);
    assert.strictEqual(eduAfter, eduBefore + 1, 'Classic: Add Education should add 1 entry');

    // 5. Add Certification
    const certBefore = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="certifications"]').length);
    await page.locator('.template-view[data-template-view="classic"] [data-add-section="certifications"]').click();
    await page.waitForTimeout(200);
    const certAfter = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type="certifications"]').length);
    assert.strictEqual(certAfter, certBefore + 1, 'Classic: Add Certification should add 1 entry');

    // 6. Delete entry
    const totalBeforeDel = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type]').length);
    await page.locator('.template-view[data-template-view="classic"] .entry-delete-btn').first().click({ force: true });
    await page.waitForTimeout(200);
    const totalAfterDel = await page.evaluate(() => document.querySelectorAll('.template-view[data-template-view="classic"] [data-entry-type]').length);
    assert.strictEqual(totalAfterDel, totalBeforeDel - 1, 'Classic: Delete button should remove 1 entry');

    // 7. Save changes
    await page.click('#btn-save-changes');
    await page.waitForTimeout(500);
    const statusText = await page.evaluate(() => document.getElementById('save-status')?.textContent);
    assert.ok(statusText.includes('Saved'), `Expected status Saved, got: ${statusText}`);

    // Verify valid saved JSON on disk
    const saved = JSON.parse(readFileSync(resumePath, 'utf8'));
    const valRes = validateResumeJson(JSON.stringify(saved));
    assert.strictEqual(valRes.ok, true, `Classic saved resume JSON must be valid: ${JSON.stringify(valRes.issues)}`);

    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await browser.close();
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
