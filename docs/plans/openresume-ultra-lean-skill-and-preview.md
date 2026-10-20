# Plan: openResume — Ultra-Lean 1-Command Agent Skill, Persistent Personal Profile & Interactive Template/PDF Preview

Status: completed

## 1. Goal & Context

### Current State
- The repository is named `resume-studio` (`private: true`, no `"bin"` entry in `package.json`), making `bunx` / `npx` 1-command installation impossible from outside the repo.
- `scripts/install-skill.mjs` resolves `SOURCE_SKILL_DIR` from `process.cwd()` instead of `import.meta.url`, which breaks when invoked globally or via `bunx`/`npx`.
- The repository carries ~17,200 lines of deprecated TypeScript/Vite/Playwright web application code across `src/web/`, `src/core/`, `src/cli/`, and legacy browser test suites, making repo navigation slow and token-heavy for coding agents.
- `skills/resume-studio/SKILL.md` references repo-relative paths (`bun skills/resume-studio/...`), lacks an inline compact schema (forcing agents to read the 526-line `schema.json` + 119-line `starter.json`), and has no persistent personal profile (`~/.openresume/`) onboarding/memory workflow.
- `skills/resume-studio/render.mjs` renders only a single static template (`classic` or `executive`) with no interactive screen toolbar, no template switcher toggle, no live-reload preview support, no "Save / Download as PDF" button, and an empty `"CONTINUED"` placeholder on `executive` Page 2 when `maxPages: 2`.

### Target Behavior
1. **Whole-Project Rename to `openResume` (`openresume`)**:
   - Package renamed to `openresume` with `bin` aliases `openresume` and `open-resume`.
   - Skill directory moved from `skills/resume-studio/` to `skills/openresume/`.
   - Global user data & master profile stored at `~/.openresume/` (`profile.md`, optional `profile.pdf`, and master `resume.json`).
2. **Ultra-Lean, Zero-Dependency Architecture**:
   - Remove deprecated `src/`, `index.html`, `vite.config.ts`, `playwright.config.ts`, `tsconfig*.json`, `public/`, `schema/`, and obsolete build/test scripts.
   - Pure ECMAScript (`.mjs`) using only Node/Bun built-ins (`node:fs`, `node:path`, `node:os`, `node:http`, `node:child_process`, `node:url`, `node:process`).
3. **1-Command Skill Installation & Unified CLI (`bin/openresume.mjs`)**:
   - `bunx openresume` / `npx openresume` (or `openresume install [--local] [--symlink]`) installs `skills/openresume/` to global agent skill directories (`~/.pi/skills/openresume`, `~/.claude/skills/openresume`, `~/.gemini/config/skills/openresume`, `~/.agents/skills/openresume`) or workspace directories (`--local`: `.pi/skills/openresume`, `.claude/skills/openresume`, `.agents/skills/openresume`), and removes stale `resume-studio` skill directories.
   - Subcommands: `install`, `init`, `profile`, `validate`, `render`, and `preview`.
4. **Persistent Personal Info Workflow (`~/.openresume/` + `SKILL.md`)**:
   - Ultra-compact `skills/openresume/SKILL.md` (<110 lines) embeds the full JSON schema contract inline so agents need zero extra file reads.
   - Built-in profile management (`openresume profile show|import|init`) and agent workflow that checks `~/.openresume/profile.md` and `~/.openresume/resume.json` first, extracts text from user-supplied `.txt`/`.md`/`.pdf` resumes or interviews the user once, saves their facts to `~/.openresume/`, and reuses them across all future sessions.
5. **Interactive Template Switcher, Live Watch Preview & PDF Export (`skills/openresume/render.mjs` + `bin/openresume.mjs`)**:
   - `render.mjs` outputs **both** `classic` and `executive` rendered views inside `resume.html` plus a `.no-print` floating top toolbar (`DESIGN.md` warm-dark palette `#2b2622` / `#383330` / `#f7f5f0`) allowing instant switching between **Classic (ATS)** and **Executive (2-Col)** templates, **Accent** palettes (`slate`, `navy`, `forest`, `ocean`, `amber`), **Margins** (`narrow`, `normal`, `compact`), **Save JSON**, and **Save / Download as PDF** (`window.print()`).
   - Fixes `executive` 2-page split so Page 2 renders overflow experience/projects instead of an empty placeholder.
   - `openresume preview <resume.json> [--open]` runs a local `127.0.0.1` live-reload server with Server-Sent Events (`/events`) that auto-refreshes the browser whenever the agent edits `resume.json` and persists toolbar template/accent/margin toggles back to `resume.json` via `POST /api/settings`.

