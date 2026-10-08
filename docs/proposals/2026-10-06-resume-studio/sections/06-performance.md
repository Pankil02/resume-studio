# Performance and Workload

## Budgets {#performance-budgets}

Every number below is a proposed target or explicitly labeled assumption, not a measurement of code that already exists. Phase 7 owns observed results and the reference environment.

| Dimension | Target | Measurement |
| --- | --- | --- |
| Browser JavaScript | ≤50 KiB gzip total | Production artifacts; include generated validation. |
| Browser CSS | ≤20 KiB gzip | All editor/template/print styles. |
| Initial transfer | ≤100 KiB compressed first-party assets | Cold browser request capture; no fonts/images/third parties. |
| Validation | p95 ≤20 ms, maximum 128-KiB input | 200 synthetic runs; report p50/p95/p99. |
| Rendering work | p95 ≤100 ms, worst fitting two-page fixture | Measure after font readiness and correct-width DOM layout. |
| Edit-to-preview | p95 ≤250 ms including about 150-ms debounce | User input to current generation's settled preview. |
| Local save | p95 ≤150 ms on local SSD | 10–128 KiB candidate, lock/revision/backup included. |
| Hosted editing network | 0 resume-content requests | Assert no send/fetch/beacon/websocket containing draft data. |
| Idle resources | Bounded DOM/listeners/backups; 10 backups per document | 100 repeated edits/reconnects; cleanup assertions. |
| Print | No application network round trip | User/browser dialog time is not a product latency guarantee. |

## Workload model {#performance-workload}

- Baseline assumption: one document, one draft, 5–30 KiB source, one A4 page, 2–4 roles, no binary assets.
- Fit stress: largest actually fitting two-page document per template with legal entry splits and Executive spillover.
- Input stress: 128-KiB structurally valid document with maximum arrays/strings, which may intentionally overflow and must remain recoverable.
- Concurrency: one bridge process owns one document; CLI/bridge cooperative writers serialize through one lock; multiple direct external editors are not transactional.
- Cloud edits/day: zero because edits happen locally. Application-load burst is static-asset delivery, not backend CRUD.

### Technical details {#performance-sizing}

Illustrative deployment assumptions, not forecasts:

- Daily users 100 × app opens/user/day 3 = 300 app loads/day.
- Mean arrival: 300 ÷ 86,400 seconds = 0.00347 app loads/s.
- Burst factor 20 gives 0.0694 peak app loads/s.
- At ≤100 KiB compressed/load, ≤30,000 KiB/day before browser/CDN cache reuse.
- No server CPU/DB pool is provisioned for resume work; no load claim about Cloudflare quotas is made.
- Little's Law relates average arrival to average residence for a real queue; no application queue exists to size in this static deployment. Local write-lock duration is measured, not converted into a cloud capacity guess.

## Resource accounting {#performance-resources}

| Resource | Classification / work | Revisit threshold |
| --- | --- | --- |
| Browser CPU | Applicable: parse/validate, plain-text metrics, DOM measurement/pack | Measured p95 misses budget after simpler rendering fixes. |
| Browser RAM | Applicable: one document/draft/measurement root, bounded diagnostics | Listener/DOM count grows across repeated edits. |
| Wire | Applicable: public assets only; no resume uploads | Owner adds cloud sync/assets, requires approval. |
| Database queries/indexes/locks | N/A: no backend or database | Approved hosted persistence. |
| Cloud blob storage | N/A: no photos or hosted PDF files | Approved media/remote export requirement. |
| Local filesystem | Applicable: bounded read, lock, backup, atomic rename | Permission/rename semantics fail an OS acceptance test. |
| Cloud cache invalidation | Static hashed assets and entry HTML policy only | Current Pages behavior must be verified before deployment. |
| Background queues | N/A: no jobs/server exports | Approved unattended export. |

## Optimization policy {#performance-policy}

- Start with a preview-subtree rerender and typed template map; do not invent virtual DOM, worker threads, microservices or caching layers.
- Debounce expensive measurements; generation IDs reject stale work; preserve input DOM focus.
- Avoid repeated hidden full-document clones and unlimited undo/history in v1.
- Use generated standalone validation; do not ship Ajv/compiler, Node code or Playwright to browser output.
- System fonts remove font downloads but require per-environment actual measurement; hard text bounds are not layout predictions.
- If a budget fails, record artifact/timings and root cause; optimize measured bottleneck or seek explicit owner exception. Do not remove safety checks to reach a size target.
