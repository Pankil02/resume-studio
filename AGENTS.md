# AGENTS.md — openResume

## 1. Product context and approved decisions

openResume is a standalone **Universal AI Coding Agent Skill** and lightweight A4 HTML resume compiler for **Antigravity**, **Pi Agent**, and **Claude Code**. The primary interfaces are chat interactions, local CLI commands (`bin/openresume.mjs`), and file operations—zero web application or hosted services required.

Decisions approved by the owner:
- **Standalone Agent Skill:** The primary surface is the portable, zero-dependency skill directory in `skills/openresume/` containing `SKILL.md`, `schema.json`, `starter.json`, `validate.mjs`, and `render.mjs`.
- **Target Platforms:**
  - Antigravity: Global installation at `~/.gemini/config/skills/openresume` or workspace at `.agents/skills/openresume`.
  - Pi Agent: Global installation at `~/.pi/skills/openresume` or workspace at `.pi/skills/openresume`.
  - Claude Code: Workspace installation at `.agents/skills/openresume` or global at `~/.claude/skills/openresume`.
- **Persistent Personal Profile:** Global user profile persisted in `~/.openresume/` (`profile.md`, `resume.json`, `profile.pdf`) across all coding agent sessions.
- **Zero Runtime Dependencies:** Pure ECMAScript with standard Node/Bun built-ins (`node:fs`, `node:path`, `node:process`, `node:http`, `node:child_process`). No external runtime npm packages or hosted APIs.
- **Two Professional Templates:**
  - `classic`: Canonical single-column serif LaTeX/SWE resume format. Optimal ATS compatibility.
  - `executive`: Two-column layout with prominent left-aligned header, company monogram badges, and right sidebar on Page 1 for skills and credentials.
- **Interactive Preview & Dual-Template Switching:** Standalone compiler (`skills/openresume/render.mjs`) embeds both Classic and Executive views in a single HTML document with a `.no-print` floating toolbar for instant template/accent/margin switching.
- **Deterministic Validation & Rendering:** Standalone validator (`validate.mjs`) checks schema constraints, regex bounds, unique IDs, and page budgets. Standalone compiler (`render.mjs`) compiles resume JSON into a self-contained, printable A4 HTML document with embedded CSS.
- **A4 Print Contract:** Native browser print dialog (`Cmd+P` / `Ctrl+P`) renders selectable-text PDFs with exact `@page { size: A4 portrait; margin: 0; }` geometry, margins none, and scale 100%.
- **Truth Policy:** Never invent companies, dates, qualifications, metrics, contacts, or achievements. Request missing facts or leave optional fields absent; preserve supplied facts.

## 2. Authoritative documents

- **Skill Directives & Workflow:** `skills/openresume/SKILL.md` owns authoritative agent directives, Truth Policy, ATS rules, section ordering, and chat workflows.
- **Schema & Validation:** `skills/openresume/schema.json` owns input validity; `skills/openresume/validate.mjs` is the zero-dependency validator.
- **Template Compiler & Renderer:** `skills/openresume/render.mjs` owns standalone single-file A4 HTML compilation and interactive preview toolbar.
- **Unified CLI:** `bin/openresume.mjs` owns 1-command installation, init, personal profile management, validation, rendering, and live preview server.
- **Skill Installer:** `scripts/install-skill.mjs` and `scripts/install-skill.sh` delegate to `bin/openresume.mjs install`.
- **Deployment & Standalone Guide:** `docs/deployment.md` owns skill architecture documentation and installation instructions.
- **Design System:** `DESIGN.md` owns visual design decisions, tokens, colors, typography, shapes, elevation, and component styling.
- **Execution Plan & Proposals:** `docs/plans/` and `docs/proposals/` provide historical development context.

## 3. Architecture and dependency policy

- Separate pure resume validation/content/layout contracts from browser DOM code and Node filesystem/server adapters.
- Prefer functions, immutable values, discriminated unions, and a typed template registry over class hierarchies, plugin systems, stores, or speculative DDD scaffolding.
- Browser runtime: native DOM, CSS, File/Blob/URL, browser storage, ResizeObserver, and `window.print()`.
- Local runtime: Node.js 24 LTS, native argument parsing, HTTP, filesystem, crypto, and path utilities. Compile the CLI to ordinary ESM JavaScript; no ts-node/tsx runtime requirement.
- Proposed development dependencies: TypeScript, Vite, Node types, Ajv for build-time standalone schema validation, json-schema-to-typescript for generated types, and Playwright for test-only browser verification. Pin compatible versions and commit the lockfile during implementation.
- No React, Svelte, Next.js, Tailwind, UI kit, database, hosted Worker, Durable Object, KV, R2, service worker, analytics, external fonts, remote assets, PDF rasterization, or headless-browser runtime dependency in v1.
- Revisit dependencies only for demonstrated requirements; document the reason, browser cost, and alternative. No network dependency may receive resume content.
- Design and UI/UX Policy: All user interface and visual styling changes must strictly follow `DESIGN.md`. Agents modifying HTML, CSS, components, or layout must use the tokens, warm-dark canvas palette (`#2b2622`, `#383330`, `#3f3a36`), off-white primary CTA (`#f7f5f0`), typography (Inter, DM Mono, Instrument Serif), tight radii (3px buttons, 4px cards), and elevation rules specified in `DESIGN.md`. Never introduce unapproved chromatic accents, soft drop-shadows, or arbitrary framework kits.