---

## 2. Files

### `[CREATE]`
- `bin/openresume.mjs` — Unified zero-dependency CLI (`install`, `init`, `profile`, `validate`, `render`, `preview` with SSE live reload & settings persistence).
- `skills/openresume/SKILL.md` — Ultra-token-efficient agent directives (<110 lines) with inline schema, `~/.openresume/` personal info workflow, and CLI reference.
- `skills/openresume/schema.json` — Canonical JSON Schema v1 for `openResume` documents.
- `skills/openresume/starter.json` — Clean synthetic starter resume JSON.
- `skills/openresume/validate.mjs` — Zero-dependency validator (including `document.margin` validation).
- `skills/openresume/render.mjs` — Dual-template interactive A4 HTML compiler with `.no-print` template/accent/margin toolbar, PDF print trigger, live-sync client hook, and fixed 2-page `executive` split.
- `tests/openresume.test.mjs` — Comprehensive `node:test` / `bun test` suite covering validator, dual-template interactive renderer, profile manager, skill installer, and preview server.

### `[MODIFY]`
- `package.json:1-32` — Rename to `openresume`, remove `"private": true`, add `"bin"` (`openresume`, `open-resume`), `"files"`, update `"scripts"`, and remove legacy devDependencies.
- `scripts/install-skill.mjs:1-115` — Thin wrapper delegating to `bin/openresume.mjs install` for backwards compatibility with `bun run install:skill`.
- `scripts/install-skill.sh:1-15` — Update skill name and entrypoint reference to `bin/openresume.mjs`.
- `scripts/run-tests.mjs:1-38` — Default test directory to `tests` so `bun test` / `node --test` runs `tests/openresume.test.mjs` directly without `tsc`.
- `AGENTS.md:1-91` — Update project name (`openResume`), paths (`skills/openresume/`, `bin/openresume.mjs`, `~/.openresume/`), and architecture documentation.
- `README.md:1-90` — Document 1-command install (`bunx openresume` / `npx openresume`), persistent personal profile workflow, interactive template preview, and PDF export.
- `docs/deployment.md:1-76` — Update standalone skill architecture and installer paths for `openResume`.
- `.github/workflows/ci.yml:1-79` — Streamline CI workflow to run zero-dependency verification (`npm test` and CLI smoke checks).
- `.gitignore:1-36` — Ignore local skill copies (`.agents/`, `.pi/`, `.claude/`, `scratch/`).

### `[DELETE]`
- Legacy skill directory:
  - `skills/resume-studio/SKILL.md`
  - `skills/resume-studio/schema.json`
  - `skills/resume-studio/starter.json`
  - `skills/resume-studio/validate.mjs`
  - `skills/resume-studio/render.mjs`
