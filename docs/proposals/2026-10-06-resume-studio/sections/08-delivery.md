# Delivery and Implementation Handoff

## File ownership {#delivery-files}

| Area | Proposed paths | Responsibility |
| --- | --- | --- |
| Instructions/execution | `AGENTS.md`, `docs/plans/2026-10-06-resume-studio.md` | Approved choices, phase/batch status and evidence. |
| Contract | `schema/`, `scripts/generate-contracts.mjs`, `src/core/` | Strict schema/generated validation/types/guidance. |
| Local IO | `src/cli/` | Deterministic commands, selected-file safe writes, preview bridge. |
| Browser | `src/web/`, `index.html` | Native editor/draft/privacy/print and adapters. |
| Layout | `src/web/templates/`, shared block/pagination modules | Three templates, measured A4, content conservation. |
| Verification | `tests/`, `scripts/check-build.mjs`, `scripts/bench.mjs`, CI | Security/layout/OS/budget gates. |
| Public output | `dist/web`, `public/_headers` | Static Cloudflare assets only. |
| Docs/examples | `README.md`, `docs/*.md`, `examples/*.json` | Agent/user flows and obviously fictional data. |

## Ordered execution batches {#delivery-batches}

| Batch | Exact phases | Deliverable / gate |
| --- | --- | --- |
| 1 | 1–2 | Reproducible toolchain + canonical schema, generated contracts and pure validation/guidance. |
| 2 | 3–4 | CLI/cooperative transactions + secured loopback read/events/save bridge. |
| 3 | 5 only | Three professional templates, measured pagination, print geometry/content conservation. |
| 4 | 6 only | Browser forms, import/export, local conflicts, opt-in storage and user print action. |
| 5 | 7–8 | End-to-end/security/a11y/OS/performance gates + docs/deployment preparation. |

The full execution plan owns atomic file steps and acceptance commands. Layout and stateful UI are separate batches because visual/state debugging needs reserve. No invented model/token capacity claims. Verify between phases; context pressure allows splitting, never silent expansion.

## Rollout and rollback {#delivery-rollout}

- First build only with synthetic examples. Source schema v1; unknown versions refused. There is no legacy migration.
- Private resumes stay in ignored `resumes/` or outside the project; never inside `public/` or `dist/web`.
- Local workflow builds web/CLI, edits validated JSON, launches selected-file preview, then explicitly Save/Print.
- Hosted workflow imports JSON into browser memory and exports it back; app does not call a cloud resume endpoint.
- Proposed Pages build: `npm ci && npm run build`; publish directory `dist/web`; confirm current official Node/build/header behavior in phase 8. No account credentials are needed to write deployment documentation.
- Actual Cloudflare deployment/DNS/account changes require a separate owner request. Do not initialize git or commit during implementation by default.
- Recovery uses validated backup candidate + current revision apply. Do not auto-restore over a newer document. Website rollback cannot modify local resumes because none were stored remotely.

### Tests {#delivery-verification}

- Per-phase checks are specified in the execution plan; final `npm run verify` covers generated drift, strict type checks, native unit/CLI tests, build, Playwright browser tests and publication budgets.
- `npm run bench` reports actual synthetic p50/p95/p99 and compressed bytes with a recorded environment.
- Manual print checks cover A4, 1/2 pages, selectable text/links, no header/footer/chrome, legal splits and overflow in supported browsers.
- No application tests exist at planning time. Proposal-format validation checks these documents, not future product correctness.

## Fresh-chat prompt {#delivery-handoff}

```text
Implement ONLY batch 1 (phases 1–2) of /Users/pankil/Documents/Projects/resume-studio/docs/plans/2026-10-06-resume-studio.md in /Users/pankil/Documents/Projects/resume-studio. Do not implement phases 3–8.
Read root AGENTS.md, the entire execution plan and relevant proposal architecture/data sections. Native HTML/CSS + TypeScript + Vite; static Cloudflare Pages; local JSON + Node CLI; no UI framework, AI API, hosted document storage/editing, mandatory MCP or runtime PDF generator. Three A4 templates and a secured local browser-save bridge are later batches, not this one.
Batch 1 is scaffold/build separation and strict canonical schema, generated types/standalone validation, semantic checks, content guidance and fictional examples. Inspect actual files/toolchain/git context first. Preserve plans and neighboring AgentSkills; never initialize git, commit, deploy, overwrite real resume files or use secrets.
Execute phase 1 then phase 2; verify each before advancing. Keep build green. Stop on failed gates/conflicting reality instead of expanding scope. Reassess capacity at phase boundaries; checkpoint safely if needed, or record partial work/blockers mid-phase.
Tick completed steps and update phase/batch status; append actual files/contracts/commands/results/measurements, unrun checks, deviations and remaining prerequisites in the execution plan. Never claim unverified success or replace prior records.
Return completion/context summary and a copy-paste NEW-chat prompt for ONLY batch 2 (phases 3–4) when both phases pass; include exact plan path, completed work, relevant files/contracts, verification, IO/security sizing, constraints and these same execution/checkpoint/handoff rules. If incomplete, return a resume prompt starting at the first incomplete phase and ending at phase 2; do not skip blockers or authorize later work. Each later chat repeats the bounded process; final batch returns final verification/risks and marks complete, with no next prompt. Splitting is allowed; expansion requires approval.
```
