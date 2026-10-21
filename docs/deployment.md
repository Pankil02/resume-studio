# Standalone Skill & Deployment Guide

This document explains the standalone **Universal Agent Skill** architecture for Antigravity, Pi Agent, and Claude Code, local CLI commands, and automated installation for openResume.

---

## 1. Standalone Universal Agent Skill Architecture

The primary interface for openResume is the standalone agent skill located in `skills/openresume/`. It has **zero external runtime dependencies** and operates via local file operations and CLI executions without any hosted servers or web apps.

### Key Components

1. **`SKILL.md`:** Compact (<100 lines) authoritative agent directives:
   - Persistent Personal Profile workflow (`~/.openresume/profile.md` + `resume.json`).
   - Compact inline JSON schema contract (zero extra file reads needed).
   - Truth Policy: Never invent employers, titles, dates, metrics, or credentials.
   - 1-command workflow directives.
2. **`schema.json`:** Canonical Draft-07 JSON Schema (schemaVersion 1).
3. **`starter.json`:** Valid, fully populated reference resume document.
4. **`validate.mjs`:** Pure ESM validator that verifies structure, regex patterns, date bounds, unique IDs, and document margin mode.
5. **`render.mjs`:** Dual-template ESM compiler that compiles any valid `resume.json` into a single-file, self-contained, printable A4 HTML document with embedded CSS, floating preview toolbar, and live settings sync.

---

## 2. 1-Command Installation

Install the skill across agent environments:

```bash
# Workspace installation (Current directory only - Default):
bunx openresume install
# or from GitHub directly:
bunx github:Pankil02/resume-studio install

# Global installation (across all agent environments):
bunx openresume install --global
# or from local repository:
bun ./bin/openresume.mjs install --global
```

### Installation Targets

- **Antigravity Global:** `~/.gemini/config/skills/openresume/`
- **Antigravity Workspace:** `.agents/skills/openresume/`
- **Pi Agent Global:** `~/.pi/skills/openresume/`
- **Pi Agent Workspace:** `.pi/skills/openresume/`
- **Claude Code Global:** `~/.claude/skills/openresume/`
- **Claude Code Workspace:** `.agents/skills/openresume/`

---

## 3. Local Commands & Workflows (`bin/openresume.mjs`)

```bash
# Manage persistent profile
bunx openresume profile show
bunx openresume profile import existing-resume.pdf

# Initialize new resume from saved profile or starter
bunx openresume init resume.json --template classic

# Validate resume
bunx openresume validate resume.json

# Compile A4 HTML with embedded template switcher
bunx openresume render resume.json --output resume.html --open

# Live-reload watch server
bunx openresume preview resume.json --open
```

---

## 4. PDF Generation Contract

Generated HTML files from `render.mjs` contain embedded `@page { size: A4 portrait; margin: 0; }` styles and complete media queries. To produce a professional, selectable-text A4 PDF:

1. Click **Save / Download PDF** in the preview toolbar (or press `Cmd+P` / `Ctrl+P`).
2. Set **Destination** to `Save as PDF`.
3. Ensure **Margins** are set to `None`.
4. Ensure **Scale** is set to `100%` (or Default).
5. Enable **Background graphics** and disable **Headers and footers**.
