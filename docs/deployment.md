# Deployment & Standalone Skill Guide

This document describes how to deploy **Resume Studio** to Cloudflare Pages as a 100% static edge application, details our zero-cloud privacy architecture, and provides instructions for installing the standalone AI agent skill on any machine.

---

## 1. Cloudflare Pages Static Deployment

Resume Studio is architected as a pure static single-page application with no backend servers, databases, or cloud storage. It compiles into static HTML, CSS, and JavaScript in `dist/web`.

### Deployment Configuration

When setting up a project in the [Cloudflare Dashboard](https://dash.cloudflare.com/) under **Workers & Pages**:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework preset** | `None` | Pure static HTML/CSS/TS bundle |
| **Build command** | `bun run build` | Generates schema contracts and bundles static assets via Vite |
| **Build output directory** | `dist/web` | Root containing `index.html` and assets |
| **Root directory** | `/` (repository root) | |
| **Node.js compatibility** | Node >= 20 or Bun | Used solely at build time for contract generation |

### CLI Deployment via Wrangler

You can deploy directly to Cloudflare Pages from your terminal using:

```bash
# Build production bundle and deploy to Cloudflare Pages
bun run deploy:pages
```

Or step-by-step:

```bash
bun run build
bunx wrangler pages deploy dist/web --project-name resume-studio
```

---

## 2. Privacy & Zero-Cloud Security Audit

Resume Studio adheres to a strict local-first, zero-knowledge privacy architecture:

1. **Zero Data Egress:**
   - The browser never transmits user resume content, contact information, work history, or drafts across any network.
   - All schema validation, ATS checks, margin calculations, and live A4 DOM rendering happen entirely within the browser context.

2. **No Cloud Persistence:**
   - Zero databases (no PostgreSQL, MongoDB, DynamoDB, Firebase, or Supabase).
   - Zero edge storage (no Cloudflare KV, D1, R2, or Durable Objects).
   - Zero tracking, third-party analytics, remote telemetry, or ad scripts.

3. **Client-Side File System Access API:**
   - Bidirectional disk synchronization uses the native Chromium `FileSystemAccess` API (`window.showOpenFilePicker`).
   - The browser only accesses the specific file explicitly picked by the user.
   - The file handle is cached in the browser's origin-private IndexedDB (`active_resume_file`), persisting solely on the user's local device across page reloads.

4. **Static Asset Budget:**
   - Total bundle size is under 60 KiB gzipped (JS < 50 KiB, CSS < 10 KiB).
   - Enforced by `scripts/check-build.mjs` on every verification run.

---

## 3. Standalone AI Agent Skill Installation

The `skills/resume-studio/` directory is completely standalone and repo-independent. It bundles the canonical schema (`schema.json`), a zero-dependency ESM validator (`validate.mjs`), a valid starter template (`starter.json`), and comprehensive prompt directives (`SKILL.md`).

You can install this skill onto any computer without cloning the `resume-studio` repository.

### Installing for Pi Agent

```bash
# Create skill directory in user home
mkdir -p ~/.pi/skills/resume-studio

# Copy files into ~/.pi/skills/
cp skills/resume-studio/* ~/.pi/skills/resume-studio/
```

### Installing for Antigravity or Claude Code

```bash
# Global skills directory
mkdir -p ~/.agents/skills/resume-studio
cp skills/resume-studio/* ~/.agents/skills/resume-studio/

# Or per-project skills directory
mkdir -p .agents/skills/resume-studio
cp skills/resume-studio/* .agents/skills/resume-studio/
```

### Validating Resumes Anywhere

Run the zero-dependency validator using standard Node.js (>=18) or Bun:

```bash
# Using bun
bun ~/.pi/skills/resume-studio/validate.mjs resume.json

# Using node
node ~/.pi/skills/resume-studio/validate.mjs resume.json
```

---

## 4. Live Agent & Web Sync Workflow

Once deployed to Cloudflare Pages (e.g. `https://resume-studio.pages.dev`):

1. **Open Web App:** Navigate to `https://resume-studio.pages.dev` in Google Chrome, Microsoft Edge, Brave, or Arc.
2. **Link Local File:** Click **Link File** in the top navigation bar and select your local `resume.json`. The indicator updates to `● Linked: resume.json`.
3. **Edit via AI Agent:** Prompt your local coding agent (Pi, Antigravity, or Claude Code) using the `resume-studio` skill to update your `resume.json` on disk.
4. **Live Synchronization:** The web preview automatically detects the updated file modification timestamp and refreshes the live A4 preview within 1 second.
5. **Print / Export PDF:** Click **Print / Save PDF** to export a pixel-perfect, selectable-text A4 PDF using the native browser print engine.
