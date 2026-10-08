# Requirements

## Actors and workflows {#requirements-actors}

- Resume owner: import a JSON file, edit forms, change template, inspect A4 fit, export JSON, use Print / Save PDF.
- Local coding agent: read schema/guide, inspect facts, edit JSON or a candidate, validate, apply with revision checking, launch preview; user performs native PDF save.
- Maintainer: reproduce build/tests, publish only static assets, preserve schema compatibility and user data.
- Hosted visitor: app downloads public assets only; their imported resume stays in browser memory unless explicitly exported or autosaved locally.

## Acceptance criteria {#requirements-acceptance}

| ID | Criterion | Verification |
| --- | --- | --- |
| AC-01 | Three professional templates consume the same strict JSON without factual loss. | Cross-template round-trip/content conservation tests. |
| AC-02 | Exactly one or two A4 pages, no silent clipping, shrinking or extra blank page. | Render bounds, overflow fixtures, test PDF/manual print. |
| AC-03 | Every supported field is editable with understandable lengths and writing guidance. | Full-field UI tests and generated-guide consistency. |
| AC-04 | Claude Code/Pi/Antigravity can update via files/CLI without an API key/plugin. | Documented synthetic end-to-end CLI flow. |
| AC-05 | Hosted app makes no resume-content requests or third-party asset calls. | Browser request inspection/security tests. |
| AC-06 | Local browser Save writes only the selected file and rejects stale/unauthorized writes. | Token/origin/path/revision attack tests. |
| AC-07 | Valid exported JSON round-trips; invalid import preserves prior draft. | Import/export fixtures and state tests. |
| AC-08 | PDF is user-mediated, selectable-text, A4, with no editor chrome. | Manual browser checklist and test print geometry. |
| AC-09 | Public build excludes private resumes/backups and local Node code. | Allowlist/bundle gate. |
| AC-10 | Keyboard form use, readable contrast and announced errors are supported. | Automated DOM assertions plus manual keyboard audit. |

## UI states {#requirements-states}

| State | Visible behavior | Allowed action |
| --- | --- | --- |
| First launch | Fictional starter; import/help; autosave off. | Import or edit. |
| Valid clean draft | Ready preview and current revision in local mode. | Edit/template/export/print. |
| Dirty valid draft | Unsaved marker; Save is explicit in local mode. | Save/export/print. |
| Invalid draft/import | Field paths and safe messages; preserve text/previous source. | Correct fields; do not save/print invalid candidate. |
| Page overflow | Incomplete-preview marker and unplaced-content diagnostics. | Edit/content trim or choose 2 pages; no app print. |
| External file changed | Clean reload; dirty draft gets conflict choices. | Keep/export draft or explicitly reload; no last-write-wins. |
| Save denied/fails | Safe error; draft remains intact. | Retry with fresh revision after inspection. |
| Offline/disconnected | Hosted import/export still works after assets; local save unavailable. | Keep editing/export; reconnect explicitly. |
| Opt-in restored draft | Show restore/discard choice and privacy notice. | Restore into memory, never overwrite disk automatically. |

## Non-goals {#requirements-nongoals}

No AI generation, cloud API/storage, accounts, mandatory MCP, automatic binary PDF export, OCR/DOCX/PDF import, headshots, rich text, arbitrary plugins/sections, cloud sync, analytics, service worker, drag-and-drop dependency, more than two pages, or multilingual/RTL in v1.

## Workload and glossary {#requirements-workload}

- Baseline: one owner, one active document, 5–30 KiB JSON, one-page Classic or Modern.
- Stress: bounded 128-KiB structurally valid document, large arrays/long strings, rapid edits and concurrent local revisions. Such content may correctly overflow.
- Fit stress: a maximum actually fitting two-page document in every template, including Executive sidebar spillover.
- A4: physical 210 × 297 mm portrait, not an arbitrary browser screenshot.
- Revision: SHA-256 of exact source file bytes; whitespace changes matter.
- Source: JSON file; output: rendered HTML/printed PDF; draft: browser candidate not yet explicitly saved/exported.
- ATS-first: conservative single-column selectable-text reading order, not a promise about proprietary recruiting systems.
- Local bridge: narrowly scoped browser transport on 127.0.0.1; it is not a cloud API or the agent channel.