- Deprecated web/TypeScript/build files:
  - `index.html`
  - `vite.config.ts`
  - `playwright.config.ts`
  - `tsconfig.json`
  - `tsconfig.cli.json`
  - `tsconfig.test.json`
  - `tsconfig.web.json`
  - `public/_headers`
  - `schema/resume.schema.json`
  - `scripts/bench.mjs`
  - `scripts/check-build.mjs`
  - `scripts/copy-cli-assets.mjs`
  - `scripts/generate-contracts.mjs`
  - `scripts/run-browser-tests.mjs`
  - `src/core/content.ts`
  - `src/core/defaults.ts`
  - `src/core/index.ts`
  - `src/core/prompt.ts`
  - `src/core/templates.ts`
  - `src/core/validation.ts`
  - `src/core/generated/guidance.ts`
  - `src/core/generated/resume.ts`
  - `src/core/generated/validator.d.ts`
  - `src/core/generated/validator.js`
  - `src/cli/args.ts`
  - `src/cli/documents.ts`
  - `src/cli/locks.ts`
  - `src/cli/main.ts`
  - `src/cli/open-browser.ts`
  - `src/cli/server.ts`
  - `src/web/ai-prompt-modal.ts`
  - `src/web/blocks.ts`
  - `src/web/diagnostics.ts`
  - `src/web/editor.ts`
  - `src/web/files.ts`
  - `src/web/main.ts`
  - `src/web/paginate.ts`
  - `src/web/print.ts`
  - `src/web/render.ts`
  - `src/web/resizer.ts`
  - `src/web/state.ts`
  - `src/web/storage.ts`
  - `src/web/templates-view.ts`
  - `src/web/zoom.ts`
  - `src/web/adapters/filesystem.ts`
  - `src/web/adapters/local.ts`
  - `src/web/styles/editor.css`
  - `src/web/styles/print.css`
  - `src/web/styles/templates.css`
  - `src/web/templates/classic.ts`
  - `src/web/templates/executive.ts`
  - `src/web/templates/index.ts`
  - `tests/unit/contracts.test.ts`
  - `tests/unit/filesystem-adapter.test.ts`
  - `tests/unit/pagination.test.ts`
  - `tests/unit/prompt.test.ts`
  - `tests/unit/schema.test.ts`
  - `tests/unit/skeleton.test.ts`
  - `tests/unit/skill.test.ts`
  - `tests/cli/args.test.ts`
  - `tests/cli/commands.test.ts`
  - `tests/cli/documents.test.ts`
  - `tests/cli/server.test.ts`
  - `tests/cli/skeleton.test.ts`
  - `tests/cli/transactions.test.ts`
  - `tests/browser/a11y.test.mjs`
  - `tests/browser/bridge.spec.ts`
  - `tests/browser/bridge.test.mjs`
  - `tests/browser/e2e-security.test.mjs`
  - `tests/browser/editor.test.mjs`
  - `tests/browser/layout.test.mjs`

---

## 3. Phases / Steps

### Phase 1: Schema, Starter & Validator in `skills/openresume/`

1. **`[CREATE] skills/openresume/schema.json` & `[CREATE] skills/openresume/starter.json`**:
   - Copy `skills/resume-studio/schema.json` to `skills/openresume/schema.json`, updating `"title": "Resume Studio Document"` (line 3) to `"title": "openResume Document"`.
   - Copy `skills/resume-studio/starter.json` to `skills/openresume/starter.json`.

2. **`[CREATE] skills/openresume/validate.mjs`**:
   - Copy `skills/resume-studio/validate.mjs` to `skills/openresume/validate.mjs` and add validation for `document.margin` (`['narrow', 'normal', 'compact']`) and `profile.links` array type check.
   - Exact signature exported:
     ```js
     export function validateResumeJson(rawText)
     ```
   - Inside section `// 4. Document config` of `skills/openresume/validate.mjs`, include:
     ```js
     if (doc.document.margin && !['narrow', 'normal', 'compact'].includes(doc.document.margin)) {
       issues.push({ path: '/document/margin', severity: 'error', message: "margin must be 'narrow', 'normal', or 'compact'." });
     }
     ```
   - Inside section `// 5. Profile config`, check `profile.links` when defined:
     ```js
     if (doc.profile.links !== undefined && !Array.isArray(doc.profile.links)) {
       issues.push({ path: '/profile/links', severity: 'error', message: 'profile.links must be an array.' });
     }
     ```

---

### Phase 2: Dual-Template Interactive Renderer & PDF Preview (`skills/openresume/render.mjs`)

