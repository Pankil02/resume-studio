# openResume — Universal AI Coding Agent Skill & Interactive Resume Studio

openResume is an ultra-lean, zero-dependency **Universal AI Coding Agent Skill** and interactive A4 HTML resume compiler for **Antigravity**, **Pi Agent**, and **Claude Code**.

Zero web application or hosted services required. Coding agents inspect user profiles in `~/.openresume/`, edit structured JSON conforming to `schema.json`, validate structure and page budgets via `validate.mjs`, and compile single-file, self-contained printable A4 HTML documents with embedded live template toggling via `render.mjs`.

---

## Key Features

- **1-Command Skill Installation:** Run `bunx openresume` or `npx openresume` anywhere to install `openresume` skill files globally across Antigravity (`~/.gemini/config/skills/openresume`), Pi Agent (`~/.pi/skills/openresume`), Claude Code (`~/.claude/skills/openresume`), and `.agents/skills/openresume`.
- **Persistent Personal Profile (`~/.openresume/`):** Save your resume facts once (`profile.md` + `resume.json`) or import existing resumes via `openresume profile import <file.pdf|txt|md|json>`. All AI agent sessions reuse your personal profile automatically.
- **Dual-Template Interactive Renderer:** Compiles both Classic (ATS-first single column) and Executive (modern 2-column) templates into a single HTML file with an embedded floating toolbar for instant template, accent, and margin switching.
- **Live Preview Server:** `openresume preview resume.json --open` runs a local `127.0.0.1` live-reload server that auto-refreshes on edits and persists toolbar changes back to your JSON document.
- **1-Click PDF Export:** Click **Save / Download PDF** in the browser toolbar or press `Cmd+P` / `Ctrl+P` (A4, 100% scale, margins none) to produce crisp, selectable-text PDFs.
- **Zero Runtime Dependencies:** Pure ECMAScript using only Node/Bun built-ins (`node:fs`, `node:path`, `node:http`, `node:child_process`).

---

## 1-Command Quickstart

```bash
# 1. Install skill globally into all AI coding agent directories:
bunx openresume
# or: npx openresume

# 2. Import your existing resume (.pdf, .txt, .md, or .json) into your personal profile:
bunx openresume profile import my-current-resume.pdf

# 3. Initialize a new tailored resume in your project:
bunx openresume init resume.json

# 4. Open the interactive preview with live template toggle and PDF export toolbar:
bunx openresume render resume.json --open
# or run the live watch-and-reload server while collaborating with an AI agent:
bunx openresume preview resume.json --open
```

---

## CLI Reference (`bin/openresume.mjs`)

| Command | Description |
| :--- | :--- |
| `openresume install [--local] [--symlink]` | Install skill to Pi Agent, Claude Code, and Antigravity |
| `openresume init [file.json] [--template classic\|executive]` | Create resume JSON from saved profile or starter |
| `openresume profile [show\|import <file>\|path]` | Manage persistent personal profile in `~/.openresume/` |
| `openresume validate <file.json>` | Validate resume schema, unique IDs, dates, and security |
| `openresume render <file.json> [-t classic\|executive] [-o resume.html] [--open]` | Render interactive A4 HTML with embedded toolbar |
| `openresume preview <file.json> [--port N] [--open]` | Launch live preview server with SSE auto-refresh |

---

## Standalone Skill Directory (`skills/openresume/`)

The `skills/openresume/` directory is completely standalone and portable:

| File | Description |
| :--- | :--- |
| **`SKILL.md`** | Ultra-token-efficient (<100 lines) agent directives with compact inline schema and workflow |
| **`schema.json`** | Canonical Draft-07 JSON schema for openResume format (version 1) |
| **`starter.json`** | Clean synthetic starting resume |
| **`validate.mjs`** | Zero-dependency ESM validator (`bun validate.mjs <file.json>`) |
| **`render.mjs`** | Dual-template ESM compiler with interactive toolbar (`bun render.mjs <file.json>`) |

---

## Verification & Tests

```bash
# Run unit and integration test suite
bun test

# Run full verification
bun run verify
```

