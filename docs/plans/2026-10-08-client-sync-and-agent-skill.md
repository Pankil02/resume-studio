# Client-Side Disk Sync & Standalone AI Agent Skill for Cloudflare Pages

Status: complete · Current batch: 1 · Next incomplete phase: none · Owner: Antigravity · Created: 2026-10-08

## Goal & non-goals

* **Goal:** Enable live bidirectional synchronization between local AI coding agents (`pi`, Antigravity) editing `resume.json` on disk and a 100% static Cloudflare Pages deployment of Resume Studio, with zero cloud database, zero cloud storage, complete client-side data privacy, and a standalone agent skill that runs on any computer without repository dependencies.
* **Non-goals:**
  * No Cloudflare Workers, KV, D1, Durable Objects, or remote database backends.
  * No user accounts, remote authentication services, or cloud sessions.
  * No direct manipulation of Chrome's internal sandboxed LevelDB files from CLI processes (which is impossible due to OS and browser sandbox locking).
  * No automated background PDF rendering server or headless browser runtime.

## Context (current state, cited paths)

* Current local bridge ([src/cli/server.ts](file:///Users/pankil/Documents/Projects/resume-studio/src/cli/server.ts)) binds to `127.0.0.1` and uses SSE plus HTTP POST authenticated by a capability hash fragment.
* Web client ([src/web/adapters/local.ts](file:///Users/pankil/Documents/Projects/resume-studio/src/web/adapters/local.ts)) connects to loopback only when `#local=<token>` is present in the URL.
* Web state store ([src/web/state.ts](file:///Users/pankil/Documents/Projects/resume-studio/src/web/state.ts)) contains revision tracking, document loading (`loadDocument`), dirty state calculation, and validation checks (`validateResume` in [src/core/validation.ts](file:///Users/pankil/Documents/Projects/resume-studio/src/core/validation.ts)).
* The web app builds to `dist/web` via Vite ([vite.config.ts](file:///Users/pankil/Documents/Projects/resume-studio/vite.config.ts)).
* Canonical schema is defined in [schema/resume.schema.json](file:///Users/pankil/Documents/Projects/resume-studio/schema/resume.schema.json).

## Design

### Architecture & Data Flow

```
┌──────────────────────────────────────────────┐
│            Local Computer (Any PC)           │
│                                              │
│  ┌────────────────────┐                      │
│  │    Pi / Agent      │                      │
│  │ (Standalone Skill) │                      │
│  └─────────┬──────────┘                      │
│            │ 1. Mutate & Validate            │
│            ▼                                 │
│  ┌────────────────────┐                      │
│  │    resume.json     │◄──────────────────┐  │
│  └─────────┬──────────┘                   │  │
└────────────┼──────────────────────────────┼──┘
             │ 2. FileSystemFileHandle      │ 4. WritableStream
             │    (Read & stat polling)     │    (Save on edit)
┌────────────▼──────────────────────────────┴──┐
│  Deployed Cloudflare Pages (Static Edge CDN) │
│  https://resume-studio.pages.dev             │
│                                              │
│  - No database / No backend                  │
│  - FileSystemAccess Adapter in Browser       │
│  - File handle persisted in Origin IDB       │
│  - Live A4 DOM Preview & In-Memory Editor    │
└──────────────────────────────────────────────┘
```

### Data Model & Contracts

#### 1. File System Sync Adapter (`src/web/adapters/filesystem.ts`)
```typescript
export interface FileSyncState {
  connected: boolean;
  fileName: string | null;
  lastModified: number;
  writable: boolean;
}

export type FileSyncListener = (content: string, revision: string) => void;

export interface FileSyncAdapter {
  isSupported(): boolean;
  linkFile(): Promise<{ name: string; content: string; revision: string }>;
  restoreHandle(): Promise<{ name: string; content: string; revision: string } | null>;
  startWatching(listener: FileSyncListener, intervalMs?: number): void;
  stopWatching(): void;
  writeFile(content: string): Promise<string>;
  disconnect(): Promise<void>;
  getState(): Readonly<FileSyncState>;
}
```

#### 2. Standalone Skill Structure (`skills/resume-studio/`)
* `SKILL.md`: Universal markdown prompt specification conforming to Pi, Antigravity, and Claude Code standards.
* `schema.json`: Complete canonical `ResumeV1` schema definition.
* `validate.mjs`: Zero-dependency, pure ECMAScript validator verifying schema constraints, section ordering, character ceilings, and item ID stability on any standard Node.js (>=18) or Bun runtime.
* `starter.json`: Complete, ATS-compliant starter resume template.

### Architectural Decisions

| Decision | Chosen | Rejected (flaw) | Why |
| :--- | :--- | :--- | :--- |
| **Data Persistence** | Native Chromium File System Access API (`FileSystemFileHandle`) | Cloudflare Worker KV / D1 (flaw: violates client-side privacy, requires backend & auth) | 100% client-side privacy; zero cloud database needed; edits save directly to disk. |
| **Handle Persistence** | Origin IndexedDB (`idbKeyval` pattern) | LocalStorage (flaw: cannot store object handles / DOM exceptions) | Preserves file handle across browser reloads so user reconnects in 1 click. |
| **Disk Change Detection** | Polling `file.lastModified` on 1000ms interval + `window.onfocus` | `FileSystemObserver` only (flaw: experimental Chrome 129+ flag, lacks broad desktop support) | Lightweight stat check with 0% CPU consumption when idle; reliable on all Chromium browsers. |
| **Agent Skill Independence** | Standalone bundle with embedded schema and zero-dep `validate.mjs` | Skill invoking repo CLI `bun run resume` (flaw: fails on PCs without the repository cloned) | Allows installing skill into `~/.pi/skills/resume-studio/` on any machine unconditionally. |
| **Cloudflare Hosting** | Pure Static Cloudflare Pages (`dist/web`) | Cloudflare Pages with Functions / Worker (flaw: adds unnecessary edge runtime complexity) | Lowest latency, zero cost, zero maintenance, zero data egress. |

### Performance Budget

* **Stat check hot path:** `<1ms` per poll check; skips reading text unless `file.lastModified` increases.
* **Text parse & validation:** `<5ms` for typical 15KB `resume.json`.
* **A4 Live Re-render:** `<16ms` (one frame) after valid disk change.
* **Storage footprint:** 0 bytes on Cloudflare. Only static bundles cached at edge.

### Failure Modes & Security

* **Permission Revocation:** When permission is not granted on reload, UI shows `Re-link File` prompt without crashing.
* **JSON Syntax Error on Disk:** If Pi writes incomplete JSON mid-edit, web client catches `JSON.parse` error, displays non-blocking warning pill in editor, and preserves the last valid state without corrupting memory.
* **Concurrent Edit Conflict:** If web form is dirty when disk changes, a modal dialog prompts: `"Disk was modified by an external agent. Discard web edits or overwrite disk?"`
* **Security & Least Privilege:** File System Access API is origin-sandboxed; the web app can only read the explicitly selected file.

---

## File changes

| File | New/Modify/Delete | Change |
| :--- | :--- | :--- |
| `src/web/adapters/filesystem.ts` | New | Chromium File System Access API adapter with IndexedDB handle persistence, permission check, and stat watcher. |
| `src/web/main.ts` | Modify | Mount file sync adapter, handle reconnect on startup, wire live disk reload and write-back, update toolbar status. |
| `index.html` | Modify | Add "Link Local File" action and status indicator pill to the app header. |
| `src/web/styles/editor.css` | Modify | Styles for link file button, connection badge states, and sync notification modals. |
| `skills/resume-studio/SKILL.md` | New | Standalone repo-independent AI agent skill for Pi / Antigravity / Claude Code. |
| `skills/resume-studio/schema.json` | New | Standalone copy of canonical resume schema for portable installation. |
| `skills/resume-studio/validate.mjs` | New | Zero-dependency standalone validator runnable anywhere via `node validate.mjs` or `bun validate.mjs`. |
| `skills/resume-studio/starter.json` | New | Complete valid sample resume document for cold-start editing. |
| `package.json` | Modify | Add `build:pages` and `deploy:pages` scripts. |
| `docs/deployment.md` | New | Complete deployment and installation guide for Cloudflare Pages and Pi skill. |

---

## Phase overview

| Phase | Objective | Dependencies | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Client-side File System Access adapter & IndexedDB persistence | none | complete |
| **Phase 2** | UI integration & live bidirectional sync in editor view | Phase 1 | complete |
| **Phase 3** | Standalone, repo-independent AI agent skill package | none | complete |
| **Phase 4** | Cloudflare Pages deployment configuration & end-to-end verification | Phases 1–3 | complete |

---

## Execution batches

| Batch | Authorized phases | Why these fit together | Dependencies / gates | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Batch 1** | **Phases 1–4** | Complete end-to-end implementation: client-side disk sync adapter, UI controls, portable agent skill, and Cloudflare Pages deployment verification executed together in one cohesive run. | None | complete |

* **Capacity basis / assumptions:** Consolidated single-batch execution authorized by user directive.
* **Safe stopping checkpoints:** Verified phase boundaries at Phase 1, Phase 2, and Phase 3 before final integration in Phase 4.

---

## Implementation phases

### Phase 1: Client-Side File System Access Adapter & Handle Persistence

- **Objective / dependencies:** Build a robust, typed File System Access API adapter with IndexedDB handle caching, permission handling, and stat polling. Dependencies: none.
- **Files / contracts:**
  * Create `src/web/adapters/filesystem.ts` implementing `FileSystemSyncAdapter`.
  * Create `tests/unit/filesystem-adapter.test.ts`.
- **Out of scope:** Modifying `src/web/main.ts` or toolbar DOM (reserved for Phase 2).
- **Steps:**
  - [x] Implement IndexedDB helper in `src/web/adapters/filesystem.ts` to store and retrieve `FileSystemFileHandle` under key `'active_resume_file'`.
  - [x] Implement `isSupported()` checking `'showOpenFilePicker' in window`.
  - [x] Implement `linkFile()` opening picker with `{ accept: { 'application/json': ['.json'] } }`, querying text content, calculating initial revision, and caching handle.
  - [x] Implement `restoreHandle()` verifying `queryPermission({ mode: 'readwrite' })` or requesting permission.
  - [x] Implement `startWatching()` with 1000ms polling interval checking `file.lastModified` and executing immediate check on `window.addEventListener('focus')`.
  - [x] Implement `writeFile()` creating `writableStream`, writing stringified content, and updating `lastModified` cache to prevent self-triggering loops.
  - [x] Implement unit tests in `tests/unit/filesystem-adapter.test.ts` verifying stat change triggers, revision generation, and error fallbacks.
- **Verification:**
  ```bash
  bun run typecheck
  bun run test:unit
  ```
- **Acceptance criteria:**
  * `filesystem.ts` compiles cleanly under strict TypeScript.
  * Unit tests confirm file change events fire when `lastModified` increments.
  * Self-writes update internal `lastModified` cache to prevent feedback loops.

---

### Phase 2: UI Integration & Live Bidirectional Sync in Editor View

- **Objective / dependencies:** Wire the filesystem adapter into the web application, add toolbar controls, handle auto-reconnect, and provide conflict detection. Dependencies: Phase 1.
- **Files / contracts:**
  * Modify `index.html` (header actions, status badge).
  * Modify `src/web/main.ts` (adapter instantiation, store synchronization, modals).
  * Modify `src/web/styles/editor.css` (badge styling).
- **Out of scope:** Standalone skill packaging (Phase 3).
- **Steps:**
  - [x] Add `<button id="btn-sync-file" class="btn btn-secondary">Link File</button>` and `<span id="sync-status" class="badge">` to `index.html`.
  - [x] In `src/web/main.ts`, initialize `FileSystemSyncAdapter` if `!capability` (hosted mode).
  - [x] Wire automatic handle restoration on page load; if permission is granted, load the file directly into `store.loadDocument()`.
  - [x] Connect `startWatching()`: on disk mutation, validate JSON; if valid, update `store.loadDocument(doc, revision, true)`.
  - [x] Add conflict guard: if disk updates while `store.getState().dirty` is true, display a non-blocking modal offering to discard local edits or overwrite disk.
  - [x] Connect "Save to File" button to `adapter.writeFile(JSON.stringify(store.getState().document, null, 2))`.
  - [x] Update header status indicator: `● Linked: resume.json` (green) / `○ Not Linked` (subtle neutral).
- **Verification:**
  ```bash
  bun run build
  bun run test:browser
  ```
- **Acceptance criteria:**
  * Clicking "Link File" opens native file picker and renders resume.
  * Editing `resume.json` externally triggers live preview refresh within 1 second.
  * Saving from UI writes back to disk without console errors.

---

### Phase 3: Standalone, Repo-Independent AI Agent Skill Package

- **Objective / dependencies:** Produce an exportable, self-contained skill directory that can be placed in `~/.pi/skills/resume-studio/` or any AI agent runner on any machine without cloning the repository. Dependencies: none.
- **Files / contracts:**
  * Create `skills/resume-studio/SKILL.md`.
  * Create `skills/resume-studio/schema.json` (standalone copy of [schema/resume.schema.json](file:///Users/pankil/Documents/Projects/resume-studio/schema/resume.schema.json)).
  * Create `skills/resume-studio/validate.mjs` (standalone zero-dependency Node/Bun validator).
  * Create `skills/resume-studio/starter.json`.
- **Out of scope:** Modifying web application code.
- **Steps:**
  - [x] Write `skills/resume-studio/schema.json` with canonical schema definitions.
  - [x] Implement `skills/resume-studio/validate.mjs`: zero-dependency script using native Node/Bun that checks schema structure, required keys, section ordering, character limits, and dates (`YYYY` or `YYYY-MM`).
  - [x] Create `skills/resume-studio/starter.json` containing an ATS-optimized, valid starter resume.
  - [x] Write `skills/resume-studio/SKILL.md` with:
    * Frontmatter (`name: resume-studio`, `description: ...`).
    * Clear guidance: always inspect existing `resume.json`, never invent facts, use strong action verbs and metrics.
    * Page budget rules: 1-page max 3-4 bullets per role; 2-page max 5 bullets.
    * Exact execution command: `bun validate.mjs resume.json` or `node validate.mjs resume.json`.
- **Verification:**
  ```bash
  node skills/resume-studio/validate.mjs skills/resume-studio/starter.json
  bun skills/resume-studio/validate.mjs skills/resume-studio/starter.json
  ```
- **Acceptance criteria:**
  * `validate.mjs` runs with exit code 0 on `starter.json` using standard `node` and `bun` with zero `node_modules` dependencies.
  * `SKILL.md` contains complete self-contained instructions.

---

### Phase 4: Cloudflare Pages Deployment & Verification

- **Objective / dependencies:** Finalize deployment scripts, document setup instructions, and execute full integration verification. Dependencies: Phases 1–3.
- **Files / contracts:**
  * Modify `package.json` (add deployment scripts).
  * Create `docs/deployment.md`.
- **Out of scope:** Modifying backend code.
- **Steps:**
  - [x] Add `"deploy:pages": "bun run build && bunx wrangler pages deploy dist/web --project-name resume-studio"` to `package.json`.
  - [x] Create `docs/deployment.md` detailing:
    * Cloudflare Pages static setup (Framework preset: None, Build command: `bun run build`, Output directory: `dist/web`).
    * Privacy audit: proving zero backend network traffic.
    * How to copy `skills/resume-studio/` to `~/.pi/skills/` on any laptop.
  - [x] Run full project verification suite.
- **Verification:**
  ```bash
  bun run verify
  ```
- **Acceptance criteria:**
  * `bun run verify` passes completely with all unit, cli, and browser tests green.
  * `dist/web` contains only static client-side bundles with zero external dependencies.

---

## Phase completion records

### Phase 1 Completion Record (2026-10-08)
- **Files Created:**
  - `src/web/adapters/filesystem.ts`: Implemented `FileSystemSyncAdapter` adhering to `FileSyncAdapter` interface. Implemented IndexedDB handle cache under database `resume-studio-fs`, store `handles`, key `active_resume_file`. Implemented permission check/query (`readwrite`), stat polling (1000ms + focus event), write-back with `isWriting` guard and `lastModified` cache update, and web-standard SHA-256 revision computation via `crypto.subtle`.
  - `tests/unit/filesystem-adapter.test.ts`: Added unit test suite covering SHA-256 computation, support detection, file linking, permission-checked handle restoration, external stat polling triggers, self-write loop avoidance, and clean disconnects.
- **Verification Commands & Results:**
  - `bun run typecheck`: Passed with 0 errors.
  - `bun run test:unit`: 50 passed, 0 failed across 6 files (including 7/7 passed in `filesystem-adapter.test.ts`).

### Phase 2 Completion Record (2026-10-08)
- **Files Modified:**
  - `index.html`: Added `<span id="sync-status" class="badge badge-hosted" style="display: none;" role="status">○ Not Linked</span>` and `<button id="btn-sync-file" class="btn btn-secondary">Link File</button>`.
  - `src/web/styles/editor.css`: Added `#sync-status` truncation styling keeping headers clean on narrow screens.
  - `src/web/main.ts`: Wired `FileSystemSyncAdapter` in hosted mode (`!capability`). Restores handle on page load, loads clean draft with SHA-256 revision, hooks "Link File" to native picker, starts background stat watcher with `parseResume` syntax guard, opens non-blocking conflict modal on dirty concurrent edits, and attaches "Save to File" write-back.
  - `tests/browser/bridge.test.mjs`: Added assertions verifying `#sync-status` and `#btn-sync-file` in hosted browser mode.
- **Verification Commands & Results:**
  - `bun run build`: Built `dist/web` cleanly in 406ms.
  - `bun run test:browser`: 5 test suites passed (bridge, layout, editor, e2e/security, a11y) with 0 failures.

### Phase 3 Completion Record (2026-10-08)
- **Files Created:**
  - `skills/resume-studio/schema.json`: Standalone copy of canonical resume schema v1.
  - `skills/resume-studio/starter.json`: Complete, ATS-compliant starter resume template.
  - `skills/resume-studio/validate.mjs`: Standalone, zero-dependency Node/Bun validator verifying byte limits (<=128 KiB), JSON syntax, schemaVersion, sectionOrder, unique item IDs, date formats, URL protocols, and length constraints.
  - `skills/resume-studio/SKILL.md`: Self-contained skill specification detailing truth policy, action verbs, page budgets, and installation instructions for Pi, Antigravity, and Claude Code.
- **Verification Commands & Results:**
  - `node skills/resume-studio/validate.mjs skills/resume-studio/starter.json`: Passed (exit 0).
  - `bun skills/resume-studio/validate.mjs skills/resume-studio/starter.json`: Passed (exit 0).
  - `node skills/resume-studio/validate.mjs examples/classic-one-page.json`: Passed (exit 0).
  - `node skills/resume-studio/validate.mjs examples/executive-two-page.json`: Passed (exit 0).

### Phase 4 Completion Record (2026-10-08)
- **Files Created & Modified:**
  - `package.json`: Added `"build:pages": "node scripts/generate-contracts.mjs && vite build"` and `"deploy:pages": "bun run build && bunx wrangler pages deploy dist/web --project-name resume-studio"`.
  - `docs/deployment.md`: Authored deployment guide covering Cloudflare Pages configuration, privacy audit (zero cloud egress/storage), standalone skill setup for Pi and Antigravity, and live agent sync workflow.
- **Verification Commands & Results:**
  - `bun run verify`:
    - `scripts/generate-contracts.mjs --check`: Passed with 0 drift.
    - `tsc` across web, cli, test: Passed with 0 type errors.
    - `test:unit`: 50 passed, 0 failed.
    - `test:cli`: 29 passed, 0 failed.
    - `vite build` + `tsc cli`: Built production assets cleanly.
    - `test:browser`: 5 browser test suites passed in Playwright Chromium.
    - `scripts/check-build.mjs`: Total JS (gzip) 48.87 KiB (budget: 50 KiB), CSS 8.35 KiB (budget: 20 KiB), Total Payload 59.95 KiB (budget: 100 KiB). All 4 static assets strictly allowed. Exit code 0.

---

## Testing & verification

* **TypeScript & Contracts:** `bun run typecheck` and `bun run check:generated`.
* **Unit Tests:** `bun run test:unit`.
* **Browser Tests:** `bun run test:browser`.
* **Standalone Validator Test:** `node skills/resume-studio/validate.mjs skills/resume-studio/starter.json`.
* **Full Verification:** `bun run verify`.

---

## Rollout, migration & rollback

* **Rollout:** Build static bundle via `bun run build`. Deploy `dist/web` directly to Cloudflare Pages.
* **Compatibility:** In browsers without File System Access API (e.g. Firefox), the standard "Open JSON" file input remains fully functional as a fallback.
* **Rollback:** Cloudflare Pages supports instantaneous 1-click rollback to any previous deployment hash.

---

## Risks & open questions

* **Browser Permissions:** Chromium requires explicit user gesture to grant write access to local files. *Mitigation:* Clear UI button prompting the user; graceful read-only state if write access is denied.
* **Non-Chromium Browsers:** Safari and Firefox on desktop do not support the File System Access API. *Mitigation:* Feature-detect `showOpenFilePicker` and display informative fallback message while keeping standard "Open JSON" and "Export JSON" active.
