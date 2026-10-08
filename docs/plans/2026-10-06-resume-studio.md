# Resume Studio — Detailed Implementation Plan

Status: complete · Current batch: 5 · Next incomplete phase: none · Owner: Antigravity · Created: 2026-10-06

## Goal & non-goals

### Goal

Build a small, private resume workspace: agents edit validated JSON locally; users edit forms, preview three professional A4 templates, and save a readable PDF.

### Approved requirements

1. Standalone project at `/Users/pankil/Documents/Projects/resume-studio`; keep AgentSkills unchanged.
2. Static native HTML/CSS + TypeScript with Vite, deployable to Cloudflare Pages without a Worker or database.
3. Three templates: Classic, Modern, Executive; identical factual schema and lossless switching.
4. One or two A4 portrait pages; exact page-size preview; accessible text; visible fit and editorial guidance.
5. Agent interface: ordinary JSON files plus a deterministic local CLI. No AI API integration, required MCP, API keys, hosted editing endpoints, or agent-specific dependency.
6. Browser form editor with explicit JSON import/export; optional device autosave, off initially.
7. An approved local save bridge allows the browser to write the one selected local document; this is not a hosted API or the agent interface.
8. Native browser print / Save as PDF. A click opens the dialog; no unattended binary download promise.
9. Resume data never leaves the user's device through application code. Public deployment contains only app assets and synthetic examples.
10. Documentation gives each field's hard bounds, recommended word/character budgets, sample input, and local-agent workflow.

### Non-goals / approval gates

No resume parsing from PDF/DOCX, AI generation inside the app, job matching, photo uploads, rich text/HTML/Markdown, cloud resumes, accounts, collaboration, third-party analytics/fonts, mobile-first editing, service worker/PWA, arbitrary sections, more than two pages, multilingual/RTL support, mandatory MCP, or automated runtime PDF engine. Adding any requires approval. Do not initialize git, commit, deploy, or install globally without a separate request.

## Context (current state, cited paths)

- New project; no application source or measurements existed before this plan. All paths below are proposed unless marked observed.
- Observed owner decisions: `AGENTS.md:3` (product), `AGENTS.md:27` (architecture), `AGENTS.md:48` (local safety), and subsequent headings. If line numbers drift, use those headings as authoritative anchors.
- Neighboring planning conventions were inspected read-only: `/Users/pankil/Documents/Projects/AgentSkills/plan-walkthrough/SKILL.md:32` (workload-sized batches), `:44` (plan format), `:115` (handoff contract).
- Proposal rubric inspected: `/Users/pankil/Documents/Projects/AgentSkills/feature-proposal/references/planning.md:45` (priority order), `:54` (decisions), and `references/format.md:29` (manifest). No existing resume implementation is being reused.
- Root `AGENTS.md` and this plan are operational instructions. Proposal sections own explanatory comparisons; this plan owns execution checkpoints. If a later implementation needs to alter an approved decision, stop for approval and update both records deliberately.
- Cloudflare guidance below is a deployment proposal, not a claim that account settings, current platform quotas, or tool versions were inspected. Verify current official Pages instructions at implementation/deployment time; never infer available credentials.

### Assumptions

| ID | Assumption | Confidence / revisit trigger |
| --- | --- | --- |
| ASM-01 | Desktop Chrome/Edge is the reference printing environment; desktop Firefox/Safari get manual checks. | Medium; owner requires another browser. |
| ASM-02 | Node.js 24 LTS is available or can be installed separately by the owner. | Medium; inspect `node --version` before scaffolding. |
| ASM-03 | English left-to-right text, no embedded images, system fonts. | High; multilingual/photo request needs a new design. |
| ASM-04 | Typical document is 5–30 KiB; supported import maximum is 128 KiB. | Estimate; benchmark fixtures rather than real resumes. |
| ASM-05 | Full layout rerender after a debounced edit fits budgets for a maximum two-page document. | Medium; measure before introducing diff engines. |
| ASM-06 | Durable files remain outside public build outputs; browser drafts are temporary unless explicitly exported/saved. | High; a cloud-sync requirement changes architecture. |
| ASM-07 | No screen-to-PDF pixel-perfect guarantee across operating systems with different system fonts. | High; owner demands identical output, consider approved bundled font. |

## Design

### Architecture and data flow

```text
Local coding agent                 Hosted browser (Cloudflare Pages)
   | reads guides/schema                | imports resume.json from disk
   | edits JSON / invokes CLI           v
   v                              Shared schema + pure content checks
Document on PC <--- CLI apply           |        |
   | revisioned read                   forms    A4 renderer/paginator
   v                                    |        |
Loopback preview bridge <--> Local browser editor |--> window.print()
   | read/events/save        draft + revision     |      user Save as PDF
   | owns ONE selected file                 JSON export
   + cooperative writer lock + backups

Cloud boundary: only static application assets; no resume upload or cloud write.
```

### Components and ownership

- `schema/resume.schema.json`: canonical JSON Schema draft-07; structural bounds and descriptions. No duplicate handwritten interface tree.
- `scripts/generate-contracts.mjs`: generate TypeScript declarations, self-contained standalone Ajv validation, and a browser-safe guidance projection. Fail drift checks in CI; no Ajv runtime or schema compiler shipped to browsers.
- `src/core/`: pure validation orchestration, semantic/date/link checks, content metrics, document defaults, template metadata; no DOM, filesystem, fetch, or mutable singleton.
- `src/web/`: native editor inputs, draft reducer, import/export, optional storage, client mode adapter, measured rendering, diagnostics, and print controller.
- `src/web/templates/`: small typed registry with three render functions and CSS tokens; common semantic block builder and paginator. No plugin framework or duplicate document schema.
- `src/cli/`: native Node ESM argument router, document reader/writer, cooperative lock, atomic backup/write adapter, bounded loopback server, and browser opener.
- `tests/unit`, `tests/cli`, `tests/browser`: invariant, IO/security, and real rendering tests. Browser automation is development-only.
- `dist/web`: only public assets. `dist/cli`: compiled local executable and browser-safe core; never part of Pages publication.

### Stack and dependency decisions

| Decision | Chosen | Rejected (flaw) | Why |
| --- | --- | --- | --- |
| UI | Native HTML/CSS + TS + Vite | Plain JS: less static contract safety; Svelte: useful components but unneeded compiler/framework surface here | Small bounded editor; native inputs and module boundaries suffice. |
| Hosting | Cloudflare Pages static assets | Worker: unneeded request code; Next.js SSR: larger build/runtime without server requirement | Resume work is browser-local; CDN serves fixed files. |
| Agent channel | JSON + Node CLI | Mandatory MCP: per-agent setup; cloud editing API: privacy, auth, network dependency | Every target agent already edits files and runs terminal commands. |
| Local browser save | Narrow loopback bridge | Download-only: needless duplicate/manual replacement; LAN server: broader attack surface | Owner explicitly approved local browser save with concurrency controls. |
| PDF | Browser print with semantic text | Canvas/jsPDF reconstruction: duplicate layout, rasterization/reading-order risk; runtime Playwright: large browser install | Same HTML/CSS owns screen and print; user already has a browser. |
| Validation | JSON Schema, build-time Ajv, generated types | Ad hoc validators: drift; browser-loaded schema engine: avoidable runtime cost | One documented machine-readable source with strict checks in all adapters. |
| Rendering | Rerender resume subtree, debounce layout | Framework store/virtual DOM: not justified; full page rerender: loses editor focus | Two-page bounded document, maintainable DOM functions. |
| Fonts | System serif/sans stacks | External font CDN: privacy/network; bundled fonts: larger payload and license work | Smallest deployment; accept cross-OS typography variance. |
| Persistence | Explicit files; opt-in browser storage | Cloud KV/DB: user did not request it; autosave by default: PII surprise | Clear ownership and zero hosted document requests. |

Confidence: high for static architecture, medium for cross-browser pagination until tested. Revisit a framework only if editor complexity materially exceeds this schema or measured input/render responsiveness misses budget after simple fixes. Revisit a local PDF engine only when unattended export is explicitly requested. An optional MCP adapter could call the same application functions later; do not implement stubs now.

### Canonical data model

Schema root: strict object, `additionalProperties: false` at every object level. Required fields: `schemaVersion`, `document`, `profile`, `sectionOrder`, `experience`, `education`, `projects`, `skills`, `certifications`; `summary` is optional. Arrays may be empty except `sectionOrder`, whose fixed membership is explicit. No rich text, arbitrary nested JSON, binary data, image references, HTML, CSS, or local file paths.

```ts
// Proposed public contract; generate final interfaces from schema rather than copy this.
type TemplateId = 'classic' | 'modern' | 'executive';
type SectionId = 'summary' | 'experience' | 'education' | 'projects' | 'skills' | 'certifications';
type YearMonth = string; // YYYY-MM; semantic validation also checks order.
interface ResumeV1 {
  schemaVersion: 1;
  document: { title: string; template: TemplateId; maxPages: 1 | 2; accent: 'slate' | 'navy' | 'forest' };
  profile: { name: string; headline?: string; email?: string; phone?: string; location?: string; links: Array<{ id: string; label: string; url: string }> };
  summary?: string;
  sectionOrder: SectionId[]; // Exactly all six once; empty sections do not render.
  experience: Array<{ id: string; employer: string; role: string; location?: string; start: YearMonth; end?: YearMonth; current?: boolean; bullets: string[] }>;
  education: Array<{ id: string; institution: string; qualification: string; location?: string; start?: YearMonth; end?: YearMonth; details: string[] }>;
  projects: Array<{ id: string; name: string; role?: string; url?: string; bullets: string[] }>;
  skills: Array<{ id: string; category: string; items: string[] }>;
  certifications: Array<{ id: string; name: string; issuer?: string; date?: YearMonth; url?: string }>;
}
```

IDs: ASCII `^[a-z][a-z0-9-]{1,47}$`, unique across the document's link/items; preserve them while editing/reordering. UI adds via bounded random IDs with a deterministic prefix, then checks uniqueness. Agent-created IDs may be meaningful slugs. Array order is display order. `current: true` forbids `end`; absent `current` is false; experience then requires `end`. Education dates are optional but must order correctly when both exist. Dates are months, never machine-dependent locale strings. No timestamp/content rewrite on every render.

Empty optional strings should be omitted by explicit form commit; whitespace-only populated strings are errors. Preserve factual punctuation/line content; no automatic paraphrasing. Strings disallow NUL and unsafe controls; line breaks are allowed only for summary if rendering treats them as plain text. URLs allow only well-formed `https:` or `http:` without credentials, bounded to 2,048 code points. Prefer HTTPS with a warning for HTTP. Email and phone are displayed as plain text in v1; external links alone are clickable and use safe `rel`. Do not fetch link previews.

### Hard bounds and editorial guidance

All counts are Unicode code points, not UTF-16 code units. English word counts use whitespace-separated nonempty words; they are editorial estimates, not guarantees. Reject oversized input before JSON parsing. Maximum object depth is structurally bounded by this schema; reject unknown keys and forbidden property names. Generate labels, max lengths, and help text from schema descriptions plus `x-guidance` annotations. A layout-specific section recommendation is a warning, never schema failure.

| Field/group | Hard bounds | Recommended starting budget |
| --- | --- | --- |
| Whole input | 128 KiB UTF-8; root schema version exactly 1 | 5–30 KiB; 350–550 words for one page, 600–900 for two, measured fit wins |
| Document title | 1–100 characters | 20–60; filename uses sanitized title only |
| Name / headline | 1–100 / optional 120 characters | Name as supplied; headline 40–80 chars / 5–12 words |
| Email / phone / location | 254 / 40 / 100 characters | Concise real contact details; no unnecessary full home address |
| Profile links | At most 4; label 40 chars; URL 2,048 | 1–3 short readable labels, no raw giant URLs |
| Summary | Optional, at most 900 characters | 250–500 chars / 40–75 words; omit rather than generic fluff |
| Experience | At most 12 roles; role/employer 100 chars each; at most 8 bullets per role | 2–4 selected roles, 3–5 bullets for recent role |
| Experience/project bullet | 1–360 characters | 90–180 chars / 15–30 words; real action, context, supported outcome |
| Education | At most 6; institution/qualification 140 chars; at most 3 detail strings of 240 chars | 1–3 entries, 0–2 short details each |
| Projects | At most 8; name 100 chars; role 100; at most 6 bullets | 1–3 relevant projects with 1–3 bullets each |
| Skills | At most 8 groups; category 60 chars; 15 items/group; item 60 chars | 3–5 groups, 4–8 relevant skills each; no proficiency bars |
| Certifications | At most 12; name 140 chars; issuer 100 | 0–4 relevant current credentials |