1. **`[CREATE] skills/openresume/render.mjs`**:
   - Exports:
     ```js
     export function escapeHtml(str)
     export function sanitizeUrl(urlStr, allowImageData = false)
     export function formatTextWithBold(str)
     export function formatDateRange(start, end, current)
     export function getCompanyMonogram(companyName)
     export function renderTemplatePagesHtml(doc, template, accent)
     export function renderResumeHtml(resumeInput, options = {})
     export function renderFile(inputPath, outputPath, options = {})
     ```
   - **Key enhancements in `getEmbeddedCss(accent, marginMode, paperSize)`**:
     - Define margin CSS classes on `body` (`.margin-narrow { --page-padding: 10mm; }`, `.margin-normal { --page-padding: 14mm; }`, `.margin-compact { --page-padding: 7mm; }`) so margin switching in the toolbar updates `--page-padding` live without regenerating CSS.
     - Template view toggling rules for both screen and print:
       ```css
       .template-view {
         display: none;
         flex-direction: column;
         align-items: center;
         gap: 24px;
         width: 100%;
       }
       body[data-active-template="classic"] .template-view[data-template-view="classic"],
       body[data-active-template="executive"] .template-view[data-template-view="executive"] {
         display: flex;
       }
       @media print {
         .no-print {
           display: none !important;
         }
         .template-view {
           display: none !important;
           gap: 0 !important;
         }
         body[data-active-template="classic"] .template-view[data-template-view="classic"],
         body[data-active-template="executive"] .template-view[data-template-view="executive"] {
           display: block !important;
         }
       }
       ```
     - **Floating Toolbar CSS (`.preview-toolbar.no-print`)** adhering strictly to `DESIGN.md` tokens:
       ```css
       .preview-toolbar {
         position: sticky;
         top: 0;
         z-index: 100;
         width: 100%;
         background: rgba(56, 51, 48, 0.95);
         backdrop-filter: blur(8px);
         border-bottom: 1px solid rgba(247, 245, 240, 0.14);
         color: #f7f5f0;
         padding: 10px 20px;
         box-sizing: border-box;
         display: flex;
          flex-wrap: wrap;
         align-items: center;
         justify-content: space-between;
         gap: 12px;
         font-family: var(--font-sans);
         font-size: 12px;
       }
       .toolbar-group {
         display: flex;
         align-items: center;
         gap: 8px;
         flex-wrap: wrap;
       }
       .toolbar-brand {
         font-weight: 700;
         font-size: 13px;
         letter-spacing: -0.01em;
         color: #f7f5f0;
         display: flex;
         align-items: center;
         gap: 8px;
       }
       .toolbar-badge {
         font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
         font-size: 10px;
         padding: 2px 6px;
         border-radius: 3px;
         background: #2b2622;
         color: #bfb9b2;
         border: 1px solid rgba(247, 245, 240, 0.12);
       }
       .toolbar-segmented {
         display: inline-flex;
         background: #2b2622;
         padding: 2px;
         border-radius: 3px;
         border: 1px solid rgba(247, 245, 240, 0.12);
       }
       .toolbar-btn {
         appearance: none;
         border: none;
         background: transparent;
         color: #bfb9b2;
         font-size: 12px;
         font-weight: 500;
         padding: 5px 10px;
         border-radius: 2px;
         cursor: pointer;
         transition: background 120ms ease, color 120ms ease;
       }
       .toolbar-btn:hover {
         color: #f7f5f0;
       }
       .toolbar-btn.is-active {
         background: #3f3a36;
         color: #f7f5f0;
         font-weight: 600;
       }
       .toolbar-select {
         background: #2b2622;
         color: #f7f5f0;
         border: 1px solid rgba(247, 245, 240, 0.14);
         border-radius: 3px;
         padding: 5px 8px;
         font-size: 12px;
         cursor: pointer;
       }
       .toolbar-cta {
         appearance: none;
         background: #f7f5f0;
         color: #1c1917;
         border: 1px solid #f7f5f0;
         border-radius: 3px;
         padding: 6px 12px;
         font-size: 12px;
         font-weight: 600;
         cursor: pointer;
       }
       .toolbar-cta:hover {
         background: #eae6df;
       }
       .toolbar-secondary {
         appearance: none;
         background: #3f3a36;
         color: #f7f5f0;
         border: 1px solid rgba(247, 245, 240, 0.14);
         border-radius: 3px;
         padding: 6px 10px;
         font-size: 12px;
         font-weight: 500;
         cursor: pointer;
       }
       ```
   - **Fix `executive` 2-Page Split inside `renderTemplatePagesHtml(doc, template, accent)`**:
     - When `template === 'executive'` and `maxPages === 2`:
       - Page 1 primary column renders `summary` + `experience` (or first 3 roles if `experience.length > 3`), and sidebar renders `skills` + `education` + `certifications`.
       - Page 2 renders remaining `experience` roles (if `experience.length > 3`) plus `projects` (or if `experience.length <= 3`, `experience` stays on Page 1 and `projects` renders on Page 2 under `CONTINUED`) so Page 2 contains actual structured content instead of a blank box.
   - **Dual-Template Markup & Embedded Controller Script in `renderResumeHtml(resumeInput, options = {})`**:
     - Render both `classicPages = renderTemplatePagesHtml(doc, 'classic', accent)` and `executivePages = renderTemplatePagesHtml(doc, 'executive', accent)`.
     - Wrap each in `<div class="template-view" data-template-view="classic">${classicPages}</div>` and `<div class="template-view" data-template-view="executive">${executivePages}</div>`.
     - Include the `.preview-toolbar.no-print` header with:
       - Segmented buttons: `data-set-template="classic"` (`Classic (ATS)`) and `data-set-template="executive"` (`Executive (2-Col)`).
       - Accent `<select id="select-accent">` (`slate`, `navy`, `forest`, `ocean`, `amber`).
       - Margin `<select id="select-margin">` (`narrow`, `normal`, `compact`).
       - Secondary button `<button type="button" class="toolbar-secondary" id="btn-download-json">Save JSON</button>`.
       - Primary CTA `<button type="button" class="toolbar-cta" id="btn-print-pdf">Save / Download PDF</button>`.
     - Embed a small zero-dependency `<script class="no-print">` that:
       - Toggles `document.body.dataset.activeTemplate` when clicking `[data-set-template]`, updates button `.is-active` states, and posts `{ template, accent, margin }` to `/api/settings` if running on `http:`/`https:`.
       - Updates `.resume-page` `accent-*` classes when `#select-accent` changes.
       - Updates `document.body` `margin-*` class when `#select-margin` changes.
       - Triggers `window.print()` on `#btn-print-pdf` click.
       - Downloads the embedded `resume.json` (with current `template`, `accent`, `margin` applied) on `#btn-download-json` click.
       - When `options.liveReload === true` (or on `127.0.0.1`), connects to `new EventSource('/events')` and reloads on `change` events.

