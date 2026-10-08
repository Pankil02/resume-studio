# Risks and Failure Analysis

## Failure matrix {#risks-matrix}

| Dimension | Failure | Control | Test / residual risk |
| --- | --- | --- | --- |
| Input validation | Bad schema, oversized JSON, unsafe URL/control | Strict generated schema + semantics, preparse byte bound, safe text DOM | Boundary/unknown fields/Unicode/XSS fixtures; editable invalid draft stays local. |
| Permissions / tenancy | Malicious site reads/writes local file | Loopback only, session bearer, exact Origin/Host, selected file, no CORS | Missing/wrong token, DNS-rebinding Host, traversal attacks; local compromised PC is out of scope. |
| PII | Real resume in deployment/log/storage | Public allowlist, no uploads, safe logs, explicit autosave, ignored private dirs | Build/request/log inspections; drafts/backups are unencrypted local PII. |
| Concurrency | Browser overwrites agent update | Cooperative lock, exact byte revision, reread/recheck, explicit conflict | Two writers/stale save; arbitrary direct editors can race final rename. |
| Consistency | Partial write or content omitted in layout | Temp + backup + atomic rename; source-atom conservation | Inject IO failure/content count; atomic visibility is not universal power-loss durability. |
| Resilience | Disconnect/watch miss/disk failure | Bounded event reconnect + reconciliation, last valid preview, preserved draft | Replace/delete/bad JSON/reconnect/disk seam; no automatic restore over newer source. |
| DB contention | Not applicable | No backend database; local file lock handled above | N/A; revisit after approved cloud persistence. |
| Scale / throttling | Huge body/event/repeated edit work | 128-KiB source, 160-KiB bridge envelope, debounce/queue limits | Oversized stream/repeated edits; static hosting quotas must be checked separately. |
| Lifecycle | Stale lock/listener/backup/leaked token | Own-lock cleanup, bounded retention, abort/shutdown, token memory only | Repeated start/stop/failure; stale lock is not automatically stolen. |
| Observability | Errors expose content or failures invisible | Safe issue codes/paths, timings, concise local status, no analytics | PII-value exclusion tests; explicit inspect command intentionally prints chosen source. |

## Product-specific risks {#risks-product}

- A4 pagination: fixed geometry alone is insufficient. Measured legal atoms, keep-with-next, source mapping and overflow gating are mandatory.
- Executive: first-page sidebar can overflow independently of primary content. Full-width continuation must use newly measured widths and retain every entry once; otherwise stop for owner decision.
- Native PDF: user controls dialog/settings; browser headers/margins may add pages. Provide exact instructions and manual print checks; no guarantee of unattended download.
- ATS: conservative templates are ATS-first, not ATS-certified. Two-column order is explicitly less predictable; preserve semantic text and test extraction rather than claiming parser scores.
- Typography: system font metrics vary; no universal screenshot identity. If owner requires exact cross-device appearance, reconsider a licensed self-hosted font with budget/approval.
- Lightweight promise: zero runtime packages does not mean zero development dependencies or no test-browser install. Disclose each tool's role.

### Technical details {#risks-security}

- Resume values use textContent and safe attribute construction, never innerHTML/template evaluation or CSS strings.
- HTTP/HTTPS links only, no credentials, javascript/data/file schemes, fetched previews or remote images. Links are user-clicked and safe-rel labeled.
- CSP self-only scripts/connect and no objects/frames/base override; inline scripts forbidden. If scaling requires style attributes, document the narrowly accepted style policy rather than pretending an incompatible CSP is effective.
- Local private routes are no-store; no path selection; no token query strings/storage. Capability bootstrap fragment is removed immediately; local launch credential is not persisted in logs.
- Local paths reject protected destinations/symlinks; static routing checks decoded paths, realpath containment and MIME. Windows permissions/rename behavior must be tested, not assumed POSIX-equivalent.
- Browser cannot save stale source automatically. Keep/export draft or explicit reload are visible choices; applying a candidate is a revisioned operation.
- One active direct writer is advised; cooperative CLI apply is the recommended concurrent path. Final recheck is not a lock against arbitrary editor processes.

## Required release gates {#risks-gates}

- Generated contracts are deterministic and drift checked; all hard/security schema cases pass.
- All templates conserve content; unsupported overflow blocks in-app print, not JSON storage.
- Loopback attack and stale-write tests pass; failures preserve recoverable complete documents.
- Hosted request capture shows no resume sends/third-party assets; public build excludes local documents/backups/code.
- Browser keyboard/contrast/field error behavior checked; Chromium print tested; unavailable Firefox/Safari/OS checks remain explicitly unverified or need narrowed-support approval.
- Performance targets measured with environment/units; exceptions require owner acceptance, not silent test suppression.
- Actual deployment, git operations, AI APIs, cloud data, MCP and unattended export remain separately gated.