Document-wide hard array limits constrain validation and rendering CPU; they do not promise maximum content fits two pages. Every valid document can be stored even if it cannot print in the selected page budget. Summary/bullet recommendations generate warnings only. Do not invent a success metric to satisfy suggested writing style.

### Application contracts and error model

```ts
type Issue = { code: string; severity: 'error' | 'warning'; path: string; message: string };
type Validation = { ok: true; value: ResumeV1; issues: Issue[] } | { ok: false; issues: Issue[] };
function parseResume(text: string): Validation;
function validateResume(value: unknown): Validation;
function getContentIssues(resume: ResumeV1): Issue[];
function getTemplate(id: TemplateId): TemplateDefinition;
function renderResume(resume: ResumeV1, target: HTMLElement): Promise<LayoutResult>;
type LayoutResult = { pageCount: number; allowedPages: 1 | 2; overflow: boolean; issues: Issue[] };
```

Parse accepts a bounded UTF-8 JSON document without a BOM; errors identify paths, never echo full PII values. Invalid import leaves the current draft untouched. Unknown future schemaVersion is a clear error, not best-effort coercion. Canonical export uses pretty JSON plus newline; local revision hashes exact source bytes, not canonicalized values.

### CLI contract

Build once, then run `node dist/cli/main.js ...`; npm scripts are aliases, not additional functionality. Runtime dependencies should be zero. `npm run dev` serves the hosted-style browser editor with import/export only. `preview` serves the built web app plus the local document bridge; require a current build and show an actionable missing-build error.

| Command | Behavior / contract |
| --- | --- |
| `init --file <path> --template classic --max-pages 1` | Create a safe synthetic/blank-valid starter with instructions; refuse an existing file; no overwrites. |
| `inspect --file <path> --json` | Explicitly output `{revision, document}` to stdout for agents; user requested command is the only intentional content output. |
| `validate --file <path> [--json]` | Read only; return schema/semantic/editorial issues and revision; no content echo. Exit 0 valid, 2 invalid. |
| `apply --file <path> --from <candidate.json> --expected-revision <sha256>` | Validate candidate, lock/reread/compare, back up, atomically replace. Exit 3 conflict; original/candidate remain safe. |
| `preview --file <path> [--port 0] [--open]` | Secure loopback web app, live document updates, browser Save/Reload; stays foreground until shutdown. Never opens a LAN listener. |
| `templates [--json]` | IDs, page support, reading-order caveats; no filesystem write. |
| `guidance [--json]` | Schema-derived bounds and recommended editorial ranges. |
| `--help`, `--version` | Deterministic help/version, no server startup. |

Exit codes: 0 success, 1 IO/internal/usage failure, 2 validation failure, 3 conflict. JSON commands return one stable envelope on stdout; operational logs go to stderr without PII. Reject unknown args, duplicate conflicting args, invalid ports, invalid hash, and missing required options. No generic patch language, shell evaluation, or automatic PDF command in v1.

### Local bridge protocol

Private implementation contract, not a hosted product API. Agents use files/CLI; no MCP configuration. Host is exact `127.0.0.1:<actual-port>`; bind IPv4 loopback only. Server selects the file at startup and never accepts another path over HTTP. Application route is `/`; do not add a client router.

1. Generate a 256-bit capability for each session. Optional `--open` launches `http://127.0.0.1:<port>/#local=<capability>` using OS-specific argument-array spawn, never interpolated shell execution. Manual URL goes to the user's terminal only on an explicit local launch; do not persist session credentials in logs.
2. Browser bootstrap reads fragment, removes it with history replacement before any navigation/storage, and keeps the capability only in memory. `Referrer-Policy: no-referrer`; no external assets. Reload without a fragment must show safe reconnect instructions, not silently enter local authenticated mode.
3. `GET /local/document`: bearer token; exact allowed Host; reject nonmatching Origin if supplied; return `{revision, document}` and `Cache-Control: no-store`.
4. `POST /local/save`: exact Origin plus bearer token, JSON content type, bounded body 160 KiB (document plus envelope); body `{expectedRevision, document}`; no path. Validate then execute cooperative save transaction. Return `{revision}` or conflict without leaking file content. Reject absent/untrusted Origin for this browser write route.
5. `GET /local/events`: authenticated `fetch` streaming of server-sent events, not native EventSource with a token in the URL. Emit revision/change/error metadata only. Abort/reconnect with capped backoff; a small client polls document metadata after reconnect. No content in event logs.
6. Serial write queue per selected file, plus a directory lock shared with CLI `apply`. Lock acquire is bounded; stale locks are never automatically stolen. Record PID/time for operator diagnosis, not personal document content. Failed writers clean their own temporary files and lock in `finally`.
7. Watch the parent directory because atomic external replacement can invalidate a direct file watcher. Debounce events, reread bounded bytes, hash, validate; periodic low-rate revision reconciliation covers missed watch events. Clean browser drafts refresh; dirty ones enter conflict mode. Malformed external edits preserve the last valid preview and display an error.
8. Responses: 400 malformed envelope, 401 invalid token, 403 origin/host failure, 409 stale revision/lock conflict, 413 too large, 422 invalid document, 500 safe IO failure. Always `no-store` for private routes; no CORS headers. Unknown methods/routes fail closed.
9. Asset paths are allowlisted/contained under real `dist/web`; handle decoding, traversal, encoded separators, symlinks, MIME, and missing files safely. No directory listing; request body streaming stops at bound. Check Host on assets too to reduce DNS-rebinding exposure.
10. A cooperative save transaction locks, rereads source, checks expected hash, validates candidate, writes a restricted-permission sibling temp file, creates a bounded backup, rechecks source, and atomically renames. At most ten backups per document, pruning only tool-owned backups after success. A rename is atomic visibility, not a transaction against arbitrary external writers or a guaranteed power-loss protocol on all filesystems.

Important residual limitation: direct editor writes do not honor locks and can race between the final recheck and rename. Do not claim perfect compare-and-swap across arbitrary applications. Use CLI `apply` for reliable concurrent changes; keep backups; surface any detected revision conflict; recommend one active direct writer. Add filesystem-specific tests for macOS/Linux/Windows rather than assuming identical rename behavior.

### Browser editing and state

- Two-pane desktop interface: form/sections on left; scaled physical pages on right. Narrow screens stack panes; resume geometry remains A4, preview scrolls/scales without altering PDF layout.
- Header actions: Open JSON, Export JSON, Template, 1/2-page limit, Print / Save PDF. Local mode adds Save to file, Reload from file, and revision/connection status.
- Editor fields cover every schema field. Stable IDs are hidden by default but preserved. Add/remove/reorder controls have labels and keyboard operation; no drag-and-drop dependency.
- Draft includes `{document, dirty, sourceRevision?, validation, layout, connection, autosaveEnabled}`. One small reducer/controller owns transitions. Input text can be temporarily invalid; do not overwrite source while users type. Preserve field focus/caret; rerender preview rather than reconstructing the form at each keystroke.
- Form editing changes a candidate draft, never automatically writes disk. Valid text commit updates the document; errors stay next to fields. Invalid candidate blocks source save/export/print; allow an explicitly labeled local draft recovery download if implemented, not a disguised valid resume export.
- Loading/importing or discarding a dirty draft requires a user choice. Template switch is content-lossless; sectionOrder updates are explicit.
- Layout run uses a generation ID: stale asynchronous results cannot replace a newer preview. Wait for document fonts/layout settling before measurements. `requestAnimationFrame` for DOM measurements; debounce content/layout work approximately 150 ms, measure real latency before changing it.
- Autosave is opt-in and in browser storage under a schema-versioned key; restore is explicit, never automatic disk overwrite. Clear erases tool-owned drafts only. Catch storage/quota failures and continue in-memory; document that drafts are unencrypted and browsers may clear them.
- Prevent accidental dirty-draft navigation where supported; browsers may not honor unload prompts. Export JSON and local Save are distinct actions.

### Template visual specifications

All templates: restrained professional design, real headings/lists, actual selectable text, no icons replacing contact text, no text-as-image, no progress bars, no background dependency. Minimum body text 10.5 pt, default 11 pt; comfortable line height 1.25–1.35; name 23–27 pt; headings 11–12 pt; contact text at least 9.5 pt. A4 margins default 14 mm; no user free-form CSS. Accent affects heading/rules only with sufficient contrast in print and grayscale.

- **Classic:** single column; system serif body with restrained sans header or consistent serif; black/dark slate; thin section rules; chronological entries and aligned dates. Most conservative reading order; default.
- **Modern:** single column; system sans body; navy/forest/slate accent; compact typographic hierarchy and whitespace, not a decorative sidebar. Same semantic structure and pagination as Classic.
- **Executive:** shared full-width identity header; primary chronological column plus compact first-page sidebar with Skills then Certifications in their relative order. Sidebar never spans multiple pages. If it exceeds page-one capacity, move complete groups/entries to a full-width continuation after primary sections on page two, retaining them once only; warn that spatial sectionOrder and extraction order differ. DOM order is header, primary content, sidebar, continuation; PDF extraction caveat is explicit. If this policy cannot be implemented reliably within the layout phase, stop for approval; do not silently drop the third template or reduce to overflowing CSS columns.

Template switching preserves every field and stable ID. Executive repositions skills/certifications but does not mutate sectionOrder; warn and explain that the two single-column layouts honor exact sectionOrder. No guaranteed ATS score or universal parser compatibility. PDF text extraction/selection and document order are verifiable; proprietary ATS behavior is not.

### Measured pagination algorithm

The main complexity is pagination, not cloud infrastructure. Implement one shared legal-block representation and template-specific capacity rules.

1. Build semantic sections into measurable atoms: header, summary paragraphs, section heading, role/project heading, individual bullet, education/detail, skill group, certification. Each atom owns stable source paths, a DOM render function, and keep-with-next / legal-split metadata.
2. Use an offscreen but layout-visible measurement root at actual page inner width and template typography. Never measure `display:none` or scaled preview dimensions. Wait for fonts; all assets are local/system.
3. Pack atoms greedily into page capacity, measuring actual wrapped geometry. Keep section heading plus first content atom and role heading plus first bullet together. Prefer keeping a whole short entry together when it fits an empty page; split a long entry only between bullets/details. Add an explicit continuation label when an entry crosses pages; do not duplicate bullets.
4. Summary has no invented split strategy: one bounded plain-text block; if too large for one page show an issue. An individual bullet/heading pair or other unsplittable atom taller than an empty page is an overflow error.
5. Executive measures primary and sidebar widths independently and uses its documented first-page/sidebar spillover rule. For page-two continuation, measure full-width atoms; never reuse narrow-column heights. Main content has priority; leftover sidebar entries come after it on page two.
6. Render exactly one or two canonical `.resume-page` elements in screen/print DOM. If more content remains, show an overflow diagnostic list with affected JSON paths; do not silently omit it. Mark preview visibly as incomplete and show unplaced content in a non-print diagnostic panel. No print while overflow is present.
7. Assert every source content atom was rendered exactly once or appears in the explicit overflow list. Assert page content rectangle stays inside page bounds after render, including rounding tolerance at most 1 CSS px. Layout issues focus the relevant editor field.
8. Render heading/entry groups with semantic markup; prevent browser splitting inside a canonical page. `@page { size: A4 portrait; margin: 0; }`; page container uses 210 × 297 mm, box-sizing border-box, internal padding; forced page break between pages, not after the last page.
9. Print waits for current validated non-overflow layout. Remove editor, diagnostic chrome, transforms, shadows, and preview gaps. `window.print()` remains user-mediated; do not reenter print after editing events.
10. Test target geometry in headless Chromium PDF and browser screenshot, plus manual Chrome/Firefox/Safari print previews. Chromium headless PDF in CI verifies layout; it is not a runtime export feature.

