# Overview

## Outcome {#overview-outcome}

Agents update validated JSON; users edit and preview professional A4 resumes privately, then save selectable-text PDFs from the browser.

## Recommendation {#overview-recommendation}

- Use native HTML/CSS + TypeScript, a Vite build, and static Cloudflare Pages deployment.
- Ship no UI framework, hosted resume backend, database, AI integration, external assets, mandatory MCP, or runtime PDF engine.
- Use plain resume JSON and a local Node CLI as the universal agent contract.
- Keep browser editing native: form fields, live physical pages, field guidance, template switching, explicit JSON import/export.
- Add the owner-approved loopback preview/save bridge only to local CLI mode; never deploy its routes.
- Three professional templates share one strict schema and measured pagination; first two are single-column, third has a deliberate ATS/order caveat.

## Chosen trade-off {#overview-tradeoff}

The lightweight runtime is not a shortcut around layout or security. Native print requires the user to choose Save as PDF; arbitrary external editors do not participate in our file lock; system fonts vary across operating systems. These limitations are accepted and documented rather than hidden behind heavier tooling.

An alternative compiled Svelte frontend is reasonable if the editor grows beyond bounded sections, but it adds an unnecessary component/runtime contract for the current product. A plain-JavaScript implementation is smaller operationally, but weaker static shared-contract checking is not worth it for file mutation and structured data.

## Scope and assumptions {#overview-assumptions}

| ID | Classification | Statement | Confidence / revisit |
| --- | --- | --- | --- |
| ASM-01 | assumption | Desktop Chromium is initial print reference; Firefox/Safari checks are manual. | Medium; support demand changes. |
| ASM-02 | assumption | Node 24 LTS is the local CLI runtime. | Medium; confirm installed toolchain. |
| ASM-03 | approved | English, no photos, A4, one or two pages. | High; new language/photo/page requirements require approval. |
| ASM-04 | estimate | Typical document 5–30 KiB; hard import bound 128 KiB. | Medium; synthetic workload validation. |
| ASM-05 | assumption | Bounded full-preview rerender meets latency targets. | Medium; measure in hardening phase. |
| ASM-06 | approved | Explicit files, no hosted resume writes; autosave is opt-in. | High; cloud-sync request changes architecture. |
| ASM-07 | assumption | System-font cross-OS variation is acceptable. | Medium; exact output requires another font decision. |

## Evidence and confidence {#overview-evidence}

- Observed: owner selected this stack/workflow during intake; root `AGENTS.md` records decisions and boundaries.
- Observed: target directory did not exist before planning; there is no active resume implementation to cite or reuse.
- Proposed source paths in this bundle describe future code, not code observed to work.
- Execution planning conventions: `/Users/pankil/Documents/Projects/AgentSkills/plan-walkthrough/SKILL.md:32` and `:115`.
- High confidence: static hosting, local privacy boundary, no AI API requirement.
- Medium confidence until tested: all-browser two-page typography, Executive spillover, exact bundle budget.
- Unknown: actual current Cloudflare account/build settings; phase 8 owns verification of official documentation, not deployment.
