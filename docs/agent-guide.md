# Agent Guide — openResume

This guide specifies how local coding agents (Antigravity, Pi Agent, Claude Code, Cursor, Codex, etc.) interact with openResume documents safely, deterministically, and concurrently.

---

## 1. Core Principles & Safety Invariants

1. **Facts Only (Truth Policy):** Never invent companies, dates, qualifications, metrics, contacts, or achievements. If information is missing, ask the user or omit optional fields. Preserve all user-supplied facts.
2. **Stable Item IDs:** Every array entry in `links`, `experience`, `education`, `projects`, `skills`, and `certifications` has an ASCII `id` matching `^[a-z][a-z0-9-]{1,47}$`. Always preserve existing IDs during edits and reordering. When creating new items, use descriptive lowercase kebab-case IDs (e.g. `exp-senior-eng`, `sk-cloud`).
3. **Structured Plain Text & Bold Markup:** Resume fields are plain text with optional `**bold**` markup in bullet points for key skills and quantified metrics. Do not emit arbitrary HTML tags (`<script>`, `<iframe>`), CSS strings, data URLs, or raw external scripts.
4. **Source of Truth:** The JSON resume file (`resume.json`) is the single authoritative source of truth. Rendered HTML/PDF is an artifact output.
5. **Persistent Master Profile:** Check `~/.openresume/` before interviewing the user. Import or sync user facts to `profile.md` and `resume.json` so personal details persist across all coding agent sessions.
6. **Brevity & Scannability Directives:** Keep summaries to 2–3 sentences (30–45 words max). Keep bullets to 3–4 per role max, 1–2 lines each (15–25 words), beginning with strong action verbs and concrete metrics. Ensure comfortable 1-page fit.

---

## 2. CLI Command Reference

All CLI commands run via `bunx openresume` or `bun bin/openresume.mjs`.

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `install` | `[--global] [--local] [--symlink]` | Install skill into current workspace (`.agents/skills/openresume/`, etc.) or globally |
| `update` | `[--global] [--local] [--yes]` | Update installed skill files to latest release preserving user documents |
| `init` | `[<file.json>] [--template <classic\|executive>]` | Initialize resume from `~/.openresume/resume.json` master profile or starter |
| `profile` | `show \| import <file> \| path` | View or import existing resume (`.pdf`, `.txt`, `.md`, `.json`) into persistent profile |
| `validate` | `<file.json>` | Validate document against JSON schema, regex constraints, and unique IDs |
| `render` | `<file.json> [-t <classic\|executive>] [-o <output.html>] [--open]` | Render standalone printable A4 HTML with embedded dual-template switcher toolbar |
| `preview` | `<file.json> [--port <port>] [--open]` | Run local `127.0.0.1` live-reload server with SSE watcher and in-browser save API |

---

## 3. Standard Step-by-Step Agent Workflow

### Step 1: Check or Import Profile
Check if the user already has a persistent profile saved:
```bash
bunx openresume profile show
```
If the user provides an existing resume file:
```bash
bunx openresume profile import existing-resume.pdf
```

### Step 2: Initialize Workspace Document
Create a new resume document in the current project:
```bash
bunx openresume init resume.json --template classic
```

### Step 3: Edit and Tailor Resume JSON
Edit `resume.json` directly conforming to `schema.json`:
- Retain existing item `id` properties.
- Strictly adhere to date formats (`YYYY` or `YYYY-MM`).
- Ensure `current: true` roles do not have `end` dates; past roles require `end`.
- Use clean absolute URLs (`https://...`).
- Apply brevity directives: 3–4 bullets per role, 1–2 lines per bullet, strong action verbs.

### Step 4: Validate Changes
Always validate after edits:
```bash
bunx openresume validate resume.json
```
If errors are reported, correct schema or constraint violations and re-validate.

### Step 5: Launch Live Preview & Visual Editing
```bash
bunx openresume preview resume.json --open
```
- Browser opens to `http://127.0.0.1:<port>`.
- Users and agents can toggle templates (Classic vs. Executive), font families, font sizes, margins, and accents.
- Clicking **Edit Resume** allows direct visual editing of text on page.
- Clicking **Save** or pressing `Cmd+S` / `Ctrl+S` persists changes back to `resume.json` via `POST /api/save` with validation and atomic replacement.
- Clicking **Save / Download PDF** triggers native A4 print dialog (`Cmd+P` / `Ctrl+P`).

---

## 4. Date Constraints Reference

- **Current roles:** When `"current": true`, `"end"` must be omitted.
- **Past roles:** When `"current"` is false or omitted, `"end"` is required (`YYYY-MM`).
- **Chronological ordering:** When both `"start"` and `"end"` exist, `"start"` must be less than or equal to `"end"` (lexicographical comparison on `YYYY-MM`).
- **Format:** Strict `YYYY-MM` regex `^[0-9]{4}-(0[1-9]|1[0-2])$` or `YYYY` regex `^[0-9]{4}$`. Do not use days, timestamps, or locale strings.

---

## 5. Copy-Paste Agent Prompt

When instructing another coding agent:

```text
Task: Tailor resume.json for a Senior Software Engineer role.
Rules:
1. First run: bunx openresume validate resume.json
2. Edit resume.json preserving existing item IDs.
3. Keep summary to 2-3 concise sentences. Bullets 3-4 max per role with metrics and bold keywords.
4. Validate: bunx openresume validate resume.json
5. Preview: bunx openresume preview resume.json --open
6. Do not invent facts, employers, or dates.
```