---

### Phase 3: Unified 1-Command CLI, Profile Manager & Live Preview Server (`bin/openresume.mjs`)

1. **`[CREATE] bin/openresume.mjs`**:
   - Shebang: `#!/usr/bin/env node`
   - Resolves skill source relative to script location (works anywhere via `bunx` / `npx`):
     ```js
     import { fileURLToPath } from 'node:url';
     import { dirname, resolve, join, basename, extname } from 'node:path';
     const __dirname = dirname(fileURLToPath(import.meta.url));
     export const SKILL_NAME = 'openresume';
     export const SOURCE_SKILL_DIR = resolve(__dirname, '..', 'skills', SKILL_NAME);
     export const USER_HOME_DIR = resolve(process.env.OPENRESUME_HOME || join(homedir(), '.openresume'));
     ```
   - **Command 1: `installSkills({ local = false, symlink = false, cwd = process.cwd() })`** (default when `openresume` is invoked with no subcommand or `openresume install`):
     - Global targets (`!local`):
       - `~/.pi/skills/openresume`
       - `~/.claude/skills/openresume`
       - `~/.gemini/config/skills/openresume`
       - `~/.agents/skills/openresume`
     - Workspace targets (`local`):
       - `<cwd>/.pi/skills/openresume`
       - `<cwd>/.claude/skills/openresume`
       - `<cwd>/.agents/skills/openresume`
     - Also removes legacy `resume-studio` directories in the same parent skill roots if they exist.
     - Copies (or symlinks) `['SKILL.md', 'schema.json', 'starter.json', 'validate.mjs', 'render.mjs']` and sets `0o755` on `validate.mjs` and `render.mjs`.
     - Ensures `USER_HOME_DIR` (`~/.openresume/`) exists.
   - **Command 2: `manageProfile(subcommand, fileArg)` (`openresume profile [show|import <file>|path]`)**:
     - `path`: prints `~/.openresume` paths (`profile.md`, `profile.pdf`, `resume.json`).
     - `show`: prints saved `~/.openresume/profile.md` (and whether `~/.openresume/resume.json` / `profile.pdf` exist), or exits with a helpful message if no profile is saved yet.
     - `import <file>` (or `set <file>`):
       - Accepts `.txt`, `.md`, `.json`, or `.pdf`.
       - If `.json`: validates via `validateResumeJson`, saves to `~/.openresume/resume.json`, and generates a readable `~/.openresume/profile.md` summary from the JSON fields.
       - If `.txt` or `.md`: copies content into `~/.openresume/profile.md`.
       - If `.pdf`: copies the PDF to `~/.openresume/profile.pdf` AND attempts text extraction using `pdftotext <pdf> -` (if installed) or a built-in zero-dependency PDF text-stream extractor fallback (`extractPdfTextFallback(buffer)`), saving extracted text to `~/.openresume/profile.md`.
   - **Command 3: `initResume(targetPath = 'resume.json', options = {})` (`openresume init [file.json] [--template classic|executive]`)**:
     - If `~/.openresume/resume.json` exists, uses the user's saved master resume as the starting base; otherwise uses `skills/openresume/starter.json`.
     - Writes `targetPath` (refusing to overwrite existing files unless `--force` is passed).
   - **Command 4: `validate` (`openresume validate <file.json>`)**:
     - Calls `validateResumeJson` and prints clear errors/warnings.
   - **Command 5: `render` (`openresume render <file.json> [-t classic|executive] [-o resume.html] [--open]`)**:
     - Calls `renderFile(inputPath, outputPath, { template })`.
     - If `--open` is passed, opens the generated `.html` file in the system browser (`open` on macOS, `xdg-open` on Linux, `cmd /c start` on Windows).
   - **Command 6: `startPreviewServer(inputPath, { port = 0, open = false })` (`openresume preview <file.json> [--port N] [--open]` or `openresume render <file.json> --watch`)**:
     - Binds `http.createServer` strictly to `127.0.0.1` (`port` default `0` for OS-assigned free port).
     - `GET /`: reads `inputPath`, validates, renders HTML with `renderResumeHtml(doc, { liveReload: true })`, and serves `text/html; charset=utf-8`.
     - `GET /events`: SSE endpoint (`text/event-stream`) pushing `data: reload\n\n` whenever `fs.watch` detects changes to `inputPath`.
     - `POST /api/settings`: parses `{ template, accent, margin }`, updates `doc.document` in `inputPath` (and updates `~/.openresume/resume.json` if it exists and matches profile), writes atomically, and responds `{ ok: true }`.