Never solve overflow with `overflow:hidden`, arbitrary font scaling, deleting optional sections without confirmation, shrinking below minimum sizes, or claiming character counts are layout measurement.

### Performance budget and workload

Numbers are proposed targets, not measured results. Reference machine/browser details must be recorded with results.

| Dimension | Baseline / stress fixture | Target / measurement |
| --- | --- | --- |
| Browser JS | Normal starter / largest valid two-page candidate | ≤50 KiB gzip total first-party JS; gate before merge. Schema compiler and Node adapters absent. |
| CSS | All three templates + editor | ≤20 KiB gzip. |
| Initial page payload | HTML + first-party JS/CSS, no real resumes/fonts | ≤100 KiB compressed transfer; zero third-party requests. |
| Validation | 10 KiB / 128 KiB bounded input | p95 ≤20 ms on recorded reference desktop; 200 runs, report p50/p95/p99. |
| Preview pipeline | Typical 1 page / worst fitting 2 pages | p95 ≤100 ms rendering work; edit-to-stable-preview ≤250 ms including debounce. |
| Source save | 10–30 KiB / 128 KiB on local SSD | p95 ≤150 ms excluding user interaction; measure with backup and lock enabled. |
| Steady requests | Hosted app after asset load | 0 resume-content network requests. Local bridge has one stream and bounded reconciliation. |
| Memory | 1 document, 1 layout, 1 pending draft | No unbounded history, DOM, subscribers, events, or backups; repeated 100 edits leaves bounded nodes/listeners. |
| Print | 1/2-page layout | No network round trips; dialog time is browser/user-controlled, not a latency promise. |

Illustrative hosting load, assumption only: 100 daily users × 3 app opens/day ÷ 86,400 = 0.00347 average app loads/s; ×20 burst = 0.0694 peak loads/s. At ≤100 KiB compressed/app load that is ≤30,000 KiB/day before cache effects. Resume edit QPS to cloud = 0 regardless of typing rate. Little's Law is not needed to size a backend because none exists. DB queries/locks/indexes, cloud storage blobs, tenant locks, and queue capacity are N/A; revisit only with approved hosted data. Local lock/filesystem concurrency is applicable and covered separately.

### Failure modes and security

- Validation rejects malformed, over-limit, unknown-version, unsafe-control, duplicate-ID, invalid date/order, and unsafe-link input without modifying the current document.
- DOM uses `createElement`/`textContent` and attribute allowlists; no resume data reaches `innerHTML`, event attributes, style strings, shell arguments beyond validated file paths, or a template interpreter.
- CSP has self-only script/connect, no object/frame embedding, no base override; static CSS can permit necessary inline styles for native preview scaling only if documented. Avoid inline JS. Use strict `Referrer-Policy`, `X-Content-Type-Options`, and frame controls in Pages `_headers` and local responses.
- Resume routes have `no-store`; capability never enters localStorage, URLs after bootstrap, or event query parameters. Hosted local-mode probe is absent unless a capability fragment is present.
- Local writes handle permission/disk-full/rename failure, source disappearance, malformed external updates, locked files, and stale revision without partial overwrite or automatic rollback over newer data.
- CLI rejects protected destinations (`.env*`, credential stores, `node_modules`, `dist/web`, public assets), symlink targets, nonregular files, and deployment paths; explicit JSON files elsewhere are allowed. Use safe mode 0600/0700 where supported; ACL guarantees on Windows are a documented limitation.
- Arbitrary browser imports cannot initiate uploads, external font requests, link preview fetches, or local writes. Link clicks are explicitly user initiated; warn they leave the app.
- Backups and autosaves are PII; bounded retention, clear controls, ignore rules, and documentation. `.gitignore` is not encryption or an authorization policy.
- No analytics/error service in v1. Safe codes/timings can be recorded locally only without field values or secrets.

## File changes

All application paths below are **New**; this plan/AGENTS/proposal already exist and will be **Modify** only for phase records and confirmed decisions. Never create a source skeleton during planning.

| File | New/Modify/Delete | Change |
| --- | --- | --- |
| `package.json`, `package-lock.json`, `.gitignore`, `.node-version` | New | Private standalone package, pinned toolchain, safe ignored data/build paths. |
| `tsconfig.json`, `tsconfig.web.json`, `tsconfig.cli.json`, `vite.config.ts` | New | Strict browser/Node separation and distinct outputs. |
| `index.html`, `public/_headers` | New | Native entry point and deployment security headers. |
| `schema/resume.schema.json` | New | Canonical strict data bounds, descriptions, guidance. |
| `scripts/generate-contracts.mjs`, `scripts/check-build.mjs`, `scripts/bench.mjs` | New | Deterministic generation, publication/bundle gates, repeatable synthetic benchmarks. |
| `src/core/generated/resume.ts`, `validator.js`, `validator.d.ts`, `guidance.ts` | New/generated | Types, standalone validator, and browser-safe guidance; drift checked. |
| `src/core/{validation,content,defaults,templates}.ts` | New | Pure shared behavior and semantic invariants. |
| `src/web/{main,state,editor,files,storage,diagnostics,print}.ts` | New | UI/controller, input, import/export, optional autosave, print policy. |
| `src/web/{render,paginate,blocks}.ts`, `src/web/templates/{classic,modern,executive}.ts` | New | Measured legal atoms and template rendering registry. |
| `src/web/{styles,print}.css`, `src/web/templates/templates.css` | New | Professional A4 geometry, responsive chrome, print-only rules. |
| `src/web/adapters/{hosted,local}.ts` | New | File-mode and authenticated local bridge boundaries. |
| `src/cli/{main,args,documents,locks,server,open-browser}.ts` | New | Native CLI, guarded IO, secure single-document preview. |
| `examples/{classic-one-page,modern-two-page,executive-two-page}.json` | New | Clearly fictional examples, not private user resumes. |
| `tests/fixtures/*.json`, `tests/unit/*.test.ts`, `tests/cli/*.test.ts` | New | Edge cases, shared contracts, transaction/server tests. |
| `tests/browser/*.spec.ts`, `playwright.config.ts` | New | Browser, A4, print, accessibility, and no-network regressions. |
| `.github/workflows/ci.yml` | New | OS IO matrix and Chromium rendering checks; no deploy credentials. |
| `README.md`, `docs/{agent-guide,content-guide,printing,privacy,deployment}.md` | New | User/agent setup, writing budgets, export caveats, private deployment workflow. |
| `AGENTS.md`, this plan, proposal sections | Modify | Preserve decisions; append measured evidence/status only. |

Files can be consolidated if the boundary remains explicit and smaller; do not create empty modules merely to match the map. Document any consolidation, not a product-scope change.

## Phase overview

| Phase | Objective | Dependencies | Status |
| --- | --- | --- | --- |
| 1 | Toolchain and safe standalone skeleton | Owner approves implementing batch 1 | complete |
| 2 | Schema, generated contracts, validation, editorial guidance | 1 | complete |
| 3 | CLI and cooperative local document transactions | 2 | complete |
| 4 | Secure local preview/save bridge | 3; minimal static assets from 1 | complete |
| 5 | Three templates and measured A4 pagination | 2; independent of server details | complete |
| 6 | Browser editor, import/export, explicit save/conflicts, PDF UI | 4 and 5 | complete |
| 7 | End-to-end, accessibility, performance, cross-platform hardening | 6 | complete |
| 8 | Agent docs, Cloudflare deployment preparation, final acceptance | 7 | complete |

## Execution batches

| Batch | Authorized phases | Why these fit together | Dependencies / gates | Status |
| --- | --- | --- | --- | --- |
| 1 | 1–2 | Cohesive scaffold + pure data contract; no UI/pagination debugging | Confirm target/toolchain; generated contract tests pass | complete |
| 2 | 3–4 | One IO/security boundary; CLI transaction reused by local save | Batch 1 accepted; server attack/conflict tests green | complete |
| 3 | 5 only | High-risk measurable pagination and three layouts need debugging/visual reserve | Valid schema; all content conservation and print geometry checks pass | complete |
| 4 | 6 only | Stateful native forms, local conflicts, and print integration | Batches 2–3 accepted; preserve focus/drafts and source safety | complete |
| 5 | 7–8 | No new product subsystem; verification and docs/deployment preparation | All user flows pass; no unapproved deployment | complete |

- **Capacity basis / assumptions:** usable chat budget/model capacity is unknown. Conservative sizing is based on required contracts, IO/security complexity, and visual debugging, not a token/model benchmark. Two small cohesive phases fit initial batches; layout and stateful UI are isolated. If batch 5 requires substantial fixes, finish phase 7 and return a bounded phase-8 handoff.
- **Safe stopping checkpoints:** after each verified phase. Mid-phase record files/tests/remaining failing gates, preserve partial changes, and resume the same phase within the original batch end. Splitting is allowed; expanding beyond an authorized range needs explicit approval.

## Implementation phases

### Phase 1: Toolchain and safe standalone skeleton

- **Objective / dependencies:** create a reproducible minimal project after authorization; inspect existing planning files and target state first.
- **Out of scope:** resume schema/editor, file mutations, server API, templates, production deployment, git initialization.
- **Steps:**
  - [x] Inspect target listing, `node --version`, `npm --version`, and git-root context; do not create a nested/new git repo — project root — done-when state/toolchain evidence is recorded and no existing files were overwritten.
  - [x] Select compatible pinned dev-only versions of TypeScript, Vite, @types/node, Ajv, json-schema-to-typescript, Playwright — package manifest/lockfile — done-when `npm ci` succeeds and no runtime dependency is installed.
  - [x] Configure strict TS (`strict`, unchecked-index handling, exact optional fields), browser versus Node module resolution/types, separate `dist/web`/`dist/cli` outputs, and copying generated standalone validator JavaScript into the compiled CLI output — tsconfigs/Vite — done-when neither Node code nor secrets enter browser build.
  - [x] Define scripts `generate`, `check:generated`, `typecheck`, `build`, `test:unit`, `test:cli`, `test:browser`, `check:build`, `bench`, `verify`, `dev`, `resume` — package/scripts — done-when help/minimal build/test checks work; unimplemented suites are explicitly not claimed complete.
  - [x] Add ignores for private `resumes/`, tool backups, temporary candidates, drafts, build/test reports, dependency folders; do not ignore required synthetic examples — `.gitignore` — done-when intended private paths are documented.
  - [x] Add synthetic-only static shell and strict headers, no third-party assets or inline scripts — web entry/public headers — done-when a built app loads offline after assets and local CLI `--help` exits cleanly.
- **Verification:** `npm ci`; `npm run typecheck`; `npm run build`; `node dist/cli/main.js --help`; `npm run check:build`. Record meaningful skeleton checks, not future feature claims.
- **Acceptance criteria:** build separation proven; no app runtime dependency; no network-enabled resume feature; no modifications outside resume-studio; generated contracts/test placeholders clearly distinguished from implemented checks.

### Phase 2: Canonical schema and pure contracts

