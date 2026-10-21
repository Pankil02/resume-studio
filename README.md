# openResume — Universal AI Coding Agent Skill & Interactive Resume Studio

openResume is an ultra-lean, zero-dependency **Universal AI Coding Agent Skill** and interactive A4 HTML resume compiler for **Antigravity**, **Pi Agent**, and **Claude Code**.

Zero web application or hosted services required. Coding agents inspect user profiles in `~/.openresume/`, edit structured JSON conforming to `schema.json`, validate structure and page budgets via `validate.mjs`, and compile single-file, self-contained printable A4 HTML documents with embedded live template toggling via `render.mjs`.

---

## Key Features

- **1-Command Skill Installation & Updates:** Run `bunx openresume install` (or `bunx github:Pankil02/resume-studio install`) to install `openresume` skill files directly to your current project folder (`.agents/skills/openresume`, `.pi/skills/openresume`, `.claude/skills/openresume`). Update anytime with `bunx openresume update` without affecting personal profiles or existing resumes.
- **Persistent Personal Profile (`~/.openresume/`):** Save your resume facts once (`profile.md` + `resume.json`) or import existing resumes via `openresume profile import <file.pdf|txt|md|json>`. All AI agent sessions reuse your personal profile automatically.
- **Dual-Template Interactive Renderer:** Compiles both Classic (ATS-first single column) and Executive (modern 2-column with company monograms) templates into a single HTML file with an embedded floating toolbar for instant template, font, accent, and margin switching.
- **Strict Template Invariance & PDF Fidelity:** The visual layout, typography, proportions, and styling of both templates—especially the `executive` Enhancv format modeled after the reference PDF—are permanently preserved from A to Z.
- **Interactive Live In-Place Editing:** Click **Edit Resume** (`Ctrl+E` / `Cmd+E`) directly in the browser preview to edit text, roles, and bullets on page. Floating bubble formatting (`Cmd+B`, `Cmd+I`), keyboard bullet management (`Enter` to add bullet, `Backspace` to prune empty bullet), entry addition/deletion, and atomic disk persistence back to `resume.json` via `POST /api/save`.
- **Company Logo & Avatar Management:** Monogram company badges in the Executive layout support 1-click image upload, zoom, pan, and automated persistence into your local `images/` directory.
- **Live Preview Server:** `openresume preview resume.json --open` runs a local `127.0.0.1` live-reload server that auto-refreshes on external file changes and syncs browser edits back to your JSON document.
- **Brevity & Recruiter Scannability Directives:** Built-in "Less Text, Easy to Read" policy—strict 1-page default, 2–3 sentence summaries, 3–4 bullets max per role (15–25 words each), strong action verbs, and quantifiable metrics.
- **1-Click PDF Export:** Click **Save / Download PDF** in the browser toolbar or press `Cmd+P` / `Ctrl+P` (A4, 100% scale, margins none) to produce crisp, selectable-text PDFs.
- **Zero Runtime Dependencies:** Pure ECMAScript using only standard Node/Bun built-ins (`node:fs`, `node:path`, `node:http`, `node:child_process`).

---

## 1-Command Quickstart

```bash
# 1. Install skill into current folder (default, workspace only):
bunx openresume install
# or for machine-wide global install:
bunx openresume install --global

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

## Interactive Visual In-Place Editing

When running `openresume preview resume.json --open`:
1. Click **Edit Resume** in the floating top toolbar (or press `Cmd+E` / `Ctrl+E`).
2. Click any field on the resume page—candidate name, headline, role, employer, bullets, or summary—and edit text in real time.
3. **Keyboard Bullet Management:** Press `Enter` on any bullet to create a new bullet beneath it; press `Backspace` on an empty bullet to prune it and return focus to the previous item.
4. **Rich Formatting:** Highlight text to invoke the floating bubble or use standard shortcuts (`Cmd+B` for bold, `Cmd+I` for italic, font size toggles).
5. **Entry Management:** Use the `+ Add` buttons on each section to add experience roles, education, projects, skills, or certifications. Click the trash icon (`🗑️`) to remove items.
6. **Company Logo Avatars:** Click any company monogram badge in the Executive template to open the logo modal, upload a company icon, adjust zoom/pan, and save.
7. Click **Save Changes** (or press `Cmd+S` / `Ctrl+S`) to validate and write edits atomically to `resume.json`.

---

## Updating openResume

If you already installed openResume before, update or replace skill files anytime:

### 1. Tell Your AI Agent (Easiest)
Simply prompt your agent in chat:
> *"Update openResume skill files to the latest version"*

Your agent will run `bunx github:Pankil02/resume-studio update --yes` to refresh the installed files without touching your `resume.json` or personal profile.

### 2. 1-Command CLI Update
```bash
# Update workspace installation (current project):
bunx github:Pankil02/resume-studio update
# or with npm/npx:
npx github:Pankil02/resume-studio update

# Update machine-wide global installation:
bunx github:Pankil02/resume-studio update --global
```

### 3. Direct File Replacement (No Package Manager)
Copy or download the 5 standalone files from [`skills/openresume/`](skills/openresume/):
- `SKILL.md`
- `schema.json`
- `starter.json`
- `validate.mjs`
- `render.mjs`

Into your target skill folder:
- **Antigravity & Claude Code Workspace**: `.agents/skills/openresume/`
- **Pi Agent Workspace**: `.pi/skills/openresume/`
- **Global**: `~/.gemini/config/skills/openresume/` (Antigravity), `~/.pi/skills/openresume/` (Pi), or `~/.claude/skills/openresume/` (Claude)

---

## CLI Reference (`bin/openresume.mjs`)

| Command | Description |
| :--- | :--- |
| `openresume install [--global] [--local] [--symlink]` | Install skill to current folder (default) or globally with `--global` |
| `openresume update [--global] [--local] [--yes]` | Update/replace installed skill files to latest release |
| `openresume init [file.json] [--template classic\|executive]` | Create resume JSON from saved profile or starter |
| `openresume profile [show\|import <file>\|path]` | Manage persistent personal profile in `~/.openresume/` |
| `openresume validate <file.json>` | Validate resume schema, unique IDs, dates, and security |
| `openresume render <file.json> [-t classic\|executive] [-o resume.html] [--open]` | Render interactive A4 HTML with embedded toolbar |
| `openresume preview <file.json> [--port N] [--open]` | Launch live preview server with SSE auto-refresh and in-place save API |

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