2. **`[MODIFY] scripts/install-skill.mjs:1-115` & `[MODIFY] scripts/install-skill.sh:1-15`**:
   - Replace `scripts/install-skill.mjs` with a concise 15-line wrapper that imports and runs `bin/openresume.mjs` with `install` and forwarded flags.

---

### Phase 4: Ultra-Token-Efficient `skills/openresume/SKILL.md`

1. **`[CREATE] skills/openresume/SKILL.md`**:
   - Keep under 100 lines total so agent context usage is minimal.
   - Include:
     - **Frontmatter**: `name: openresume`, description covering resume creation, tailoring, persistent user profile in `~/.openresume/`, interactive template switching, and A4 PDF export.
     - **1. Persistent Personal Info Workflow (`~/.openresume/`)**:
       - Always check `~/.openresume/profile.md` and `~/.openresume/resume.json` first (`bunx openresume profile show`).
       - If the user provides a `.pdf`, `.txt`, or `.md` resume file, run `bunx openresume profile import <path>` to save it into `~/.openresume/`.
       - If no saved profile exists or required details are missing, ask the user for their personal info (name, headline, email/phone/location/links, work history with metrics, education, skills, projects) and save both `~/.openresume/profile.md` and `~/.openresume/resume.json` so they never have to repeat their info in future sessions.
       - Truth Policy: never invent companies, dates, metrics, degrees, or links.
     - **2. Compact Inline JSON Schema (`schemaVersion: 1`)**:
       - Exact TypeScript/JSON shape inline (including `document`: `title`, `template: 'classic'|'executive'`, `maxPages: 1|2`, `accent: 'slate'|'navy'|'forest'|'ocean'|'amber'`, `margin: 'narrow'|'normal'|'compact'`, `paperSize: 'a4'|'letter'`; `profile`; `sectionOrder` with all 6 sections; and item shapes with `id` regex `^[a-z][a-z0-9-]{1,47}$` and date regex `YYYY` or `YYYY-MM`).
       - Agents do NOT need to read `schema.json` or `starter.json` unless debugging a schema edge case.
     - **3. Edit, Validate, Interactive Preview & PDF Workflow**:
       - Initialize workspace resume from saved profile: `bunx openresume init resume.json`
       - Validate after edits: `bunx openresume validate resume.json`
       - Render interactive HTML (includes live `Classic` / `Executive` template toggle + accent/margin pickers + `Save / Download PDF` button): `bunx openresume render resume.json --open`
       - Or start live-watch preview server while iterating on user feedback: `bunx openresume preview resume.json --open`

---