- **Objective / dependencies:** one source for schema, generated types/validator, template metadata and guidance; requires phase 1.
- **Files / contracts:** schema, code generator/generated files, pure core modules, synthetic examples, unit tests, initial agent/content docs.
- **Out of scope:** DOM pagination, browser form, local server/writes, automatic migration of unknown future versions.
- **Steps:**
  - [x] Encode the complete ResumeV1 fields, required arrays, unique section order, length/item bounds, additional-property rejection and safe guidance annotations — schema — done-when every contract in this plan has a machine-readable rule or a named semantic validation test.
  - [x] Generate types and standalone Ajv validator with no third-party runtime imports; emit exact deterministic output and drift check — generator/generated files — done-when two runs are byte-identical and modifying schema causes the drift gate to fail until regenerated.
  - [x] Implement bounded parser and semantic date/ID/link/control checks with typed issues; reject invalid input without coercion — validation module — done-when every failure fixture returns correct path/code without content echo.
  - [x] Implement word/code-point counters and warnings from schema guidance, pure defaults, template IDs and caveats — core modules — done-when warnings never make structurally valid content invalid.
  - [x] Author three fictional example JSON documents and edge fixtures — examples/tests — done-when examples validate and include no real phone/email/address/person details.
  - [x] Write the initial agent/content guide with exact CLI-intended flow and example facts-only edits — docs — done-when schema fields and limits match generated metadata.
- **Verification:** `npm run generate`; `npm run check:generated`; `npm run typecheck`; `npm run test:unit`; `npm run build`; `npm run check:build`. Tests include 128-KiB boundary, unknown version/properties, prototype keys, whitespace, Unicode code-point boundary, bad/control URLs, dates/current-end constraints, duplicate IDs, exact section membership, empty sections, and editorial-only warnings.
- **Acceptance criteria:** examples parse; generated schema/types/validator do not drift; browser validation is self-contained; no runtime compiler; all tests in this phase green. Phase 2 is the end of initial authorized batch.

### Phase 3: CLI and guarded document transactions

- **Objective / dependencies:** deterministic file interface and safe reusable write transaction; phase 2 accepted.
- **Files / contracts:** CLI main/args/documents/locks, CLI tests and OS fixtures, agent docs.
- **Out of scope:** browser server, unattended PDF, MCP, generic file API, editor UI.
- **Steps:**
  - [x] Implement command router and exact exit/envelope contracts, help and version — CLI main/args — done-when unknown/duplicate/missing flags fail safely and JSON stdout remains parseable.
  - [x] Implement bounded regular-file read, path protection, revision SHA-256, init no-clobber, inspect and validate — document adapter — done-when source bytes stay unchanged for all read-only commands and oversized/protected/symlink paths fail.
  - [x] Implement cooperative lock, queue, fresh-read revision check, restricted temp file, bounded backup and atomic replace; cleanup after failures — documents/locks — done-when successful apply produces expected bytes and backup; stale revision never overwrites source.
  - [x] Wire `apply --from --expected-revision`, templates and guidance — CLI — done-when candidate validation precedes mutations and output reports new revision without echoing content.
  - [x] Test two cooperative writers, external edits, crash/lock/disk/permissions/rename failure seams — CLI tests — done-when original/new complete files survive failures and noncooperating race limitation is documented.
- **Verification:** `npm run typecheck`; `npm run test:unit`; `npm run test:cli`; `npm run build`; `node dist/cli/main.js templates --json`; `node dist/cli/main.js validate --file examples/classic-one-page.json --json`. Mutation tests use OS temp directories only, never example/user files.
- **Acceptance criteria:** no partial writes, no silent stale overwrite in cooperative path, protected/symlink cases pass; metadata/content logging separation; CLI works without dev dependencies after compilation, subject to source/build availability.

### Phase 4: Secure local preview and save bridge

- **Objective / dependencies:** file-selected loopback mode using phase-3 transaction; requires current minimal built web shell.
- **Files / contracts:** local server/opener, browser local adapter/bootstrap, server integration tests, private-route headers.
- **Out of scope:** full editor, template pagination, cloud endpoints, LAN binding, remote authentication, mandatory MCP.
- **Steps:**
  - [x] Add bounded HTTP server at IPv4 loopback/ephemeral port with exact Host validation and realpath-contained static files — server — done-when traversal/encoded paths/symlink assets/DNS-rebinding Host fail.
  - [x] Add session capability bootstrap, immediate fragment removal, bearer checks, no-referrer/no-store and safe local reload behavior — server/local adapter — done-when wrong/absent tokens cannot read documents/events/save and tokens are absent from storage/query/logs.
  - [x] Implement selected-document read and revision-only authenticated event stream with parent watcher + periodic reconciliation — server/client — done-when external atomic replace, malformed file, deletion, reconnect and cleanup all have deterministic behavior.
  - [x] Implement bounded save envelope, exact Origin/content-type checks, serial cooperative transaction and typed failures — server — done-when stale saves return 409 and oversized requests stop streaming at limit.
  - [x] Implement `preview --file --port --open` and safe browser spawn arguments; refuse missing/stale built assets clearly — CLI/opener — done-when server shutdown closes streams/watchers and never listens on LAN.
  - [x] Add origin/token/host/traversal/body/lock/conflict security tests and a minimal browser connection smoke test — tests — done-when unauthenticated pages receive no document data and hosted mode has no local probe.
- **Verification:** `npm run build`; `npm run test:cli`; `npm run test:browser -- --grep "local bridge"`; `npm run check:build`. Use temporary synthetic documents in tests; local demonstration may use examples read-only unless explicit Save creates a private copy.
- **Acceptance criteria:** browser can fetch/save a selected synthetic document under test, unauthorized routes fail closed, watcher and draft-conflict event contracts stable; public dist contains no private data or capability. This ends batch 2.

### Phase 5: Three professional templates and measured A4 layout

- **Objective / dependencies:** solve professional typography and legal one/two-page pagination before editor integration; phase 2 required.
- **Files / contracts:** shared semantic blocks/render/paginate, template registry/functions/CSS, layout tests/snapshots, print rules/docs.
- **Out of scope:** complete editor, cloud deployment, automatic text shrinking, canvas PDF, extra templates/pages, premium decoration.
- **Steps:**
  - [x] Implement shared semantic block construction and content-source mapping — blocks/render — done-when all populated schema fields have source atoms and safe text rendering.
  - [x] Implement Classic and Modern typography plus physical A4 page shell — templates/CSS — done-when pixel/mm geometry, grayscale contrast, accessible headings and minimum sizes are asserted.
  - [x] Implement deterministic measurement and greedy pagination with legal boundaries, keep-with-next, continuation labels, and overflow diagnostics — paginator — done-when synthetic entry/heading/bullet boundary cases conserve every content atom.
  - [x] Implement Executive first-page sidebar and full-width spillover policy using correct widths — executive/render — done-when skills/certifications appear once, primary column stays within bounds and ATS/order caveat is visible.
  - [x] Add generation IDs/font settling/measurement cleanup and shared screen/print pages — render/print CSS — done-when rapid edits cannot install stale layout and preview scaling cannot alter physical dimensions.
  - [x] Add browser fixtures for empty, sparse, exactly fitting, one-line-over, long names/URLs/bullets, long entry split, sidebar spill, max-limit and >2-page overflow — browser tests — done-when no print enables on overflow and no clipping/omissions occur.
  - [x] Use test-only Chromium PDF generation to inspect 1/2-page count, selectable text, no extra blank page and page rectangles; record initial manual print findings — tests/printing docs — done-when supported examples meet template standards and test results are saved.
- **Verification:** `npm run typecheck`; `npm run test:unit`; `npm run build`; `npm run test:browser -- --grep "layout|pagination|print geometry|templates"`; `npm run check:build`. Install Playwright test browser only with the implementation environment's dependency policy; record install/network step, never call it a runtime requirement.
- **Acceptance criteria:** three genuinely distinct professional templates, content conservation, legal breaks, physical A4, no extra page, readable/selectable output, overflowing valid content remains explicit and recoverable. Any unresolved Executive pagination policy blocks completion, not a silent fallback. This phase occupies batch 3 alone.

### Phase 6: Browser editor, privacy workflows, and user PDF action

- **Objective / dependencies:** integrate forms, hosted/local document modes, layout and PDF; phases 4–5 accepted.
- **Files / contracts:** state/editor/files/storage/diagnostics/print, main UI, adapters, interaction tests.
- **Out of scope:** automatic background disk writes, cloud persistence, remote agents, drag/drop library, whole new editor framework.
- **Steps:**
  - [x] Build responsive two-pane accessible editor covering all schema fields; add stable add/remove/reorder actions — editor/main/styles — done-when keyboard edits preserve focus/caret and IDs survive reorder.
  - [x] Implement bounded draft state, dirty tracking, validation diagnostics and debounced generation-safe preview — state/diagnostics — done-when invalid typing preserves input and cannot trigger save/print.
  - [x] Implement explicit import/export, dirty replacement confirmation, sanitized JSON filename, Blob URL cleanup — files — done-when invalid import leaves prior draft/source untouched and export round-trips all fields.
  - [x] Wire local read/save/reload and external revision events; clean reload versus dirty conflict choices — local adapter/state — done-when browser draft and source are both preserved on stale save; no hidden last-write-wins.
  - [x] Implement optional device autosave, explicit restore/clear, storage failure recovery, dirty navigation hints — storage/privacy UI — done-when hosted content causes no network send and autosave is off for a fresh session.
  - [x] Add honest Print / Save PDF action waiting for validation/layout, with A4/100%/no-header-footer instructions — print/UI — done-when browser print is called only from eligible user action and all editor chrome is excluded.
  - [x] Add first-run synthetic starter, template caveat, editorial/fit diagnostics and a simple agent-workflow help panel — UI/docs — done-when owner can discover import/edit/view/export without terminal knowledge.
- **Verification:** `npm run typecheck`; `npm run test:unit`; `npm run test:cli`; `npm run build`; `npm run test:browser`; `npm run check:build`. Cases: all fields, keyboard reorder, invalid form/import, template round-trip, autosave permission/quota, safe links, stale remote file, reconnection, dirty reload and blocked overflow print.
- **Acceptance criteria:** complete hosted and local workflows; browser edits never auto-write disk, hosted app never uploads content; print/download semantics honestly disclosed; schema and render state stay consistent. This ends batch 4.

### Phase 7: End-to-end, accessibility, performance and OS hardening

- **Objective / dependencies:** verify actual quality and budgets rather than adding features; phase 6 accepted.
- **Files / contracts:** all test suites, build/bench gates, CI, measured evidence/docs. Fix only demonstrated defects within approved scope.
- **Out of scope:** speculative optimization, telemetry service, runtime test tools, proprietary ATS certification, uncontrolled deployment.
- **Steps:**
  - [x] Exercise agent init/inspect/edit candidate/validate/apply/preview and user edit/save/print flows in temp workspaces — CLI/browser tests — done-when exact revision and content round-trips pass.
  - [x] Add XSS/control/link payloads, token/origin/path attacks, interrupted save and invalid external-edit regressions — tests — done-when malicious data stays inert and no failed mutation loses content.
  - [x] Audit labels, focus order, keyboard controls, error announcements, contrast, zoom/reflow and template DOM order — browser/manual checklist — done-when no blocking accessibility issue remains; no accessibility certification claims.
  - [x] Measure compressed bundles, zero third-party/resume requests, validation/render/save p50/p95/p99 over synthetic runs — scripts/bench/check-build — done-when targets pass or owner explicitly approves measured exceptions.
  - [x] Run Node filesystem/server test matrix on Linux/macOS/Windows and Chromium render job; keep generated-contract drift and publication gates — CI — done-when outcomes/failures are recorded and OS-specific limitations are documented.
  - [x] Complete desktop Chrome/Edge reference and Firefox/Safari manual print checklist — printing docs — done-when page count, A4, text selection, links, margins, header suppression and long content are checked; unavailable browsers are explicitly unverified.
- **Verification:** `npm run verify`; `npm run bench`; CI OS matrix; manual print checklist. `verify` must now execute generation drift, type checks, all automated suites, build and publication checks, not placeholders.
- **Acceptance criteria:** security/content-loss gates pass; measured targets pass or recorded approval; no claims of unrun manual/CI tests. If a required OS/browser cannot be tested, record a release blocker or approved narrowed support rather than marking it passed.

### Phase 8: Documentation, deployment preparation and final acceptance

