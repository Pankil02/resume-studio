# Architecture

## Boundaries {#architecture-boundaries}

- Cloudflare serves public static files only. Resume content never enters a cloud endpoint.
- Shared core owns strict validation, semantic checks, content metrics and template metadata; pure functions, no IO.
- Browser owns draft state, native fields, storage permission, semantic rendering, physical A4 measurements and print action.
- Node CLI owns selected-file reading/writing, revision hashes, shared lock/backups and optional local preview transport.
- Renderer owns content conservation and pagination. UI owns user choices; no automatic content rewrite or deletion.

```diagram-json
{
  "schemaVersion": 1,
  "type": "graph",
  "id": "resume-flow",
  "title": "Local-first resume workflow",
  "summary": "Public assets are hosted; resume editing and saving stay on the device.",
  "nodes": [
    { "id": "agent", "label": "Local coding agent", "role": "actor", "lane": 0, "order": 0 },
    { "id": "cli", "label": "Node CLI", "role": "service", "lane": 1, "order": 0 },
    { "id": "file", "label": "Resume JSON + backups", "role": "store", "lane": 2, "order": 0 },
    { "id": "bridge", "label": "Loopback preview/save", "role": "service", "lane": 2, "order": 1 },
    { "id": "browser", "label": "Native browser editor", "role": "service", "lane": 3, "order": 0 },
    { "id": "pages", "label": "Cloudflare public assets", "role": "external", "lane": 4, "order": 0 },
    { "id": "layout", "label": "A4 templates + validation", "role": "service", "lane": 3, "order": 1 },
    { "id": "pdf", "label": "User Save as PDF", "role": "actor", "lane": 4, "order": 1 }
  ],
  "edges": [
    { "id": "invoke", "from": "agent", "to": "cli", "label": "files / commands", "kind": "sync" },
    { "id": "apply", "from": "cli", "to": "file", "label": "revisioned safe write", "kind": "data" },
    { "id": "preview", "from": "cli", "to": "bridge", "label": "selected local file", "kind": "sync" },
    { "id": "io", "from": "bridge", "to": "file", "label": "read / explicit save", "kind": "data" },
    { "id": "local", "from": "bridge", "to": "browser", "label": "authenticated local mode", "kind": "data" },
    { "id": "assets", "from": "pages", "to": "browser", "label": "public assets only", "kind": "data" },
    { "id": "import", "from": "file", "to": "browser", "label": "user import / export", "kind": "data" },
    { "id": "render", "from": "browser", "to": "layout", "label": "validate / measure", "kind": "sync" },
    { "id": "print", "from": "layout", "to": "pdf", "label": "native print dialog", "kind": "sync" }
  ]
}
```

## Layout and template ownership {#architecture-layout}

- Canonical `.resume-page` is 210 × 297 mm with internal 14-mm margins, exact screen/print typography, outer-only preview scale.
- Classic: conservative single-column serif/slate; Modern: single-column sans/ restrained accent; Executive: primary column plus compact first-page Skills/Certifications sidebar.
- Shared atom pipeline measures wrapped DOM at the real width, packs within capacity, keeps headings with first content, splits long entries only between bullets/details, and asserts every source atom once.
- Executive sidebar overflow moves complete remaining entries to full-width page-two continuation after primary content; it never hides or duplicates content. It explicitly differs from exact single-column sectionOrder/ATS reading order.
- Too much content is valid stored JSON but a print-blocking layout issue. Show unplaced content and source paths; never shrink body below 10.5 pt, clip, or drop bullets.
- Print CSS removes UI/shadows/transforms, sets A4 page/margins, and prevents a trailing blank page. Native PDF preserves text; proprietary ATS compatibility is not guaranteed.

## State and failure policy {#architecture-state}

- One small draft reducer; form DOM focus/caret is preserved; preview subtree is rerendered after a bounded debounce.
- Generation IDs prevent stale asynchronous layout replacing a newer edit.
- Dirty drafts are never silently reloaded or saved. Clean source changes reload; dirty changes become a conflict choice.
- Invalid imports preserve the prior draft; invalid external edits preserve the last valid preview; save failures preserve the browser draft.
- Browser storage is opt-in; failures fall back to memory. Refresh can lose unsaved memory data; export/save are explicit durable actions.

### Technical details {#architecture-local-security}

- Loopback server listens only on 127.0.0.1; one selected JSON file and realpath-contained `dist/web` assets.
- Per-session capability in fragment bootstrap, immediately removed, memory-only bearer; exact Host and write Origin checks; no CORS wildcard.
- Read/save/events are no-store; events carry revisions, not PII; stream authentication uses fetch, not query tokens.
- Shared CLI/server lock and revision reread prevent cooperative stale writes; backup + sibling atomic replacement preserves complete-file visibility.
- Arbitrary direct editors ignore locks; a small final-recheck/rename race remains. Document it and prefer candidate apply for concurrent writes.
- No local document route is emitted in static Pages assets as a hosted handler; Node code remains in `dist/cli`.
