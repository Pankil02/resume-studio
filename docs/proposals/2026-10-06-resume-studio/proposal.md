# Resume Studio — Product and Architecture Proposal

```proposal-meta
{
  "schemaVersion": 1,
  "id": "resume-studio",
  "title": "Resume Studio",
  "status": "ready",
  "created": "2026-10-06",
  "updated": "2026-10-06",
  "owner": "Project owner / next implementing agent",
  "summary": "Ultra-lightweight local-first JSON resume editing, three professional A4 templates, private browser workflows, and user-mediated PDF export on Cloudflare Pages.",
  "documents": [
    { "id": "overview", "tab": "overview", "title": "Overview", "path": "sections/01-overview.md" },
    { "id": "requirements", "tab": "requirements", "title": "Requirements", "path": "sections/02-requirements.md" },
    { "id": "options", "tab": "options", "title": "Options", "path": "sections/03-options.md" },
    { "id": "architecture", "tab": "architecture", "title": "Architecture", "path": "sections/04-architecture.md" },
    { "id": "data-api", "tab": "data-api", "title": "Data and Local Contracts", "path": "sections/05-data-api.md" },
    { "id": "performance", "tab": "performance", "title": "Performance", "path": "sections/06-performance.md" },
    { "id": "risks", "tab": "risks", "title": "Risks", "path": "sections/07-risks.md" },
    { "id": "delivery", "tab": "delivery", "title": "Delivery", "path": "sections/08-delivery.md" }
  ]
}
```

## Reading Guide

- Start with [Overview](#overview-outcome), then [Requirements](#requirements-acceptance) and [Options](#options-comparison).
- Engineers: [Architecture](#architecture-boundaries), [Data contracts](#data-contracts), [Performance](#performance-budgets), and [Risks](#risks-matrix).
- Implementation: [Delivery](#delivery-batches); the separate execution plan owns complete atomic steps, acceptance checks, status and batch handoffs.
- Root `AGENTS.md` captures owner-approved constraints. Execution plan: `docs/plans/2026-10-06-resume-studio.md`.
- All application components are proposed; no source implementation exists at proposal time. Targets/assumptions are not measured results.
- This proposal does not authorize implementation, deployment, git initialization, cloud changes, or adding AI APIs.