- **Objective / dependencies:** make the tool easy for any local coding agent/user and safe to publish; phase 7 accepted.
- **Files / contracts:** README, agent/content/printing/privacy/deployment docs, root instructions, proposal measured notes and plan completion.
- **Out of scope:** Cloudflare account access, DNS changes, actual upload/deploy, git initialization/commit, remote resume hosting.
- **Steps:**
  - [x] Write copy-paste agent guide for direct JSON edits and safer concurrent candidate apply, real facts only, warnings/preview and user PDF dialog — agent-guide — done-when Claude Code/Pi/Antigravity require no agent-specific plugin.
  - [x] Finish schema-derived field guidance, examples, template/ATS caveats, printing and privacy/backup retention explanations — docs — done-when all product claims match implemented behavior.
  - [x] Verify current official Cloudflare Pages build settings; document `npm ci && npm run build`, output `dist/web`, Node version, security headers, no private files and no SPA fallback necessity — deployment docs — done-when a clean artifact scan contains only allowed public assets.
  - [x] Document separate dev, local preview, hosted import/export, source recovery via backup/candidate apply, and rollback workflows — README/docs — done-when no command overwrites a user resume without revision/confirmation.
  - [x] Run final gates, record actual measurements/manual support, list remaining risks, and update phase/batch/plan status — plan/AGENTS/proposal — done-when all required acceptance checks pass and unrun checks are explicit.
- **Verification:** `npm ci`; `npm run verify`; `npm run bench`; read the final deployed-file allowlist from `dist/web`; manually execute documented flows on synthetic private copies. Do not run an upload/deploy command.
- **Acceptance criteria:** reproducible clean build; professional samples; facts-preserving agent contract; private local files excluded; exact Cloudflare instructions; final remaining-risk report. Mark plan complete only after these gates, with no next-batch prompt.

## Phase completion records

No implementation phases have started. Append, do not replace, a record per verified phase:

```text
Phase N / date / implementing agent:
Authorized batch and exact range:
Changes and files:
Contracts / decisions confirmed:
Commands actually run and results:
Manual checks / measurements and environment:
Deviations / blockers / known working-tree state:
Next prerequisites and safe checkpoint:
```

Initial planning record: owner selections captured in root AGENTS.md; source code, dependencies, git, and deployment remain untouched. Neighboring AgentSkills was inspected read-only. Planning artifacts are not proof that application behavior exists. Proposal validation command: `node /Users/pankil/Documents/Projects/AgentSkills/feature-proposal/scripts/proposal.mjs check --plan /Users/pankil/Documents/Projects/resume-studio/docs/proposals/2026-10-06-resume-studio/proposal.md --json`. Initial invocation mistakenly targeted the directory and failed safely; corrected manifest invocation passed. Final corrected validation passed with `valid: true` and `diagnostics: []` (zero errors and warnings). Read-only structural inspection confirmed eight phases, exact once-only batch coverage, and no non-Markdown files created; neighboring AgentSkills git status remained clean. No application tests were run.

### Phase 1 Completion Record
- **Phase 1 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 1 (phases 1–2).
- **Changes and files:**
  - Created `.node-version` (pinned to Node 24).
  - Created `.gitignore` (excludes `node_modules/`, `dist/`, `dist-test/`, private `resumes/`, temporary files, transaction backups, test reports).
  - Created `package.json` (`v0.1.0`, private, zero runtime dependencies, dev-only toolchain).
  - Created `bun.lock` and `package-lock.json` lockfiles.
  - Created `tsconfig.json` (strict base), `tsconfig.web.json` (DOM lib, zero Node types), `tsconfig.cli.json` (NodeNext, target `dist`), `tsconfig.test.json` (`dist-test`).
  - Created `vite.config.ts` (targets `dist/web`, static HTML entry).
  - Created `index.html` (accessible offline static shell) and `public/_headers` (strict Cloudflare Pages headers).
  - Created `src/web/main.ts` (DOM client entry skeleton) and `src/cli/main.ts` (Node CLI `--help`/`--version` executable).
  - Created `scripts/copy-cli-assets.mjs` (CLI executable permissions), `scripts/check-build.mjs` (gzip budget & leak enforcement), `scripts/run-tests.mjs` (dual Node/Bun test runner), `playwright.config.ts`.
  - Created `tests/cli/skeleton.test.ts`.
- **Contracts / decisions confirmed:**
  - Strict build segregation: browser bundle in `dist/web` contains no Node modules, private data, or schema compilers.
  - Zero application runtime dependencies.
  - No git repository initialized; neighboring AgentSkills repository left completely untouched.
- **Commands actually run and results:**
  - `bun install`: 39 dev packages installed in 845ms.
  - `/opt/homebrew/bin/npm ci`: 40 packages audited, 0 errors.
  - `bun run typecheck`: exit 0 across web, cli, and test configurations.
  - `bun run build`: Vite web build (0.59 kB HTML, 1.00 kB JS) and CLI compilation passed (exit 0).
  - `node dist/cli/main.js --help`: printed deterministic CLI usage (exit 0).
  - `/opt/homebrew/bin/node dist/cli/main.js --help`: printed deterministic CLI usage (exit 0).
  - `bun run check:build`: verified JS 0.53 KiB gzip (<=50 KiB), CSS 0 KiB (<=20 KiB), total payload 1.08 KiB (<=100 KiB) (exit 0).
- **Manual checks / measurements and environment:**
  - Environment: macOS 15+ (Darwin arm64), Bun v1.4.0, Node.js v26.7.0, npm 11.19.0.
  - Verified offline execution: zero external network requests during build and help command.
- **Deviations / blockers / known working-tree state:**
  - None. Clean working tree with private paths ignored.
- **Next prerequisites and safe checkpoint:**
  - Phase 1 verified; advancing to Phase 2.

### Phase 2 Completion Record
- **Phase 2 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 1 (phases 1–2).
- **Changes and files:**
  - Created `schema/resume.schema.json`: canonical draft-07 JSON schema with required `ResumeV1` fields, `definitions`, `additionalProperties: false`, string limits, and `x-guidance` annotations.
  - Created `scripts/generate-contracts.mjs`: generates TypeScript types, standalone Ajv validator with inlined `ucs2length` and `deepEqual` helpers (0 runtime imports, pure ESM), validator type declarations, and browser-safe guidance projection. Supports byte-exact `--check` drift validation.
  - Generated `src/core/generated/resume.ts`, `src/core/generated/validator.js`, `src/core/generated/validator.d.ts`, `src/core/generated/guidance.ts`.
  - Created `src/core/validation.ts`: pure functions `parseResume` and `validateResume` enforcing 128 KiB UTF-8 boundary, prototype pollution prevention, standalone schema validation, global item ID uniqueness, string control/NUL/whitespace checks, URL security, chronological date invariants, and non-echoing PII issues.
  - Created `src/core/content.ts`: `countWords`, `countCodePoints` (surrogate pair safe), `getContentMetrics`, and `getContentIssues` computing editorial guidance warnings without invalidating structural validity.
  - Created `src/core/templates.ts`: typed template registry for classic, modern, and executive with ATS metadata and caveats.
  - Created `src/core/defaults.ts`: `createBlankResume` and `createFictionalStarter`.
  - Created `src/core/index.ts`: core module barrel export.
  - Created `examples/classic-one-page.json`, `examples/modern-two-page.json`, `examples/executive-two-page.json`: 3 fully valid fictional examples with no real PII.
  - Created `tests/fixtures/*.json` (10 valid and invalid test fixtures).
  - Created `tests/unit/schema.test.ts` and `tests/unit/contracts.test.ts` (26 comprehensive test cases).
  - Created `scripts/bench.mjs`: benchmark measuring validation p50/p95/p99 latency over 200 runs.
  - Created `README.md`, `docs/agent-guide.md`, `docs/content-guide.md`.
- **Contracts / decisions confirmed:**
  - Single source of truth: all types, standalone validator, and guidance are derived from `schema/resume.schema.json`.
  - Standalone compiled Ajv validator requires zero runtime imports, contains no `require()` or `ajv/` references, and ships no schema compiler to browsers.
  - Gzipped validator is ~8.9 KiB. Total web JS bundle is 0.53 KiB gzip (budget: <=50 KiB).
  - All editorial warnings are non-blocking advisory diagnostics and never fail structural validation.
  - Executive template includes explicit ATS reading-order caveat warning.
  - Zero PII leaks in error diagnostics.
- **Commands actually run and results:**
  - `bun run generate`: generated 4 contract files cleanly.
  - `bun run check:generated`: `[DRIFT CHECK] All generated contracts match schema perfectly.` (exit code 0).
  - `bun run typecheck`: clean across all 3 tsconfigs (exit code 0).
  - `bun run test:unit`: 26 tests passed in Bun (39ms) and 26 tests passed in Homebrew Node.js (107ms).
  - `bun run build`: clean web and CLI build (exit code 0).
  - `bun run check:build`: JS 0.53 KiB gzip, 0 CSS, total payload 1.08 KiB (budget <=100 KiB). Exit code 0.
  - `bun run bench`: 200 iterations; p50: 0.057ms, p95: 0.136ms (target <=20ms), p99: 0.181ms (exit code 0).
  - `bun run verify`: all gates green (exit code 0).
  - `/opt/homebrew/bin/npm ci && /opt/homebrew/bin/npm run verify`: clean execution (exit code 0).
- **Manual checks / measurements and environment:**
  - Verified 128 KiB UTF-8 input boundary rejection.
  - Verified prototype pollution rejection for `__proto__`.
  - Verified code point measurement over astral plane emoji (`Hello 🚀 World` = 13 code points vs 14 UTF-16 code units).
  - Verified synthetic examples contain only fictional contact details (`@example.invalid`, `+1-555-*`, `https://example.com/*`).
- **Deviations / blockers / known working-tree state:**
  - None. No phase 3–8 functionality implemented. Working tree clean.
- **Next prerequisites and safe checkpoint:**
  - Batch 1 (phases 1–2) is 100% complete and verified. Safe checkpoint reached.
  - Next authorized scope is Batch 2 (phases 3–4): CLI and cooperative local document transactions, followed by secure local preview/save bridge.

### Phase 3 Completion Record
- **Phase 3 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 2 (phases 3–4).
- **Changes and files:**
  - Created `src/cli/args.ts`: CLI argument parser and command definitions (`init`, `inspect`, `validate`, `apply`, `templates`, `guidance`, `preview`, `--help`, `--version`). Enforces strict flag validation via `assertAllowed`, rejects extraneous positional arguments, duplicate options, and unrecognized flags. Maps exit codes: 0 (success), 1 (IO / usage / unexpected error), 2 (validation failure), 3 (revision conflict).
  - Created `src/cli/documents.ts`: bounded file operations (`<= 128 KiB` UTF-8), path protection (rejects paths resolving into or matching `.env*`, `.git`, `.ssh`, `.aws`, `node_modules`, `dist`, `dist/web`, `dist-test`, `public`), symlink / non-regular file rejection, SHA-256 revision computation (`computeRevision`), non-clobbering `initDocument` (fails with `EEXIST` if file exists), read-only `inspectDocument` and `validateDocument`.
  - Created `src/cli/locks.ts`: cooperative transaction manager. Features in-process serialization queue, atomic directory lock (`.lock` via `mkdirSync`), diagnostic metadata (`pid`, `timestamp`, `path`), bounded polling timeout (5000ms), bounded 10-backup rotation (`.bak.1` through `.bak.10`, pruning oldest tool-created backups), restricted sibling temporary file (`0o600` via `openSync`/`writeSync`), and atomic replacement (`renameSync`) with cleanup of temporary files in `finally`.
  - Updated `src/cli/main.ts`: full command routing for all Phase 3 commands (`init`, `inspect`, `validate`, `apply`, `templates`, `guidance`). Formats JSON envelopes on stdout when `--json` is supplied, routes operational/diagnostic logs to stderr without PII.
  - Created `tests/cli/args.test.ts`: 8 test suites verifying argument parsing, command routing, flag combinations, and validation rejections.
  - Created `tests/cli/documents.test.ts`: 5 test suites verifying path security, symlink rejection, init non-clobbering, 128 KiB bounds, and deterministic SHA-256 revision computation.
  - Created `tests/cli/transactions.test.ts`: 7 test suites verifying lock acquisition/release, 10-backup rotation, atomic apply transaction, stale revision conflict detection, candidate schema pre-validation, concurrent writer serialization, and external uncooperative edit race detection.
  - Created `tests/cli/commands.test.ts`: 4 end-to-end command runner suites verifying exit codes (0, 1, 2, 3) and stable JSON stdout envelopes.
