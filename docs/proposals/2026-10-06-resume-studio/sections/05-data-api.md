# Data and Local Contracts

## Canonical JSON {#data-contracts}

`schema/resume.schema.json` is proposed as the single strict draft-07 source. Generate TypeScript declarations, standalone validation, and browser guidance. Reject unknown fields/version, unsafe controls/links, duplicate IDs and invalid dates. No HTML/Markdown/images/style strings or arbitrary paths.

```json
{
  "schemaVersion": 1,
  "document": { "title": "Fictional Candidate Resume", "template": "classic", "maxPages": 1, "accent": "slate" },
  "profile": {
    "name": "Fictional Candidate",
    "headline": "Software Engineer",
    "email": "candidate@example.invalid",
    "location": "Example City",
    "links": [{ "id": "portfolio", "label": "Portfolio", "url": "https://example.com/portfolio" }]
  },
  "summary": "Fictional demonstration only. Replace this paragraph with verified experience and specific strengths supplied by the resume owner.",
  "sectionOrder": ["summary", "experience", "education", "projects", "skills", "certifications"],
  "experience": [{
    "id": "example-role",
    "employer": "Fictional Example Company",
    "role": "Software Engineer",
    "start": "2023-01",
    "current": true,
    "bullets": ["Built a demonstration workflow with automated tests; this is sample content, not a claim about a real person."]
  }],
  "education": [{
    "id": "example-education",
    "institution": "Fictional Example University",
    "qualification": "Example degree — demonstration only",
    "end": "2022-06",
    "details": []
  }],
  "projects": [],
  "skills": [{ "id": "example-skills", "category": "Engineering", "items": ["TypeScript", "Testing"] }],
  "certifications": []
}
```

## Field instructions {#data-guidance}

Counts use Unicode code points; word estimates are whitespace-separated English words. Hard limits constrain validity/resources; recommendations only guide writing. Actual rendered page fit wins.

| Field | Hard limit | Recommended budget |
| --- | --- | --- |
| Document / title | 128 KiB total UTF-8 / 100 chars | 5–30 KiB; descriptive filename title. |
| Name / headline | 100 / 120 chars | Real name; headline 5–12 words. |
| Email / phone / location | 254 / 40 / 100 chars | Verified contacts; omit full street address unless needed. |
| Links | 4; 40-char label; URL 2,048 chars | 1–3 readable HTTPS links; no credentials/unsafe schemes. |
| Summary | 900 chars | 40–75 words / 250–500 chars; specific and factual. |
| Experience | 12 roles, 8 bullets each; role/employer 100 chars | 2–4 relevant roles; 3–5 recent-role bullets. |
| Bullet | 360 chars | 15–30 words / 90–180 chars; real action/context/outcome. |
| Education | 6; institution/qualification 140; 3 details of 240 chars | 1–3 entries, short optional details. |
| Projects | 8; name/role 100; 6 bullets each | 1–3 relevant projects with 1–3 bullets. |
| Skills | 8 groups, 15 items each; category/item 60 chars | 3–5 groups; no rating graphics. |
| Certifications | 12; name 140, issuer 100 chars | 0–4 relevant credentials. |

`sectionOrder` contains each fixed section exactly once; empty arrays render no section. All arrays/links/items preserve stable IDs and explicit order. Experience start/end use YYYY-MM; current role has no end; noncurrent role requires end. Education dates are optional with chronological checks. Executive repositions Skills/Certifications without mutating sectionOrder and explains the difference.

## Agent contract {#data-agent-flow}

- Read root AGENTS.md, schema and content guide. Inspect the source; do not invent qualifications or metrics.
- Single writer: edit JSON directly, validate, launch preview. Concurrent writer: inspect revision, write a candidate, validate, apply with expected revision.
- Build first: `npm ci && npm run build`.
- Inspect: `node dist/cli/main.js inspect --file resumes/my-resume.json --json`.
- Validate: `node dist/cli/main.js validate --file resumes/my-resume.json --json`.
- Apply: `node dist/cli/main.js apply --file resumes/my-resume.json --from resumes/candidate.json --expected-revision SHA256_FROM_INSPECT`.
- Preview: `node dist/cli/main.js preview --file resumes/my-resume.json --open`.
- Print: user clicks Print / Save PDF and chooses browser Save as PDF; no unattended export command.
- `init` refuses existing paths; `templates`, `guidance`, `--help` describe supported inputs. Exit 0 success, 1 usage/IO, 2 invalid, 3 conflict.

### Technical details {#data-local-protocol}

Private browser bridge, not an agent or hosted API. Selected file is fixed at startup; no path parameter can choose another file.

| Route | Authentication / payload | Failure model |
| --- | --- | --- |
| `GET /local/document` | Memory bearer + exact Host; `{revision, document}` | 401/403/422 safe errors; no-store. |
| `POST /local/save` | Bearer + exact Origin/Host; `{expectedRevision, document}`, JSON ≤160 KiB | 400 malformed, 409 stale/lock, 413 body, 422 schema, 500 IO. |
| `GET /local/events` | Bearer through fetch stream; revision/change metadata only | Abort/reconnect, bounded backoff; no query token. |

Revision is SHA-256 of exact source bytes. CLI and bridge share a cooperative directory lock, reread/check/validate, restricted temp file, bounded ten-backup retention and atomic replacement. Refuse symlink/protected files and stale writes. External noncooperating edits may race final rename; backups and one-writer guidance are mandatory, not a claim of universal compare-and-swap.

## Storage and migrations {#data-storage}

- JSON files are durable source; PDFs are generated outputs; browser drafts are not cloud data.
- Device autosave is off by default, explicit opt-in, unencrypted, schema-versioned and clearable; restore never overwrites local files automatically.
- Public output includes synthetic samples only; private resume/backups never enter `dist/web`.
- Database queries, indexes, blobs, cloud locks and tenant schemas: N/A, no hosted resume data. Revisit only after approved server persistence.
- Initial schema is version 1; unknown versions fail safely. Future schema change needs approved idempotent dry-run migration and UPGRADE instructions.
