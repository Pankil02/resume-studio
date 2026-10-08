# AGENTS.md — Resume Studio

## 1. Product context and approved decisions

Resume Studio is a separate, ultra-lightweight, local-first professional resume editor and A4 HTML viewer. Local coding agents (Claude Code, Pi, Antigravity, Codex, and similar tools) update structured JSON through ordinary file operations or a local CLI. Users edit through a browser form, switch professional templates, inspect exact A4 pages, and save a selectable-text PDF through the browser print dialog.

Decisions approved by the owner on 2026-10-06:
- Standalone project: `/Users/pankil/Documents/Projects/resume-studio`; do not modify the neighboring AgentSkills repository.
- Static HTML/CSS + TypeScript; Vite build; no UI framework or hosted backend.
- Deploy public application assets to Cloudflare Pages.
- Resume JSON files plus a local CLI are the agent interface. No AI-provider API integration, API keys, remote agent API, or mandatory MCP.
- Browser form editor plus live A4 preview. PDF uses browser Print / Save as PDF, not automatic binary generation.
- Explicit JSON import/export is the durable hosted workflow. Drafts remain in memory by default; device autosave is opt-in with a clear-data control.
- Local preview may use a narrowly scoped loopback-only save bridge. Agents do not need to call its HTTP endpoints. Browser saves require authentication, origin checks, validation, and optimistic concurrency.
- Three templates: `classic`, `modern`, `executive`. The first two are single-column and ATS-first; `executive` is two-column and carries an explicit reading-order/ATS caveat.
- English, A4 portrait, one or two pages, no photos. Visible overflow warnings; never silently shrink text, clip content, or invent qualifications.
- This initial work is planning only. No application code, dependencies, git initialization, deployment, or secrets are authorized by the planning request.

## 2. Authoritative documents

- Design system: `DESIGN.md` owns all UI/UX design decisions, tokens, colors, typography, shapes, elevation, and component styling. Any agent modifying or adding user interface elements, styling, layouts, or visual components must strictly follow `DESIGN.md`.
- Execution plan: `docs/plans/2026-10-06-resume-studio.md`.
- Proposal entry point: `docs/proposals/2026-10-06-resume-studio/proposal.md`.
- Proposal sections explain requirements, alternatives, architecture, contracts, performance, risks, and delivery. The execution plan owns phase status, exact implementation steps, and handoffs.
- After implementation, `schema/resume.schema.json` owns input validity; generated types/validators derive from it. `docs/agent-guide.md` owns the agent workflow, `docs/content-guide.md` owns editorial recommendations, and `docs/printing.md` owns supported PDF settings.
- Existing code is absent at planning time. Planned paths and performance budgets are proposals, not observations.

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
- Templates use a common measured pagination pipeline. Split only at legal semantic boundaries; keep section headings with content and role headings with the first bullet; never split one bullet into different pages.
- One-page or two-page maximum is an explicit document setting. Overflow blocks the in-app print action and shows actionable issues; never delete content or reduce below the approved minimum type size.
- `executive` uses a single primary reading column and a compact first-page sidebar; spillover policy is specified in the plan. Do not promise universal ATS parsing for any layout.
- PDF export must preserve text and hyperlinks. Use honest button labels such as `Print / Save PDF`; users must choose A4, 100% scale, no browser headers/footers, and margins none.
- Browser-native printing is user-mediated. No promise of unattended download or identical output on every browser. Chromium desktop is the initial reference; Firefox/Safari require recorded manual print checks.

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