## 4. Resume and agent safety

- Resume content is untrusted personal data. No HTML or Markdown interpretation, scripts, CSS strings, data URLs, or arbitrary file paths inside resume JSON.
- Never invent companies, dates, qualifications, metrics, contacts, or achievements. Request missing facts or leave optional fields absent; preserve supplied facts.
- Agents read the schema and content guide before substantive edits, validate afterwards, inspect fit warnings, and obtain user confirmation for meaning-changing rewrites.
- Source JSON is authoritative; generated HTML/PDF is an output, not an editable source.
- Stable item IDs survive edits/reordering. Presentation metadata must not alter factual content.
- Validation has hard structural/security limits; editorial word/character targets are warnings. Character/word counts cannot guarantee page fit; measure rendered layout after fonts settle.
- Document files are outside the published asset tree. Never ship real resumes, backups, drafts, `.env*`, credentials, logs containing PII, or `node_modules` in `dist/web`.
- Every sample/fixture is obviously synthetic and includes no real personal contact details.

## 5. Local server, concurrency, and privacy

- Preview binds only to `127.0.0.1`, port 0 by default; never `0.0.0.0` or a LAN address.
- Serve only built public assets and one explicitly selected JSON document. No directory browsing, generic file endpoint, or arbitrary path body/query fields.
- Random per-session capability; authenticate document/events/save routes; exact Host/Origin checks, no CORS wildcard, strict body limits. Establish credentials through a fragment bootstrap and in-memory bearer token; remove the fragment immediately, never log it or resume content.
- Browser saves include the exact loaded revision. Stale writes return a conflict and preserve the browser draft. Changed source files reload only clean drafts; dirty drafts require an explicit user choice.
- A single cooperative writer lock guards local CLI/server writes. All participating writers lock, reread, compare revisions, validate, back up, write a sibling temporary file, and atomically replace. Do not claim arbitrary external editors obey this protocol.
- Never silently overwrite a file changed by an external agent/editor. Before writing, reread and compare; retain a backup. A non-cooperating writer can still race atomic replacement: state this residual limitation and recommend the CLI for concurrent editing.
- Do not follow document symlinks or serve symlinked asset escapes. Reject protected paths and unsafe file types. Refuse unknown schema versions and malformed input without modifying files.
- Backups contain PII: same restricted directory/permissions, bounded retention, explicit cleanup, never deployment. Browser drafts are not encrypted; warn users on shared devices.
- Hosted mode must have no document upload, editing endpoint, cloud storage, or session/authentication service. Its only network traffic is static application asset loading.

## 6. A4, templates, and PDF contract

- Canonical printable pages are 210 × 297 mm with internal margins and shared print/screen layout. Preview scaling is outside the page geometry; print removes the scaling and editor chrome.
- Two templates: `classic` (single-column LaTeX/SWE format, ATS-first) and `executive` (two-column layout with compact sidebar on Page 1; carries ATS sidebar caveat).
- One-page or two-page maximum is an explicit document setting. Overflow blocks the in-app print action and shows actionable issues; never delete content or reduce below the approved minimum type size.
- Standalone compiler `render.mjs` outputs exact printable A4 HTML with embedded CSS, inlined SVG icons, and `@page { size: A4 portrait; margin: 0; }`.
- PDF export must preserve selectable text and hyperlinks. Users choose A4, 100% scale, no browser headers/footers, and margins none in the native print dialog (`Cmd+P` / `Ctrl+P`).

## 7. Implementation and verification protocol

- Implement only the batch and exact phase range authorized by the current user prompt; planning documents do not authorize all implementation automatically.
- Read this file and the execution plan first. Inspect actual files/state before changes. Do not rely on earlier chat history.
- Verify each phase before starting the next. Update checkboxes, phase/batch status, and append completion evidence in the plan.
- Stop when a gate fails or reality contradicts a decision. Report the conflict; do not silently expand scope, weaken security, or substitute a heavier stack.
- Checkpoint at a verified boundary under context pressure. If blocked mid-phase, capture partial work and return a bounded resume prompt starting at the first incomplete phase.
- Every handoff returns actual completed work, exact commands/results, remaining prerequisites, and a new-chat prompt with the next authorized range and these same rules.
- Never claim unrun checks passed. Never commit, deploy, install globally, overwrite user documents, or initialize git automatically.
- Final gates include strict type checks, generated-contract drift checks, unit/CLI/server tests, browser/a11y/layout tests, synthetic-only deployment assets, performance measurements, DESIGN.md visual compliance, and a manual print checklist.

## 8. Scope-change approval gates

Obtain owner approval before adding: hosted editing/storage, MCP, unattended PDF export, AI APIs, OCR/PDF import, photos, languages/RTL, more than two pages, third-party asset calls, authentication/accounts, cloud persistence, or a framework. Git initialization and Cloudflare account/DNS deployment also require explicit authorization.

## 9. Delegation

Follow the active operator/harness delegation policy. This project does not independently authorize writer subagents, parallel writes, reviewers, remote research, or cloud actions. If delegated exploration is authorized, use bounded read-only tasks and return concise evidence rather than raw logs.