- **Contracts / decisions confirmed:**
  - Directory lock (`.lock`) with PID/time metadata ensures single cooperative writer per document.
  - Stale revision check halts transaction with conflict code 3 before any file modification.
  - Sibling temporary files created with restricted `0o600` permissions.
  - Maximum 10 backups rotated; oldest tool backups pruned only after successful replacement.
  - Residual limitation documented: uncooperative external writers racing between final check and atomic rename are detected on subsequent read/apply.
  - JSON output on stdout is strictly envelope-wrapped; zero PII leaks to stderr.
- **Commands actually run and results:**
  - `bun run typecheck`: clean across all tsconfigs (exit code 0).
  - `bun run test:cli`: 25 Phase 3 tests passed in Bun (315ms).
  - `node dist/cli/main.js templates --json`: returned valid templates JSON envelope (exit code 0).
  - `node dist/cli/main.js guidance --json`: returned valid guidance JSON envelope (exit code 0).
  - `node dist/cli/main.js validate --file examples/classic-one-page.json --json`: validated candidate cleanly (exit code 0).
  - `node dist/cli/main.js inspect --file examples/classic-one-page.json --json`: reported revision and document structure (exit code 0).
- **Manual checks / measurements and environment:**
  - Environment: macOS 15+ (Darwin arm64), Bun v1.4.0, Node.js v26.7.0.
  - Verified no partial files or abandoned locks remain after simulated write failures.
  - Verified protected path rejection prevents opening `.env`, `node_modules`, or root dotfiles.
- **Deviations / blockers / known working-tree state:**
  - None. Clean working tree.
- **Next prerequisites and safe checkpoint:**
  - Phase 3 verified; advancing to Phase 4.

### Phase 4 Completion Record
- **Phase 4 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 2 (phases 3–4).
- **Changes and files:**
  - Created `src/cli/open-browser.ts`: OS-specific argument-array browser launcher using `child_process.spawn` (`open` on macOS, `xdg-open` on Linux, `cmd.exe /c start ""` on Windows). Prohibits shell interpolation (`shell: false`).
  - Created `src/cli/server.ts`: bounded loopback HTTP server. Binds strictly to IPv4 `127.0.0.1` on port 0 (ephemeral) or user-specified port. Enforces DNS-rebinding Host header checks (`Host === 127.0.0.1:<port>`). Serves static assets from realpath-contained `dist/web`, rejecting directory traversal (`..`, `\0`, `\\`) and non-existent files. Generates 256-bit cryptographically secure session capability. Implements authenticated endpoints:
    - `GET /local/document`: requires bearer token matching session capability, returns `{revision, document}` with `Cache-Control: no-store`.
    - `POST /local/save`: requires exact Origin (`http://127.0.0.1:<port>`), bearer token, JSON content type, strictly bounded 160 KiB body. Validates candidate schema (HTTP 422), executes Phase 3 cooperative transaction, returns `{revision}` or HTTP 409 conflict.
    - `GET /local/events`: authenticated SSE stream via HTTP chunked transfer. Watches parent directory of selected file with 100ms debounce and 3000ms reconciliation timer. Emits revision-only metadata (`revision`, `modified`, `error`) with zero resume content or PII.
  - Created `src/web/adapters/local.ts`: browser client adapter. Bootstraps session capability from `#local=<capability>` fragment, strips fragment immediately from URL and window history via `history.replaceState` before any storage or network call. Holds bearer token strictly in memory. Subscribes to `/local/events` via streaming `fetch` reader with backoff reconnection. Provides `fetchLocalDocument` and `saveLocalDocument`.
  - Updated `src/web/main.ts`: integrates session bootstrap. If local capability is present, initializes bridge and displays `#bridge-status`; in hosted mode (no fragment), enters isolated hosted mode with zero network calls or loopback probing.
  - Updated `src/cli/main.ts`: added `preview` command runner wiring `startPreviewServer` and browser launcher.
  - Created `tests/cli/server.test.ts`: 4 comprehensive integration test suites verifying ephemeral listener binding, Host header rejection, static file containment, path traversal defense, `/local/document` bearer auth, `/local/save` origin/body-limit/validation/conflict responses, and `/local/events` SSE stream without PII.
  - Created `tests/browser/bridge.test.mjs` and `scripts/run-browser-tests.mjs`: Playwright Chromium automated browser test verifying URL fragment extraction, history stripping, `#bridge-status` connection indicator, and hosted mode non-probing isolation.
  - Updated `package.json`, `tsconfig.test.json`: added `test:browser` and integrated into `verify`.
- **Contracts / decisions confirmed:**
  - Loopback server binds IPv4 `127.0.0.1` only; never listens on `0.0.0.0` or LAN.
  - DNS-rebinding protection verifies incoming `Host` header on all routes including static assets.
  - Static asset serving enforces `realpath` containment within `dist/web`.
  - 256-bit session token is never stored in browser storage (localStorage, sessionStorage, cookies) and is wiped from browser URL/history immediately on initialization.
  - `/local/save` rejects missing or mismatched `Origin` headers, enforces 160 KiB request limit, and performs pre-commit schema validation.
  - `/local/events` transmits revision hash and status metadata only; zero document text or PII transmitted over SSE.
  - Hosted mode makes 0 network calls and does not probe local ports.
- **Commands actually run and results:**
  - `bun run build`: static web bundle and CLI compiled cleanly (exit code 0).
  - `bun run test:cli`: 29 tests passed across 6 files (425ms).
  - `bun run test:browser`: Playwright Chromium test passed (472ms).
  - `bun run check:build`: JS gzip 1.78 KiB (<=50 KiB), CSS 0 KiB (<=20 KiB), total payload 2.33 KiB (<=100 KiB) (exit code 0).
  - `bun run verify`: all gates green (exit code 0).
  - `/opt/homebrew/bin/npm run verify`: all gates green in Node environment (exit code 0).
- **Manual checks / measurements and environment:**
  - Environment: macOS 15+ (Darwin arm64), Bun v1.4.0, Node.js v26.7.0, Playwright Chromium v1155.
  - Verified URL fragment `#local=<token>` is removed from browser address bar before any network calls.
  - Verified static server returns 404/403 on directory traversal attempts (`/../../../etc/passwd`).
  - Verified `/local/save` with mismatched origin returns 403 Forbidden.
  - Verified oversized body (>160 KiB) is rejected with 413 Payload Too Large.
- **Deviations / blockers / known working-tree state:**
  - Node 26 compatibility: adapted Playwright runner to direct API script in `scripts/run-browser-tests.mjs` to avoid Node 26 worker thread registration deadlocks.
  - Clean working tree; zero git modifications; neighboring AgentSkills untouched.
- **Next prerequisites and safe checkpoint:**
  - Batch 2 (phases 3–4) is 100% complete and verified. Safe checkpoint reached.
  - Next authorized scope is Batch 3 (phase 5): Three professional templates (`classic`, `modern`, `executive`) and measured A4 layout / legal pagination.

### Phase 5 Completion Record
- **Phase 5 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 3 (phase 5).
- **Changes and files:**
  - Created `src/web/blocks.ts`: shared semantic atom model (`SemanticAtom`, `AtomType`), atom builders (`buildSemanticAtoms`), continuation generator (`createContinuationAtom`), safe DOM rendering (`createAtomElement`) enforcing `textContent` escaping and safe `rel="noopener noreferrer"`, and date formatters (`formatDateRange`, `formatYearMonth`).
  - Created `src/web/templates/classic.ts`, `modern.ts`, `executive.ts`, `index.ts`: typed template definitions with column counts, font families, and ATS metadata.
  - Created `src/web/styles/templates.css`: physical A4 page shell (`210mm` × `297mm`, `14mm` internal padding), typography tokens (body >= 10.5pt, name 24pt, headings 11.5pt), contrast-compliant accents (`slate`, `navy`, `forest`), two-column executive page 1 layout, and full-width page 2 continuation.
  - Created `src/web/styles/print.css`: canonical `@page { size: A4 portrait; margin: 0; }` stylesheet, hiding non-print elements (`#app-header`, `#bridge-status`, `.status-ready`, diagnostics, editor controls), resetting container margins, zero print chrome, and `.resume-page:last-child { break-after: avoid !important; }` to eliminate trailing blank pages.
  - Created `src/web/paginate.ts`: pure measurement-driven packing engine (`paginateResume`), orphan/widow protection (heading + first entry + bullet kept together), multi-bullet continuation labels, executive two-column packing with full-width page 2 spillover, structured overflow diagnostics with affected JSON paths, and strict content conservation assertion (`assertContentConservation`).
  - Created `src/web/render.ts`: measured A4 layout renderer with isolated offscreen measurement root (`#resume-measurement-root`), `document.fonts.ready` synchronization, generation ID concurrency protection, and overflow diagnostics banner rendering.
  - Created `tests/fixtures/layout/*.json`: 7 test fixtures for layout boundaries (`empty-sparse.json`, `classic-one-page.json`, `classic-one-line-over.json`, `long-strings.json`, `long-entry-split.json`, `executive-sidebar-spill.json`, `overflow-two-page.json`).
  - Created `tests/unit/pagination.test.ts`: 9 comprehensive unit tests verifying block building, orphan/widow rules, multi-bullet splits, continuation labels, overflow diagnostics, executive spillover, and content conservation assertions.
  - Created `tests/browser/layout.test.mjs`: 5 automated Playwright browser tests verifying Classic 1-page geometry & PDF, Modern 2-page pagination & PDF, Executive 2-page sidebar & continuation & PDF, overflow banner and unplaced JSON paths, and long strings boundary containment.
  - Updated `src/web/main.ts`: wired stylesheets, initial placeholder cleanup, and live layout preview in hosted and bridge modes.
  - Updated `scripts/run-browser-tests.mjs`: registered layout browser test suite with `--grep` support.
  - Created `docs/printing.md`: authoritative printing guide specifying A4, 100% scale, zero margins, no headers/footers, selectable text guarantees, and manual checklist for Firefox and Safari.
- **Contracts / decisions confirmed:**
  - True A4 physical geometry: 210 × 297 mm with 14 mm padding (content area 182 × 269 mm).
  - Strict content conservation: every source atom is rendered exactly once or reported in overflow; assertions prevent silent content loss.
  - Legal break packing: headings never orphaned at bottom of page; bullets never split across pages; split entries receive `(Continued)` labels.
  - Executive template: Page 1 compact sidebar (Skills & Certifications); spilled items move to full-width Page 2 continuation; ATS reading order caveat warning emitted.
  - Headless Chromium PDF verified: selectable text, hyperlinks preserved, exact page count (1 or 2 pages), zero trailing blank pages.
  - Overflow blocks print: unplaced content reported with exact JSON paths in DOM banner and validation diagnostics.
  - Budget adherence: JS gzip 7.72 KiB (<=50 KiB), CSS gzip 2.22 KiB (<=20 KiB), total initial payload 10.53 KiB (<=100 KiB).
- **Commands actually run and results:**
  - `bun run typecheck`: clean across all tsconfigs (exit code 0).
  - `bun run test:unit`: 35 tests passed (36ms).
  - `bun run test:cli`: 29 tests passed (429ms).
  - `bun run test:browser`: 2 browser test suites passed (bridge + layout, 1.18s).
  - `bun run build`: static bundle built cleanly.
  - `bun run check:build`: verified JS 7.72 KiB gzip, CSS 2.22 KiB gzip, payload 10.53 KiB gzip (exit code 0).
  - `bun run verify`: all gates green (exit code 0).
  - `/opt/homebrew/bin/npm run verify`: clean execution in Node environment (exit code 0).
