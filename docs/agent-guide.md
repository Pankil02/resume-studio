# Agent Guide — Resume Studio

This guide specifies how local coding agents (Claude Code, Pi, Antigravity, Cursor, Codex, etc.) interact with Resume Studio documents safely, deterministically, and concurrently.

---

## 1. Core Principles & Safety Invariants

1. **Facts Only:** Never invent companies, dates, qualifications, metrics, contacts, or achievements. If information is missing, ask the user or omit optional fields. Preserve all user-supplied facts.
2. **Stable Item IDs:** Every array entry in `links`, `experience`, `education`, `projects`, `skills`, and `certifications` has an ASCII `id` matching `^[a-z][a-z0-9-]{1,47}$`. Always preserve existing IDs during edits and reordering. When creating new items, use descriptive lowercase kebab-case IDs (e.g. `exp-senior-eng`, `sk-cloud`).
3. **Pure Plain Text:** Resume content is pure, untrusted plain text. Do not emit HTML tags (`<b>`, `<script>`), Markdown syntax (`**bold**`, `[link](url)`), scripts, CSS strings, or data URLs.
4. **Source of Truth:** The JSON resume file is the single authoritative source of truth. Rendered HTML/PDF is an artifact, not an editable source.
5. **Atomic Cooperative Writes:** Use `apply --from <candidate.json> --expected-revision <sha256>` for concurrent-safe edits. The CLI acquires a `.lock` directory lock, checks revision consistency, maintains a 10-backup rotation, and replaces the target file atomically.

---

## 2. CLI Command Reference

All CLI commands run via `node dist/cli/main.js` (or `bun run resume -- ...`).

| Command | Arguments | Exit Codes | Description |
| :--- | :--- | :--- | :--- |
| `init` | `--file <path> [--template <classic\|executive>] [--max-pages <1\|2>]` | 0, 1 | Creates a valid starter resume at `<path>`. Refuses to overwrite existing files. |
| `inspect` | `--file <path> [--json]` | 0, 1 | Reads document and outputs SHA-256 revision hash and document structure. |
| `validate` | `--file <path> [--json]` | 0 (valid), 1 (IO), 2 (invalid) | Validates document against JSON schema and semantic rules. Lists all errors and editorial warnings. |
| `apply` | `--file <path> --from <candidate.json> --expected-revision <sha256> [--json]` | 0 (success), 1 (IO), 2 (invalid), 3 (conflict) | Validates candidate, checks revision against disk, creates backup, and replaces file atomically. |
| `preview` | `--file <path> [--port <port>] [--open]` | 0, 1 | Starts private loopback preview server on `127.0.0.1` with live SSE watcher and browser save bridge. |
| `templates` | `[--json]` | 0 | Lists available templates, typography, and ATS reading order notes. |
| `guidance` | `[--json]` | 0 | Outputs schema bounds and recommended editorial word/character budgets. |

---

## 3. Standard Step-by-Step Agent Workflow

### Step 1: Initialize (if starting a new resume)
```bash
node dist/cli/main.js init --file resumes/my-resume.json --template classic --max-pages 1
```

### Step 2: Read Current Revision and Content
Always inspect the current revision hash before proposing edits:
```bash
node dist/cli/main.js inspect --file resumes/my-resume.json --json
```
Example JSON stdout:
```json
{
  "revision": "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
  "document": {
    "schemaVersion": 1,
    "document": { ... },
    "profile": { ... },
    ...
  }
}
```

### Step 3: Author Candidate JSON
Create a sibling candidate file (e.g. `resumes/candidate.json`). Edit fields in accordance with user facts and guidelines:
- Retain existing item `id` properties.
- Strictly adhere to date formats (`YYYY-MM`).
- Ensure `current: true` roles do not have `end` dates; past roles require `end`.
- Use clean absolute URLs (`https://...`).

### Step 4: Validate Candidate
Validate the candidate file before attempting to apply:
```bash
node dist/cli/main.js validate --file resumes/candidate.json --json
```
- If exit code is `2`, inspect issues in stdout, resolve errors in `candidate.json`, and revalidate.
- Warnings (e.g. `GUIDANCE_BULLET_WORD_COUNT`) are advisory and do not block application.

### Step 5: Atomically Apply Candidate
```bash
node dist/cli/main.js apply --file resumes/my-resume.json --from resumes/candidate.json --expected-revision a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0 --json
```
- Exit `0`: Successfully applied. A `.bak.1` backup was created, and `my-resume.json` was updated. New revision is returned on stdout.
- Exit `3`: Revision conflict. An external writer (the user or another agent) modified the file in the meantime. Re-read with `inspect`, reconcile changes, and reapply.

### Step 6: Launch Preview for User
```bash
node dist/cli/main.js preview --file resumes/my-resume.json --open
```
The browser will open to `http://127.0.0.1:<port>/#local=<token>`. The capability token will be extracted into memory and immediately removed from the URL address bar. Live edits in the browser can be saved back to disk with the "Save to File" button.

---

## 4. Exit Code Reference

| Exit Code | Classification | Meaning | Agent Action |
| :--- | :--- | :--- | :--- |
| `0` | Success | Operation completed successfully | Continue to next workflow step. |
| `1` | Usage / IO Error | Bad arguments, missing file, permission issue | Check file path and command flags. |
| `2` | Validation Error | Candidate violates JSON schema or semantic invariants | Inspect JSON path, fix schema violation. |
| `3` | Revision Conflict | Target file revision differs from `--expected-revision` | Re-read with `inspect`, resolve conflict, re-apply. |

---

## 5. Date Constraints Reference

- **Current roles:** When `"current": true`, `"end"` must be omitted.
- **Past roles:** When `"current"` is false or omitted, `"end"` is required (`YYYY-MM`).
- **Chronological ordering:** When both `"start"` and `"end"` exist, `"start"` must be less than or equal to `"end"` (lexicographical comparison on `YYYY-MM`).
- **Format:** Strict `YYYY-MM` regex `^[0-9]{4}-(0[1-9]|1[0-2])$`. Do not use days, timestamps, or locale strings.

---

## 6. Copy-Paste Agent Prompts

When instructing another local coding agent to work on a resume:

```text
Task: Update my resume at resumes/my-resume.json.
Rules:
1. First run: node dist/cli/main.js inspect --file resumes/my-resume.json --json
2. Author candidate edits in resumes/candidate.json. Preserve all existing item IDs.
3. Validate candidate: node dist/cli/main.js validate --file resumes/candidate.json --json
4. Apply atomically: node dist/cli/main.js apply --file resumes/my-resume.json --from resumes/candidate.json --expected-revision <REVISION> --json
5. Do not invent any facts, companies, or dates. Keep bullets under 360 chars.
```
