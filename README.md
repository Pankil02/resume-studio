# Resume Studio

Resume Studio is a high-performance, ultra-lightweight, local-first professional resume editor and physical A4 HTML viewer.

Local coding agents (Claude Code, Pi, Antigravity, Cursor, Codex) update structured JSON through file operations or a deterministic local CLI. Users edit through responsive two-pane browser forms, switch between three professional A4 templates, and generate selectable-text PDFs using the native browser print dialog (`Print / Save as PDF`).

---

## Key Features

- **Zero UI Frameworks:** Built with native HTML5, modern Vanilla CSS, and strict TypeScript.
- **Zero Runtime Dependencies:** Public web assets and Node CLI contain zero runtime npm packages. Standalone Ajv validation is compiled at build time into pure self-contained JavaScript without runtime imports or schema compilers.
- **Local-First & Private by Default:** Resume data never leaves your machine. The hosted version on Cloudflare Pages runs entirely in-browser with zero telemetry or network calls.
- **Physical A4 Geometry & Legal Pagination:** Exact 210 × 297 mm pages with 14 mm padding. Measured pagination engine enforces widow/orphan rules, keeps headings with content, handles multi-bullet continuation labels, and blocks print on budget overflow.
- **Three Professional Templates:**
  - `classic`: Traditional single-column serif layout with thin divider rules. ATS-first linear reading order.
  - `modern`: Contemporary single-column sans-serif layout with accent headings. ATS-first linear reading order.
  - `executive`: Shared full-width header, two-column Page 1 with compact Skills/Certifications sidebar, and full-width Page 2 continuation.
- **Cooperative Concurrency & Safety:** Local preview bridge binds strictly to IPv4 `127.0.0.1` with a 256-bit ephemeral session capability, live SSE file watcher, directory lock (`.lock`), automatic 10-backup rotation (`.bak.1`–`.bak.10`), and atomic replacements.

---

## Quickstart

### Prerequisites
- Node.js 22+ (recommended 24 LTS) or Bun 1.2+

### 1. Installation & Build
```bash
# Using Bun:
bun install
bun run build

# Or using Node / npm:
npm ci
npm run build
```

### 2. Local Agent & Preview Workflow
```bash
# 1. Initialize a new resume
node dist/cli/main.js init --file resumes/my-resume.json --template classic --max-pages 1

# 2. Inspect current revision and content
node dist/cli/main.js inspect --file resumes/my-resume.json --json

# 3. Validate a candidate edit
node dist/cli/main.js validate --file resumes/candidate.json --json

# 4. Atomically apply changes with revision verification
node dist/cli/main.js apply --file resumes/my-resume.json --from resumes/candidate.json --expected-revision <SHA256>

# 5. Launch private preview and browser editor
node dist/cli/main.js preview --file resumes/my-resume.json --open
```

### 3. Hosted In-Browser Mode
Open the static web app (e.g. deployed to Cloudflare Pages or running via `bun run dev`):
- Click **Open JSON** to load any valid Resume Studio JSON file into browser memory.
- Edit form fields in the left pane while viewing the live A4 preview on the right.
- Click **Export JSON** to download the validated resume.
- Optionally check **Device Autosave** to persist working drafts to local `localStorage`.

---

## Source Recovery Workflow

If an edit needs to be reverted or recovered:
1. Every write transaction via CLI `apply` or browser bridge creates rotating backups: `<filename>.bak.1` through `<filename>.bak.10`.
2. Inspect the desired backup:
   ```bash
   node dist/cli/main.js validate --file resumes/my-resume.json.bak.1 --json
   ```
3. Recover the file by applying the backup over the current revision:
   ```bash
   # Get current revision
   CURRENT_REV=$(node dist/cli/main.js inspect --file resumes/my-resume.json --json | jq -r .revision)

   # Apply backup atomically
   node dist/cli/main.js apply --file resumes/my-resume.json --from resumes/my-resume.json.bak.1 --expected-revision $CURRENT_REV
   ```

---

## Available Scripts

| Script | Purpose |
| :--- | :--- |
| `bun run verify` | Full verification pipeline: drift checks, typecheck, unit tests, CLI tests, build, browser tests, budget assertions. |
| `bun run generate` | Regenerates TypeScript interfaces, standalone validator, and guidance projection from `schema/resume.schema.json`. |
| `bun run check:generated` | Asserts zero drift between generated contracts and JSON schema. |
| `bun run typecheck` | Strict multi-target TypeScript compilation (`tsconfig.web.json`, `tsconfig.cli.json`, `tsconfig.test.json`). |
| `bun run test:unit` | Runs pure core validation, content metrics, and pagination algorithm tests. |
| `bun run test:cli` | Runs CLI command, transaction locking, and loopback server integration tests. |
| `bun run test:browser` | Runs Playwright Chromium test suites (bridge, A4 layout, editor, e2e security, accessibility). |
| `bun run bench` | Runs synthetic validation, pagination, and file save benchmarks against performance budgets. |
| `bun run check:build` | Enforces static asset allowlists and gzip budgets (JS ≤50 KiB, CSS ≤20 KiB, Total ≤100 KiB). |
| `bun run dev` | Launches local Vite development server for hosted-style editing. |

---

## Documentation

- [Agent Guide](docs/agent-guide.md) — Workflow, CLI commands, and safety directives for local coding agents.
- [Content Guide](docs/content-guide.md) — Hard bounds, recommended editorial budgets, STAR bullet advice, and ATS considerations.
- [Printing & PDF Guide](docs/printing.md) — Exact browser print settings, manual checklists for Firefox/Safari, and ATS reading order.
- [Privacy & Security Model](docs/privacy.md) — Zero-network transmission guarantees, in-memory drafts, and loopback bridge isolation.
- [Deployment Guide](docs/deployment.md) — Cloudflare Pages configuration, security headers, and static allowlist validation.
- [Execution Plan](docs/plans/2026-10-06-resume-studio.md) — Detailed implementation phases, verification records, and architecture decisions.