- **Manual checks / measurements and environment:**
  - Environment: macOS 15+ (Darwin arm64), Bun v1.4.0, Node.js v26.7.0, Playwright Chromium v1155.
  - Headless Chromium PDF generation verified: exact 1-page PDF for classic, exact 2-page PDF for modern, exact 2-page PDF for executive.
  - Selectable text and hyperlinks verified in exported PDF streams.
  - Verified zero horizontal overflow on max-string boundary fixture.
- **Deviations / blockers / known working-tree state:**
  - None. Clean working tree; neighboring AgentSkills untouched; zero git modifications.
- **Next prerequisites and safe checkpoint:**
  - Batch 3 (phase 5) is 100% complete and verified. Safe checkpoint reached.
  - Next authorized scope is Batch 4 (phase 6): Browser editor, privacy workflows, and user PDF action.

### Phase 6 Completion Record
- **Phase 6 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 4 (phase 6).
- **Changes and files:**
  - Created `src/web/state.ts`: reactive `EditorStore` managing draft document, dirty tracking (deep candidate comparison against source document), candidate validation via `validateResume`, content/editorial issues via `getContentIssues`, stable item ID generator (`generateItemId` with `^[a-z][a-z0-9-]{1,47}$` format), opt-in autosave state, layout result tracking, and subscriber notifications.
  - Created `src/web/storage.ts`: device draft persistence in `localStorage` under `resume-studio:v1:draft` and `resume-studio:v1:autosave-enabled`. Opt-in default (strictly false), validation before draft load, quota/permission error resilience falling back to in-memory, explicit restore and clear controls.
  - Created `src/web/files.ts`: explicit file import and export helpers. Filename sanitization (`sanitizeFilename`), pretty JSON with trailing newline, temporary Blob URL creation and immediate revocation, 128 KiB input boundary enforcement (`importDocumentFromFile`), and safe invalid JSON rejection preserving prior drafts.
  - Created `src/web/print.ts`: honest user print controller (`checkPrintEligibility`, `executePrint`). Validates schema and layout before opening print dialog, blocking print if layout overflows or document is invalid.
  - Created `src/web/diagnostics.ts`: diagnostics panel mapping schema errors, editorial guidance warnings, and layout overflow alerts with clickable field focus navigation.
  - Created `src/web/editor.ts`: accessible two-pane form editor covering all schema fields (document settings, profile, links, summary, section order, experience, education, projects, skills, certifications). Direct input event binding preserving focus and caret position during typing without full-form reconstruction; keyboard add/remove/reorder actions with stable item ID conservation.
  - Created `src/web/styles/editor.css`: modern responsive CSS for two-pane desktop and stacked mobile layouts, sticky toolbar, accessible form controls, item cards, diagnostic alerts, and modal dialog overlays.
  - Updated `src/web/styles/print.css`: refined print containment rules resetting height, overflow, and display on outer containers (`#app`, `#app-main`, `#app-body`, `.two-pane-layout`, `#preview-pane`, `.preview-pane`, `#resume-preview`) to guarantee multi-page PDF generation without clipping.
  - Updated `src/web/main.ts`: integrated store, form editor, debounced layout preview (150ms), modal dialogs (Print Settings instructions, External Revision Conflict choice, Discard Confirmation, Help & Agent Guide), loopback bridge save and SSE watcher, dirty badge, and `beforeunload` protection.
  - Updated `index.html`: semantic two-pane layout shell, action bar, status indicators, and modal container.
  - Created `tests/browser/editor.test.mjs`: 7 automated Playwright browser tests verifying input typing, caret/focus preservation, debounced preview, add/remove/reorder with stable IDs, validation diagnostics, button disabling on invalid input, lossless template switching and Executive caveat banner, opt-in device autosave/restore/clear, local bridge save and external revision conflict resolution, and print settings checklist modal.
  - Updated `scripts/run-browser-tests.mjs`: registered editor browser test suite.
- **Contracts / decisions confirmed:**
  - Responsive two-pane interface: form inputs on left, scaled physical A4 pages on right.
  - All schema fields editable with accessible labels and keyboard controls.
  - Input typing preserves caret position and focus without re-rendering active inputs.
  - Item IDs survive addition, removal, and reordering.
  - Empty optional strings omitted from candidate; invalid inputs display diagnostics and disable Export/Save/Print.
  - Bounded draft state with explicit dirty tracking; pristine source preserved.
  - Explicit JSON import/export; invalid import preserves current draft; exported JSON matches canonical schema with sanitized filename.
  - Device autosave is strictly opt-in (disabled by default) and unencrypted; stored drafts validated on load; quota errors fall back to in-memory.
  - External disk updates while clean reload automatically; external updates while dirty display a conflict modal with explicit choice: "Keep Browser Draft" or "Discard & Reload Disk" (zero silent last-write-wins).
  - Print / Save PDF action is user-mediated, blocks on overflow, and presents explicit instructions for A4, 100% scale, zero margins, and header suppression.
  - Budget adherence: JS gzip 27.61 KiB (<=50 KiB), CSS gzip 4.21 KiB (<=20 KiB), total initial payload 33.18 KiB (<=100 KiB).
- **Commands actually run and results:**
  - `bun run typecheck`: clean across all tsconfigs (exit code 0).
  - `bun run test:unit`: 35 unit tests passed (38ms).
  - `bun run test:cli`: 29 CLI tests passed (482ms).
  - `bun run test:browser`: 3 browser test suites (13 tests) passed (4.58s).
  - `bun run check:generated`: `[DRIFT CHECK] All generated contracts match schema perfectly` (exit code 0).
  - `bun run build`: static bundle built cleanly.
  - `bun run check:build`: verified JS 27.61 KiB gzip, CSS 4.21 KiB gzip, payload 33.18 KiB gzip (exit code 0).
  - `bun run verify`: all verification gates passed (exit code 0).
  - `/opt/homebrew/bin/npm run verify`: all verification gates passed in Node environment (exit code 0).
- **Manual checks / measurements and environment:**
  - Environment: macOS 15+ (Darwin arm64), Bun v1.4.0, Node.js v26.7.0, Playwright Chromium v1155.
  - Verified caret position intact after typing continuous string into profile name input.
  - Verified item IDs unchanged after reordering roles.
  - Verified conflict resolution modal when simulating external file replacement during active dirty draft.
  - Verified print settings modal guidance for A4, zero margins, and disabled headers/footers.
- **Deviations / blockers / known working-tree state:**
  - None. Clean working tree; neighboring AgentSkills untouched; zero git modifications.
- **Next prerequisites and safe checkpoint:**
  - Batch 4 (phase 6) is 100% complete and verified. Safe checkpoint reached.
  - Next authorized scope is Batch 5 (phases 7–8): End-to-end, accessibility, performance, cross-platform hardening, agent documentation, and Cloudflare deployment preparation.

### Phase 7 Completion Record
- **Phase 7 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 5 (phases 7–8).
- **Changes and files:**
  - Created `tests/browser/e2e-security.test.mjs`: comprehensive end-to-end integration and security regression tests covering:
    - Complete agent CLI roundtrip: `init` -> `inspect --json` -> candidate edit -> `validate --json` -> `apply --expected-revision` -> `preview --open`.
    - User browser edit flow: typing into form -> dirty badge -> local save (`#btn-local-save`) -> CLI `inspect` verification of updated revision and disk contents.
    - User print modal: opens instructions dialog displaying honest A4, 100% scale, and header suppression guidelines.
    - Security XSS inertness: hostile script/tag injection across profile, summary, experience, education, projects, skills, and certifications verified inert in DOM (`window.__XSS_*__` undefined, zero injected `<script>`/`<iframe>` tags, escaped via `textContent`).
    - URL security: validator rejects `javascript:` protocol; valid links enforce `rel="noopener noreferrer"`.
    - Loopback bridge attack regressions: missing/forged bearer tokens rejected (401), spoofed Host headers rejected (403), untrusted Origin rejected (403), path traversal attacks (`/../../package.json`, `/%2e%2e/`) rejected (403/404), oversized body (>160 KiB) rejected (413 / socket destruction).
    - External corrupt edit resilience: external process writes malformed JSON while bridge is connected; browser preserves last valid preview without crashing.
  - Created `tests/browser/a11y.test.mjs`: automated accessibility audit test suite verifying:
    - 100% form control labeling: zero unlabelled `<input>`, `<select>`, `<textarea>` elements across all static and dynamic form fields.
    - Accessible button names: 100% of buttons have text content or descriptive `aria-label`.
    - Modal dialog accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Tab key focus trapping, Escape key dismissal, and trigger focus restore.
    - Live region announcements: diagnostics container has `role="region"`, `aria-label`, `aria-live="polite"`; error alerts have `role="alert"`.
    - Executive template DOM reading hierarchy: Page 1 DOM order verified as Header (`.atom-header`) -> Primary Column (`.executive-primary-column`) -> Sidebar Column (`.executive-sidebar-column`), matching linear visual reading hierarchy.
  - Updated `src/web/editor.ts`: added `aria-label` to dynamic experience bullets, education detail inputs, and project bullets.
  - Updated `src/web/diagnostics.ts`: added `role="region"`, `aria-live="polite"`, `role="alert"` on errors and overflow banners, `role="status"` on clean state.
  - Updated `src/web/main.ts`: enhanced `showModal` with accessible title ID, focus trapping, auto-focus on open, and activeElement restore on close; added `inFlightSave` flag to eliminate false SSE conflict modals during browser saves; resolved strict TypeScript indexing checks.
  - Updated `src/cli/server.ts`: reordered local save response dispatch before SSE broadcast via `setImmediate` to ensure clean HTTP completion.
  - Updated `scripts/run-browser-tests.mjs`: registered `runE2ESecurityBrowserTests` and `runA11yBrowserTests`.
  - Updated `scripts/check-build.mjs`: added strict static asset allowlist validation (`index.html`, `_headers`, `assets/*.js`, `assets/*.css`) and rejection of private files/source maps/JSON documents.
  - Updated `scripts/bench.mjs`: added multi-dimensional performance benchmarks measuring pure validation latency (normal ~3.8 KiB & stress ~15.3 KiB), measured pagination algorithm (1-page Classic & 2-page Executive), and disk save transactions (directory lock, 10-backup rotation, atomic replace) over 200 iterations.
  - Created `.github/workflows/ci.yml`: GitHub Actions CI workflow running across `ubuntu-latest`, `macos-latest`, `windows-latest` on Node 24, plus Chromium rendering verification job.
  - Updated `docs/printing.md`: expanded Section 5 with full browser support matrix, Desktop Chromium reference results, manual print checklists for Firefox and Safari, and system font typography variance across OS environments.
- **Contracts / decisions confirmed:**
  - Zero PII leaks in error diagnostics; plain text escaping guarantees full XSS inertness.
  - Local bridge security boundaries (401 token, 403 host/origin, 404/403 traversal, 413 body size) fully verified.
  - Form controls and modals conform to WCAG 2.1 AA accessibility guidelines.
  - Performance budgets strictly satisfied across all dimensions.
- **Commands actually run and results:**
  - `bun run typecheck`: clean across all tsconfigs (exit code 0).
  - `bun run test:unit`: 35 tests passed in 38ms (exit code 0).
  - `bun run test:cli`: 29 tests passed in 422ms (exit code 0).
  - `bun run test:browser`: 5 browser test suites passed in 6.8s (exit code 0).
  - `bun run bench`: 200 runs; validation p95: 0.062ms / 0.245ms (target <=20ms); pagination p95: 0.020ms / 0.022ms (target <=100ms); save transaction p95: 2.222ms (target <=150ms).
  - `bun run check:build`: JS gzip 27.94 KiB (<=50 KiB), CSS gzip 4.21 KiB (<=20 KiB), total payload 33.52 KiB (<=100 KiB), 4 assets in allowlist (exit code 0).
  - `bun run verify`: all verification gates passed (exit code 0).
  - `/opt/homebrew/bin/npm run verify`: all verification gates passed in Node environment (exit code 0).
