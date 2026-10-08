# Options and Decisions

## Fair stack comparison {#options-comparison}

Same requirements in all options: local JSON/CLI, three A4 templates, form editor, no hosted resume storage, native print, strict input validity.

| Option | Runtime/build | Benefits | Cost / reason not chosen |
| --- | --- | --- | --- |
| A: Native HTML/CSS + TypeScript | Vite plus generated standalone validator; native DOM runtime | Explicit typed boundaries, small publication, no framework | Manual form/state wiring; selected because document/editor scope is bounded. |
| B: Native HTML/CSS + JavaScript | No mandatory compilation; same generated/runtime validation | Fewest build concepts; straightforward static hosting | Shared IO/UI contracts rely more on tests/JSDoc; owner selected TS instead. |
| C: Svelte + TypeScript | Vite/Svelte compile pipeline; small component runtime | Ergonomic form components/reactivity, viable if UI grows | Extra framework concepts/dependencies without a demonstrated v1 need. |

None removes pagination work, content validation, browser-print differences, or local concurrency controls. No precise bundle/latency benchmark is claimed for unbuilt alternatives.

## Hosting and export decisions {#options-hosting}

| Decision | Selected | Viable alternative | Accepted downside |
| --- | --- | --- | --- |
| Hosting | Cloudflare Pages static | Worker static assets | Need explicit JSON import/export; no cloud persistence. |
| Fonts | System stacks | Self-hosted licensed font | Different OS metrics; measure actual layout, not assumed character fit. |
| PDF | Native browser print | Optional local Playwright exporter | User chooses filename/save; no unattended download. |
| PDF model | Same semantic HTML/CSS | Dedicated PDF library layout | Browser settings vary; avoid duplicating a second text/layout engine. |
| Data validation | JSON Schema + generated validator/types | Small handwritten validator + types | More dev tooling, but no browser schema compiler. |

Canvas/HTML screenshot PDF is rejected: rasterized text, bigger files, inferior text selection/search/accessibility. Hosted browser-rendered PDF is rejected: sends personal data to a backend and adds infrastructure not requested.

## Agent access decision {#options-agents}

- Selected: documented JSON schema and Node CLI; agents inspect/edit/validate/apply and start preview using normal terminal/filesystem tools.
- Direct file edit is simplest for a single writer. Safer concurrent workflow uses candidate JSON and `apply --expected-revision` under a shared lock.
- Local stdio MCP is a viable future thin adapter, not needed now. It would expose shared application functions, not invent another schema or hosted API; per-agent configuration is the current downside.
- Owner specifically rejected AI API integration and hosted editing. The local browser bridge was separately clarified and approved; agents do not call it.

## Decision confidence and revisit triggers {#options-triggers}

| Decision | Confidence | Revisit trigger |
| --- | --- | --- |
| Native UI | High for bounded v1 | Growing UI scope or measured edit/preview p95 above 250 ms after simple fixes; request approval before framework. |
| Static hosting | High | Owner explicitly requests accounts/cloud synchronization/server storage. |
| Native print | High, with dialog limitation | Owner explicitly requests unattended generation or exact cross-OS identity. |
| Three templates | Medium before evidence | Executive cannot pass content conservation/page-fit tests; stop for owner decision, not silent removal. |
| Generated validation | High correctness, medium size | Standalone validator causes total JS above 50 KiB gzip; measure before changing budget. |
| Files/CLI | High | Repeated approved need for discoverable MCP tools across agents; add optional adapter only. |

## Minimality boundaries {#options-minimality}

- Zero production npm dependencies is a target. Generated validation is self-contained and Node adapters use standard library.
- Development dependencies are justified: TypeScript for typing, Vite for a compact build/dev server, Ajv/type generator for one canonical contract, Playwright for test-only browser geometry.
- Playwright browsers are test infrastructure, not required for a user's PDF download or local CLI operation.
- No database, caches, queues, workers, ORM, event bus, repository framework, generic plugin manager, UI kit, icon pack or utility CSS framework.
- Professional design comes from disciplined CSS typography/spacing, not a large dependency stack.