### Phase 5: Cleanup Deprecated Files, Update Package & Tests

1. **`[DELETE]` Legacy Web/TS/Skill Files**:
   - Remove `skills/resume-studio/`, `src/`, `tests/unit/`, `tests/cli/`, `tests/browser/`, `index.html`, `vite.config.ts`, `playwright.config.ts`, `tsconfig*.json`, `public/`, `schema/`, and legacy scripts listed in Section 2.

2. **`[MODIFY] package.json:1-32`**:
   ```json
   {
     "name": "openresume",
     "version": "0.2.0",
     "description": "Ultra-lean AI coding agent skill and interactive A4 HTML/PDF resume compiler for Pi Agent, Claude Code, and Antigravity.",
     "type": "module",
     "bin": {
       "openresume": "./bin/openresume.mjs",
       "open-resume": "./bin/openresume.mjs"
     },
     "files": [
       "bin/",
       "skills/openresume/",
       "README.md"
     ],
     "engines": {
       "node": ">=20.0.0"
     },
     "scripts": {
       "test": "node scripts/run-tests.mjs tests",
       "verify": "node scripts/run-tests.mjs tests && node bin/openresume.mjs validate skills/openresume/starter.json",
       "install:skill": "node bin/openresume.mjs install",
       "openresume": "node bin/openresume.mjs"
     }
   }
   ```

3. **`[CREATE] tests/openresume.test.mjs`**:
   - Pure `node:test` + `node:assert/strict` suite testing:
     1. `validateResumeJson`: valid starter passes; invalid JSON, duplicate IDs, inverted dates, bad date formats, >128 KiB input, unsafe URLs, and invalid `margin` fail with exact error paths.
     2. `renderResumeHtml`:
        - Outputs both `data-template-view="classic"` and `data-template-view="executive"` in a single HTML document so users can toggle templates in the browser without re-rendering.
        - Includes `.preview-toolbar.no-print` with template toggle buttons (`data-set-template="classic"` / `"executive"`), `#select-accent`, `#select-margin`, `#btn-download-json`, and `#btn-print-pdf`.
        - Escapes XSS (`<script>`) and drops `javascript:` URLs while converting `**bold**` to `<strong>`.
        - Renders `maxPages: 2` properly for both `classic` and `executive` (verifying `executive` Page 2 renders overflow experience/projects rather than an empty box).
     3. `renderFile`: writes valid `.html` output and throws on invalid JSON.
     4. `installSkills`: installs all 5 skill files into a temporary directory for both `--local` and global (`OPENRESUME_HOME`) modes and cleans up legacy `resume-studio` directories.
     5. `manageProfile` & `initResume`: imports text/JSON into `OPENRESUME_HOME` (`profile.md` + `resume.json`) and initializes a new workspace `resume.json` from the saved master profile.
     6. `startPreviewServer`: starts on `127.0.0.1` port `0`, serves interactive HTML on `GET /`, and persists template/accent/margin changes on `POST /api/settings` back to `resume.json`.

4. **`[MODIFY] AGENTS.md`, `README.md`, `docs/deployment.md`, `.github/workflows/ci.yml`, `.gitignore`**:
   - Update all documentation and CI steps to reflect `openResume`, `bunx openresume` / `npx openresume`, `~/.openresume/` personal profile persistence, and interactive template/PDF preview.

---

## 4. Do Not Touch

- `DESIGN.md` — Keep visual design tokens, warm-dark canvas (`#2b2622`, `#383330`, `#3f3a36`), off-white CTA (`#f7f5f0`), and A4 print geometry rules intact.
- `examples/*.json` — Keep synthetic example resumes intact for testing and user reference.
- `docs/plans/2026-10-06-resume-studio.md` and `docs/plans/2026-10-08-client-sync-and-agent-skill.md` — Preserve historical execution plans.

---

## 5. Verification

Run the following commands in order to verify completion:

```bash
# 1. Run full unit, renderer, profile, installer, and preview server test suite
bun run test
node scripts/run-tests.mjs tests

# 2. Run verification script
bun run verify

# 3. Smoke-test 1-command local skill installation
bun ./bin/openresume.mjs install --local

# 4. Smoke-test rendering an example resume with interactive template toggle & PDF toolbar
bun ./bin/openresume.mjs render examples/pankil-resume.json --output /tmp/openresume-smoke.html
```