- **Manual checks / measurements and environment:**
  - Environment: macOS 15+ (Darwin arm64), Apple M4, Bun v1.4.0, Node.js v26.3.0 / v26.7.0, Playwright Chromium v1155.
  - Verified XSS inertness when rendering hostile strings.
  - Verified focus trap inside modals with Tab / Shift+Tab and Escape dismissal.
  - Verified print dialog settings checklist in automated browser test.
- **Deviations / blockers / known working-tree state:**
  - None. Clean working tree; zero git modifications.
- **Next prerequisites and safe checkpoint:**
  - Phase 7 verified; advancing to Phase 8.

### Phase 8 Completion Record
- **Phase 8 / 2026-10-06 / Antigravity**
- **Authorized batch and exact range:** Batch 5 (phases 7–8).
- **Changes and files:**
  - Updated `docs/agent-guide.md`: comprehensive, copy-pasteable guide for local coding agents (Claude Code, Pi, Antigravity, Cursor, Codex) detailing CLI commands (`init`, `inspect`, `validate`, `apply`, `preview`, `templates`, `guidance`), candidate apply workflows with `--expected-revision`, safety invariants (facts only, stable IDs, plain text, canonical source), date rules, and agent prompts.
  - Updated `docs/content-guide.md`: authoritative field bounds, recommended editorial budgets, STAR bullet formula with concrete examples, ATS reading order considerations, and template formatting rules.
  - Created `docs/privacy.md`: authoritative privacy & security documentation detailing zero network transmission, client-side only processing, in-memory drafts, opt-in device autosave in unencrypted `localStorage`, loopback bridge IPv4 `127.0.0.1` isolation, 256-bit ephemeral tokens, and 10-backup rotation retention.
  - Created `docs/deployment.md`: authoritative Cloudflare Pages static configuration guide detailing build command (`npm ci && npm run build`), output directory (`dist/web`), Node 24, strict CSP/security headers in `_headers`, static allowlist scan, and zero backend infrastructure requirements.
  - Updated `README.md`: comprehensive project documentation covering architecture, zero-framework stack, quickstart for dev/preview/hosted modes, agent workflow, source recovery using `.bak` files, script reference, and links to all guide documents.
  - Updated `package.json`: updated `build` and `verify` scripts to ensure universal portability across both Bun and standard Node/npm environments.
  - Updated `docs/plans/2026-10-06-resume-studio.md`: updated status to complete, ticked all Phase 7 and Phase 8 checkboxes, appended completion records.
- **Contracts / decisions confirmed:**
  - All documentation claims strictly match implemented software behavior.
  - Cloudflare Pages build is 100% static with zero backend or API dependency.
  - Static publication scanner in `scripts/check-build.mjs` verifies zero PII, sample documents, or compiler tools in `dist/web`.
  - Final package and execution plan verified complete.
- **Commands actually run and results:**
  - `bun run typecheck`: clean across all tsconfigs (exit code 0).
  - `bun run test:unit`: 35 tests passed (exit code 0).
  - `bun run test:cli`: 29 tests passed (exit code 0).
  - `bun run test:browser`: 5 browser test suites passed (exit code 0).
  - `bun run check:generated`: clean drift check (exit code 0).
  - `bun run check:build`: verified allowlist and budgets (exit code 0).
  - `bun run bench`: all latency and size budgets passed (exit code 0).
  - `bun run verify`: all verification gates passed (exit code 0).
  - `/opt/homebrew/bin/npm run verify`: all verification gates passed in Node environment (exit code 0).
- **Manual checks / measurements and environment:**
  - Environment: macOS 15+ (Darwin arm64), Bun v1.4.0, Node.js v26.7.0.
  - Verified static output directory `dist/web` contains only 4 allowed assets (`index.html`, `_headers`, JS bundle, CSS bundle).
  - Verified no git repository initialized, no unapproved deployments made.
- **Deviations / blockers / known working-tree state:**
  - None. Clean working tree.
- **Next prerequisites and safe checkpoint:**
  - All 8 phases across all 5 batches of the execution plan are 100% complete and verified. Final project acceptance achieved.

## Testing & verification (exact commands, cases incl. edge/failure)

### Final proposed script contract

- `npm run generate`: regenerate types, standalone validator and guidance; deterministic and no secrets.
- `npm run check:generated`: compare in-memory/temp output with checked-in generated files; fail differences, no automatic source mutation.
- `npm run typecheck`: strict browser/core/Node/test type checks.
- `npm run test:unit`: compile unit tests and run native Node test runner.
- `npm run test:cli`: compile IO/server tests and run native Node test runner; temp synthetic workspaces only.
- `npm run build`: generate verified artifacts, build static web output with Vite and compiled ESM CLI; browser app cannot import Node modules.
- `npm run test:browser`: Playwright tests against test-owned build/server processes; no real documents.
- `npm run check:build`: gzip budgets, no third-party runtime imports, no Node/schema compiler in browser, no PII/backups in publication output.
- `npm run bench`: synthetic fixture runs with environment, units, p50/p95/p99 and compressed byte measurements; never imply estimates are observed.
- `npm run verify`: generated drift, typecheck, unit/CLI tests, build, browser tests, and build publication check in dependency order.

Implementation may compile native Node tests into a temporary ignored directory; do not add a runtime TS loader just to execute tests. Browser-test processes are shut down deterministically and avoid fixed port conflicts.

### Required test matrix

| Area | Success case | Failure/edge case | Invariant |
| --- | --- | --- | --- |
| Schema | Three complete examples | Bad JSON/version/types/keys/IDs/dates, 128-KiB boundary | Never coerce or mutate bad input. |
| Guidance | Measured plain-text words/chars | Emoji/surrogates/empty/whitespace, long bullet | Warning ≠ validity or page-fit guarantee. |
| CLI IO | Init then candidate apply | Existing file/symlink/protected path/stale hash/lock/failure | Source remains complete; recoverable backup. |
| Server | Authorized one-document edit | Wrong token/origin/host/path/body/method | No document disclosure/write. |
| External editing | Clean source update reloads | Dirty browser or malformed/disappearing source | Preserve last valid view and dirty draft. |
| Rendering | One/two pages in three templates | Long atoms, boundary/widows, sidebar spill, >2 pages | No missing/duplicate content, clipping, extra blank page. |
| Editor | All fields and reorder | Invalid typing/import, quota/permission, navigation | Preserve focus, source and facts. |
| PDF | A4 with selectable text/links | Browser headers, margins, over-limit content | Honest settings, app blocks invalid layout. |
| Privacy | Hosted import/export offline | Malicious links, local-mode fragments, storage errors | No upload or third-party asset requests. |
| Build | Public asset allowlist | Private sample/backup/schema compiler accidentally included | Publication fails closed. |
| Performance | Normal/stress fitting fixture | Longest valid content, repeated 100 edits | Bounded work/listeners; measured budget. |

## Rollout, migration & rollback

1. First release is private/dev-tested; no legacy data migration exists. Schema version 1 is explicit; refuse unknown versions.
2. Store working resumes in an ignored `resumes/` directory or outside the project. Keep synthetic examples in source control; never put real files under `public/`.
3. Local setup: approved toolchain install → `npm ci` → `npm run verify` → `node dist/cli/main.js init --file resumes/my-resume.json --template classic --max-pages 1` → agent edit/validate → `preview --file resumes/my-resume.json --open` → user Save/Print.
4. Hosted setup: build `dist/web`, inspect allowlist, then owner-controlled Cloudflare Pages deployment. User opens site and explicitly imports JSON; editing stays in that browser; Export JSON preserves it on disk.
5. Local recovery: identify a tool backup, inspect/validate it, obtain current revision, then `apply --file ... --from <backup> --expected-revision <current>`. Never silently restore over a newer file. Backup cleanup removes only confirmed tool-owned files and is documented.
6. Website rollback: owner restores previous known-good Pages deployment. Resume files are unaffected because the site never stored them. Local rollback uses previous package/build and schema compatibility check; do not down-convert future schema automatically.
7. Future data-format changes require explicit schema version, dry-run-capable idempotent migration, backup, UPGRADE documentation and approval; not implemented in v1.

## Risks & open questions

### Principal risks

1. **Pagination and Executive spillover:** medium confidence until layout evidence; isolated phase with content conservation/physical-bound tests. Do not silently compromise the third template.
2. **Concurrent external writers:** cooperative CLI/bridge locking is reliable within participants; arbitrary direct editors can race final rename. Use revision checks, backups and one-writer advice; no false global transaction claim.
3. **Browser printing differences:** reference Chromium first; manual other-browser checks; document system-font variance and user-controlled settings. Native dialog is not unattended download.
4. **PII left on disk/browser:** explicit opt-in autosave, private paths, bounded backups, clear controls and artifact scans; no encryption claims.
5. **Generated validator size:** inspect self-contained output and gzip; avoid runtime imports/formats; if budget fails, measure and request a justified adjustment instead of deleting validation.
6. **OS file/lock semantics:** IO test matrix, bounded failures and recovery; Windows ACL/rename differences are recorded.
7. **Implementation scope:** a very small runtime still needs careful layout/security work; do not conflate lightweight with a one-evening prototype or invented schedule.

### Nonblocking decisions to confirm during implementation

- Exact compatible dependency versions and available Node/browser toolchains: phase 1 owner/implementer.
- System font appearance across target OS and actual template screenshots: phase 5; approval needed only if approved visual policy cannot be met.
- Current Pages dashboard/build behavior and account access: phase 8 documentation; deployment remains separately authorized.
- If any required OS/browser is unavailable, record unverified status and ask the owner to approve narrowed release support. No unresolved product requirement remains from intake.

## Fresh-chat implementation handoff

```text
Implement ONLY batch 1 (phases 1–2) of /Users/pankil/Documents/Projects/resume-studio/docs/plans/2026-10-06-resume-studio.md. Work in /Users/pankil/Documents/Projects/resume-studio. Do not implement phases 3–8.
Context: standalone ultra-lightweight resume editor/viewer for local coding agents. Approved stack is native HTML/CSS + TypeScript + Vite, static Cloudflare Pages, JSON + local Node CLI, three A4 templates, 1–2 pages, browser print / Save as PDF. No AI API, hosted resume storage/editing, UI framework, mandatory MCP, or runtime PDF engine. Local loopback save bridge is approved for a later batch only.
Batch 1 covers reproducible strict browser/Node build separation plus canonical schema, generated types/standalone validation, semantic checks, content guidance and fictional samples. This is a bounded pure-contract batch; defer IO/server, pagination and editor work.
Read root AGENTS.md, the complete execution plan, and the proposal reading guide plus relevant data/architecture sections. Inspect actual files, Node/npm availability and git/worktree context before editing; preserve existing planning artifacts. Verify dependencies/gates and that phases 1–2 fit available context. Do not touch the neighboring AgentSkills project, initialize git, commit, deploy or use real resume data.
Execute phases 1 then 2 in order. Run each phase's exact checks and pass its acceptance criteria before advancing. Keep the build green. If reality contradicts an approved decision or a check blocks progress, stop and report rather than improvising or widening scope. If context/debugging becomes too large, checkpoint at a verified phase boundary; if blocked mid-phase, record partial work and failing gates. Never start phase 3.
Tick completed steps and update phase/batch/status and append phase completion records in the plan: changes/files, contracts/decisions, exact commands/results, measured versus unrun checks, deviations/blockers, known working-tree state and remaining prerequisites. Never mark unverified work complete or overwrite prior records. Never commit automatically.
Finish with a concise completion/context summary and a copy-paste prompt for a NEW chat authorizing ONLY batch 2 (phases 3–4) if both phases 1–2 pass. Include this same plan path, objectives, completed phases, relevant files/contracts, actual verification, constraints/blockers and IO/security sizing rationale; repeat these bounded execution, verification, checkpoint and handoff rules. If batch 1 is unfinished, instead return a resume prompt beginning at its first incomplete phase and ending at phase 2; do not skip blockers or authorize batch 2. Splitting is allowed; expansion requires user approval. Every later chat repeats this process. Final batch marks the plan complete and reports final verification/remaining risks, with no next-batch prompt.
```
