#!/usr/bin/env node
/**
 * openResume — Unified Zero-Dependency CLI
 * Pure ECMAScript (Node.js >= 20 or Bun)
 *
 * Commands:
 *   openresume install [--local] [--symlink]
 *   openresume init [file.json] [--template classic|executive] [--force]
 *   openresume profile [show|import <file>|path]
 *   openresume validate <file.json>
 *   openresume render <file.json> [-t classic|executive] [-o resume.html] [--open]
 *   openresume preview <file.json> [--port N] [--open]
 */

import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  symlinkSync,
  mkdirSync,
  existsSync,
  rmSync,
  chmodSync,
  watch,
  renameSync,
  realpathSync,
} from 'node:fs';
import { resolve, dirname, join, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { exec, spawn } from 'node:child_process';
import process from 'node:process';
import { validateResumeJson } from '../skills/openresume/validate.mjs';
import { renderResumeHtml, renderFile } from '../skills/openresume/render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SKILL_NAME = 'openresume';
export const SOURCE_SKILL_DIR = resolve(__dirname, '..', 'skills', SKILL_NAME);
export function getUserHomeDir() {
  return resolve(process.env.OPENRESUME_HOME || join(homedir(), '.openresume'));
}
export const USER_HOME_DIR = getUserHomeDir();

const SKILL_FILES = [
  'SKILL.md',
  'schema.json',
  'starter.json',
  'validate.mjs',
  'render.mjs',
];

/**
 * Opens a URL in the user's default browser across platforms.
 */
export function openBrowser(url) {
  const plat = process.platform;
  if (plat === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else if (plat === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

/**
 * Fallback PDF text stream extractor without external dependencies.
 */
export function extractPdfTextFallback(buf) {
  const content = buf.toString('latin1');
  const matches = [];
  const textMatches = content.matchAll(/\(([^()]{2,})\)\s*(?:Tj|'|")/g);
  for (const m of textMatches) {
    matches.push(m[1].replace(/\\([()\\])/g, '$1'));
  }
  if (matches.length > 5) {
    return matches.join('\n');
  }
  const asciiMatches = content.match(/[\x20-\x7E]{4,}/g) || [];
  return asciiMatches
    .filter((s) => !s.startsWith('/') && !s.includes('obj') && !s.includes('endobj') && !s.includes('stream'))
    .join('\n');
}

/**
 * Extracts text from a PDF via pdftotext or zero-dependency fallback.
 */
export async function extractPdfText(pdfPath) {
  return new Promise((res) => {
    exec(`pdftotext "${pdfPath}" -`, { timeout: 3000 }, (err, stdout) => {
      if (!err && stdout && stdout.trim().length > 0) {
        return res(stdout.trim());
      }
      try {
        const buf = readFileSync(pdfPath);
        res(extractPdfTextFallback(buf));
      } catch {
        res('');
      }
    });
  });
}

/**
 * Generates readable Markdown profile from openResume JSON object.
 */
export function generateProfileMarkdown(doc) {
  const p = doc.profile || {};
  let md = `# Profile: ${p.name || 'Anonymous'}\n\n`;
  if (p.headline) md += `**Headline:** ${p.headline}\n`;
  if (p.email) md += `**Email:** ${p.email}\n`;
  if (p.phone) md += `**Phone:** ${p.phone}\n`;
  if (p.location) md += `**Location:** ${p.location}\n`;
  if (Array.isArray(p.links) && p.links.length > 0) {
    md += `**Links:**\n` + p.links.map((l) => `- ${l.label}: ${l.url}`).join('\n') + '\n';
  }
  if (doc.summary) md += `\n## Summary\n${doc.summary}\n`;
  if (Array.isArray(doc.experience) && doc.experience.length > 0) {
    md += `\n## Experience\n`;
    for (const exp of doc.experience) {
      md += `### ${exp.role} — ${exp.employer} (${exp.start || ''} to ${exp.current ? 'Present' : (exp.end || '')})\n`;
      if (exp.location) md += `*Location:* ${exp.location}\n`;
      if (Array.isArray(exp.bullets)) {
        md += exp.bullets.map((b) => `- ${b}`).join('\n') + '\n';
      }
    }
  }
  if (Array.isArray(doc.education) && doc.education.length > 0) {
    md += `\n## Education\n`;
    for (const edu of doc.education) {
      md += `### ${edu.qualification} — ${edu.institution} (${edu.start || ''} to ${edu.end || ''})\n`;
      if (Array.isArray(edu.details)) {
        md += edu.details.map((d) => `- ${d}`).join('\n') + '\n';
      }
    }
  }
  if (Array.isArray(doc.projects) && doc.projects.length > 0) {
    md += `\n## Projects\n`;
    for (const proj of doc.projects) {
      md += `### ${proj.name}${proj.role ? ` (${proj.role})` : ''}\n`;
      if (proj.url) md += `*URL:* ${proj.url}\n`;
      if (Array.isArray(proj.bullets)) {
        md += proj.bullets.map((b) => `- ${b}`).join('\n') + '\n';
      }
    }
  }
  if (Array.isArray(doc.skills) && doc.skills.length > 0) {
    md += `\n## Skills\n`;
    for (const sk of doc.skills) {
      md += `- **${sk.category}:** ${(sk.items || []).join(', ')}\n`;
    }
  }
  if (Array.isArray(doc.certifications) && doc.certifications.length > 0) {
    md += `\n## Certifications\n`;
    for (const cert of doc.certifications) {
      md += `- ${cert.name}${cert.issuer ? ` (${cert.issuer})` : ''}${cert.date ? ` - ${cert.date}` : ''}\n`;
    }
  }
  return md;
}

/**
 * Installs openresume skill to agent platforms.
 * Defaults to current folder (workspace) only unless local is set to false.
 * Supports agent filtering: 'all', 'antigravity', 'claude', 'pi'.
 */
export function installSkills({
  local = true,
  symlink = false,
  cwd = process.cwd(),
  agent = 'all',
} = {}) {
  const baseHome = process.env.OPENRESUME_HOME
    ? (basename(process.env.OPENRESUME_HOME) === '.openresume'
        ? dirname(process.env.OPENRESUME_HOME)
        : process.env.OPENRESUME_HOME)
    : homedir();

  const normalizedAgent = String(agent || 'all').toLowerCase();

  let globalTargetRoots = [];
  let localTargetRoots = [];

  if (normalizedAgent === 'antigravity') {
    globalTargetRoots = [join(baseHome, '.gemini', 'config', 'skills')];
    localTargetRoots = [join(cwd, '.agents', 'skills')];
  } else if (normalizedAgent === 'claude' || normalizedAgent === 'claudecode') {
    globalTargetRoots = [
      join(baseHome, '.claude', 'skills'),
      join(baseHome, '.agents', 'skills'),
    ];
    localTargetRoots = [
      join(cwd, '.agents', 'skills'),
      join(cwd, '.claude', 'skills'),
    ];
  } else if (normalizedAgent === 'pi' || normalizedAgent === 'piagent') {
    globalTargetRoots = [join(baseHome, '.pi', 'skills')];
    localTargetRoots = [join(cwd, '.pi', 'skills')];
  } else {
    // Default: 'all' agents
    globalTargetRoots = [
      join(baseHome, '.gemini', 'config', 'skills'),
      join(baseHome, '.pi', 'skills'),
      join(baseHome, '.claude', 'skills'),
      join(baseHome, '.agents', 'skills'),
    ];
    localTargetRoots = [
      join(cwd, '.agents', 'skills'),
      join(cwd, '.pi', 'skills'),
      join(cwd, '.claude', 'skills'),
    ];
  }

  const targetRoots = local ? localTargetRoots : globalTargetRoots;
  const installedPaths = [];

  // Ensure ~/.openresume directory exists
  mkdirSync(getUserHomeDir(), { recursive: true });

  for (const root of targetRoots) {
    const legacyDir = join(root, 'resume-studio');
    if (existsSync(legacyDir)) {
      try {
        rmSync(legacyDir, { recursive: true, force: true });
      } catch {}
    }

    const destDir = join(root, SKILL_NAME);
    mkdirSync(destDir, { recursive: true });

    for (const file of SKILL_FILES) {
      const srcFile = join(SOURCE_SKILL_DIR, file);
      const destFile = join(destDir, file);

      if (!existsSync(srcFile)) continue;

      if (existsSync(destFile)) {
        try {
          rmSync(destFile, { force: true });
        } catch {}
      }

      if (symlink) {
        try {
          symlinkSync(srcFile, destFile);
        } catch {
          copyFileSync(srcFile, destFile);
        }
      } else {
        copyFileSync(srcFile, destFile);
      }

      if (file.endsWith('.mjs')) {
        try {
          chmodSync(destFile, 0o755);
        } catch {}
      }
    }

    installedPaths.push(destDir);
  }

  return installedPaths;
}

/**
 * Returns comprehensive Markdown instructions for the current workspace.
 */
export function getWorkspaceReadmeContent() {
  return `# openResume — Workspace Instructions & Cheat Sheet

The **openResume** AI coding agent skill and interactive A4 resume compiler is installed and ready in this workspace.

---

## 1. How to Use with Your AI Coding Agent

Your AI coding agent (**Antigravity**, **Claude Code**, or **Pi Agent**) reads this workspace's skill instructions automatically. Open your agent chat and ask:

- **Create a new resume:**
  > "Create a new resume for me using openResume in resume.json"
- **Import and tailor existing resume:**
  > "Import my LinkedIn or PDF resume and tailor it for [Job Title] at [Company]"
- **Review and improve:**
  > "Review resume.json against ATS best practices and quantify my achievements with strong metrics"
- **Switch template layout:**
  > "Switch my resume template to executive layout with navy accent"

---

## 2. Quick CLI Commands

Zero external dependencies—runs with \`bunx\` or \`bun\`:

\`\`\`bash
# Initialize a starter resume.json in this folder:
bunx openresume init
# or: bunx github:Pankil02/resume-studio init

# Live browser preview with Classic/Executive toggle & 1-click A4 PDF export:
bunx openresume preview resume.json --open

# Compile to a standalone, printable A4 HTML file:
bunx openresume render resume.json -o resume.html

# Validate ATS schema constraints, unique IDs, and date order:
bunx openresume validate resume.json

# Import an existing PDF, text, or markdown resume to your personal profile (~/.openresume/):
bunx openresume profile import <your-resume.pdf|json|md>
\`\`\`

---

## 3. Resume Templates

- **\`classic\`** (Default): Canonical single-column serif format. Engineered for optimal Applicant Tracking System (ATS) parsing.
- **\`executive\`**: Contemporary two-column format with header monogram badges and compact Page 1 credentials sidebar.

---

## 4. 1-Click A4 PDF Export

1. Open live preview: \`bunx openresume preview resume.json --open\`
2. Click **Save / Download PDF** in the floating toolbar (or press \`Cmd+P\` / \`Ctrl+P\`).
3. In the browser print dialog:
   - **Destination:** Save as PDF
   - **Paper Size:** A4
   - **Margins:** None
   - **Scale:** 100%
   - **Headers & Footers:** Uncheck

---

## 5. How to Update openResume Skill Files

To update openResume to the latest release at any time:
- **Ask your agent:**
  > "Update openResume skill files to latest"
- **Or run via CLI:**
  \`\`\`bash
  bunx github:Pankil02/resume-studio update
  # or for machine-wide global installation:
  bunx github:Pankil02/resume-studio update --global
  \`\`\`
  *(Safely replaces skill files with latest templates, live preview fixes, and validator rules without altering your \`resume.json\` or personal profile).*
`;
}

/**
 * Generates README.md in the current folder with instructions if not already present.
 */
export function writeWorkspaceReadme(targetDir = process.cwd()) {
  const readmePath = join(targetDir, 'README.md');
  // Avoid overwriting if this is the openResume source repository itself
  if (existsSync(readmePath)) {
    try {
      const existing = readFileSync(readmePath, 'utf8');
      if (existing.includes('# openResume — Universal AI Coding Agent Skill & Interactive Resume Studio')) {
        return readmePath;
      }
    } catch {}
  }
  writeFileSync(readmePath, getWorkspaceReadmeContent(), 'utf8');
  return readmePath;
}

/**
 * Prints concise summary and prompts the user to check README.md for further action.
 */
export function printInstallSuccess({ installed = [], local = true, cwd = process.cwd(), isUpdate = false } = {}) {
  const actionWord = isUpdate ? 'updated' : 'installed';
  const scopeLabel = local ? 'current workspace (local folder)' : 'global environment';
  console.log(`\n✓ Successfully ${actionWord} openResume skill files in ${scopeLabel}:`);

  for (const p of installed) {
    let agentHint = '';
    if (p.includes('.gemini')) agentHint = ' (Antigravity)';
    else if (p.includes('.agents')) agentHint = ' (Antigravity, Claude Code)';
    else if (p.includes('.pi')) agentHint = ' (Pi Agent)';
    else if (p.includes('.claude')) agentHint = ' (Claude Code)';

    const displayPath = local && p.startsWith(cwd) ? p.slice(cwd.length + 1) : p;
    console.log(`  • ${displayPath}${agentHint}`);
  }

  console.log(`\n➜ See README.md file for further action.\n`);
}

/**
 * Streamlined 2-question interactive setup wizard for terminal users:
 * 1) Agent selection (Antigravity, Claude Code, Pi Agent, or All)
 * 2) Scope selection (Current folder vs Global)
 * Automatically bypassed in non-interactive (TTY=false), CI, update, or flag-driven environments.
 */
export async function promptInteractiveSetup(args = []) {
  const isUpdate = args.includes('update') || args[0] === 'update';
  const isGlobalFlag = args.includes('--global') || args.includes('-g');
  const isLocalFlag = args.includes('--local') || args.includes('-l');
  const isYesFlag = args.includes('--yes') || args.includes('-y');
  const symlink = args.includes('--symlink') || args.includes('-s');

  let agent = 'all';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' || args[i] === '-a') {
      agent = args[++i] || 'all';
    }
  }

  // If non-interactive environment, update command, or explicit flags were supplied, skip interactive prompts
  if (!process.stdin.isTTY || isYesFlag || isGlobalFlag || isLocalFlag || isUpdate) {
    let local = !isGlobalFlag;
    if (isUpdate && !isGlobalFlag && !isLocalFlag) {
      const hasLocal = existsSync(join(process.cwd(), '.agents', 'skills', 'openresume')) ||
                       existsSync(join(process.cwd(), '.pi', 'skills', 'openresume')) ||
                       existsSync(join(process.cwd(), '.claude', 'skills', 'openresume'));
      const baseHome = process.env.OPENRESUME_HOME
        ? (basename(process.env.OPENRESUME_HOME) === '.openresume'
            ? dirname(process.env.OPENRESUME_HOME)
            : process.env.OPENRESUME_HOME)
        : homedir();
      const hasGlobal = existsSync(join(baseHome, '.gemini', 'config', 'skills', 'openresume')) ||
                        existsSync(join(baseHome, '.pi', 'skills', 'openresume')) ||
                        existsSync(join(baseHome, '.claude', 'skills', 'openresume'));
      if (!hasLocal && hasGlobal) {
        local = false;
      }
    }

    const installed = installSkills({ local, symlink, agent });
    writeWorkspaceReadme(process.cwd());
    printInstallSuccess({ installed, local, isUpdate });
    return { local, agent, installed, isUpdate };
  }

  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│  openResume — Universal AI Coding Agent Skill & Interactive Compiler   │
└────────────────────────────────────────────────────────────────────────┘`);

    // Question 1: Agent selection
    console.log('\n? Which AI coding agent are you installing openResume for?');
    console.log('  1) All agents (Antigravity, Claude Code, Pi Agent) [Default]');
    console.log('  2) Antigravity');
    console.log('  3) Claude Code');
    console.log('  4) Pi Agent');
    const agentAnswer = (await rl.question('Select [1/2/3/4] (default: 1): ')).trim();

    if (agentAnswer === '2' || agentAnswer.toLowerCase() === 'antigravity') {
      agent = 'antigravity';
    } else if (agentAnswer === '3' || agentAnswer.toLowerCase() === 'claude') {
      agent = 'claude';
    } else if (agentAnswer === '4' || agentAnswer.toLowerCase() === 'pi') {
      agent = 'pi';
    } else {
      agent = 'all';
    }

    // Question 2: Scope selection
    console.log('\n? Where would you like to install the skill?');
    console.log('  1) Current folder only (workspace) [Default]');
    console.log('  2) Global across all projects on this machine');
    const scopeAnswer = (await rl.question('Select [1/2] (default: 1): ')).trim();

    const local = scopeAnswer !== '2';

    // Perform installation & create README.md
    const installed = installSkills({ local, symlink, agent });
    writeWorkspaceReadme(process.cwd());
    printInstallSuccess({ installed, local, isUpdate });

    rl.close();
    return { local, agent, installed, isUpdate };
  } catch (err) {
    rl.close();
    throw err;
  }
}

/**
 * Manages personal profile in ~/.openresume/
 */
export async function manageProfile(subcommand = 'show', fileArg = null) {
  const userHome = getUserHomeDir();
  mkdirSync(userHome, { recursive: true });
  const profileMdPath = join(userHome, 'profile.md');
  const resumeJsonPath = join(userHome, 'resume.json');
  const profilePdfPath = join(userHome, 'profile.pdf');

  if (subcommand === 'path') {
    console.log(`openResume Profile Directory: ${userHome}`);
    console.log(`  profile.md:  ${profileMdPath} (${existsSync(profileMdPath) ? 'exists' : 'missing'})`);
    console.log(`  resume.json: ${resumeJsonPath} (${existsSync(resumeJsonPath) ? 'exists' : 'missing'})`);
    console.log(`  profile.pdf: ${profilePdfPath} (${existsSync(profilePdfPath) ? 'exists' : 'missing'})`);
    return { dir: userHome, profileMdPath, resumeJsonPath, profilePdfPath };
  }

  if (subcommand === 'show') {
    if (!existsSync(profileMdPath)) {
      console.log(`No profile found at ${profileMdPath}`);
      console.log(`To import an existing resume:`);
      console.log(`  openresume profile import <file.pdf|txt|md|json>`);
      return { exists: false };
    }
    const content = readFileSync(profileMdPath, 'utf8');
    console.log(content);
    console.log(`\n---`);
    console.log(`Master resume.json: ${existsSync(resumeJsonPath) ? 'present' : 'absent'}`);
    console.log(`Original PDF:       ${existsSync(profilePdfPath) ? 'present' : 'absent'}`);
    return { exists: true, content };
  }

  if (subcommand === 'import' || subcommand === 'set') {
    if (!fileArg) {
      throw new Error(`Missing file path to import: openresume profile import <file>`);
    }
    const fullSrc = resolve(process.cwd(), fileArg);
    if (!existsSync(fullSrc)) {
      throw new Error(`File not found: ${fullSrc}`);
    }

    const ext = extname(fullSrc).toLowerCase();

    if (ext === '.json') {
      const raw = readFileSync(fullSrc, 'utf8');
      const val = validateResumeJson(raw);
      if (!val.ok) {
        throw new Error(`Cannot import invalid resume JSON:\n` + val.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n'));
      }
      writeFileSync(resumeJsonPath, raw, 'utf8');
      const md = generateProfileMarkdown(val.value);
      writeFileSync(profileMdPath, md, 'utf8');
      console.log(`✓ Imported resume into ${resumeJsonPath}`);
      console.log(`✓ Generated profile summary at ${profileMdPath}`);
      return { type: 'json', resumeJsonPath, profileMdPath };
    }

    if (ext === '.txt' || ext === '.md') {
      const text = readFileSync(fullSrc, 'utf8');
      writeFileSync(profileMdPath, text, 'utf8');
      console.log(`✓ Saved personal profile to ${profileMdPath}`);
      return { type: 'text', profileMdPath };
    }

    if (ext === '.pdf') {
      copyFileSync(fullSrc, profilePdfPath);
      const extracted = await extractPdfText(fullSrc);
      if (extracted && extracted.trim().length > 0) {
        writeFileSync(profileMdPath, extracted, 'utf8');
        console.log(`✓ Saved PDF to ${profilePdfPath}`);
        console.log(`✓ Extracted text into ${profileMdPath}`);
      } else {
        console.log(`✓ Saved PDF to ${profilePdfPath} (no extractable text stream detected)`);
      }
      return { type: 'pdf', profilePdfPath, profileMdPath };
    }

    throw new Error(`Unsupported file type '${ext}'. Supported: .pdf, .txt, .md, .json`);
  }

  throw new Error(`Unknown profile subcommand '${subcommand}'. Use: show, import, path`);
}

/**
 * Initializes a new resume JSON file from saved master profile or starter.
 */
export function initResume(targetPath = 'resume.json', options = {}) {
  const fullTarget = resolve(process.cwd(), targetPath);
  if (existsSync(fullTarget) && !options.force) {
    throw new Error(`Target file '${targetPath}' already exists. Use --force to overwrite.`);
  }

  const masterJsonPath = join(getUserHomeDir(), 'resume.json');
  let content;
  let source = 'starter.json';

  if (existsSync(masterJsonPath)) {
    content = readFileSync(masterJsonPath, 'utf8');
    source = 'master profile (~/.openresume/resume.json)';
  } else {
    const starterPath = join(SOURCE_SKILL_DIR, 'starter.json');
    content = readFileSync(starterPath, 'utf8');
  }

  if (options.template) {
    try {
      const parsed = JSON.parse(content);
      parsed.document = parsed.document || {};
      parsed.document.template = options.template;
      content = JSON.stringify(parsed, null, 2);
    } catch {}
  }

  writeFileSync(fullTarget, content, 'utf8');
  console.log(`✓ Initialized '${targetPath}' from ${source}`);
  return { path: fullTarget, source };
}

/**
 * Validates a resume file and prints results.
 */
export function validateFile(filePath) {
  const fullPath = resolve(process.cwd(), filePath);
  const raw = readFileSync(fullPath, 'utf8');
  const result = validateResumeJson(raw);

  if (!result.ok) {
    console.error(`✗ Validation failed for ${filePath}:`);
    for (const issue of result.issues) {
      console.error(`  • [${issue.path}]: ${issue.message}`);
    }
    return false;
  }

  if (result.warnings.length > 0) {
    console.warn(`⚠ Warnings for ${filePath}:`);
    for (const warn of result.warnings) {
      console.warn(`  • [${warn.path}]: ${warn.message}`);
    }
  }

  const doc = result.value;
  console.log(`✓ Validation passed: "${doc.document?.title || 'Resume'}"`);
  console.log(`  Template: ${doc.document?.template} | Max Pages: ${doc.document?.maxPages} | Sections: ${doc.sectionOrder?.length}`);
  return true;
}

/**
 * Renders a resume file to HTML and optionally opens in browser.
 */
export function renderCommand(filePath, options = {}) {
  const res = renderFile(filePath, options.output, { template: options.template });
  console.log(`✓ Rendered resume to '${basename(res.outputPath)}' (template: ${res.template}, pages: ${res.pages})`);
  console.log(`  Path: ${res.outputPath}`);
  if (options.open) {
    openBrowser(`file://${res.outputPath}`);
  }
  return res;
}

/**
 * Starts 127.0.0.1 live preview server with SSE auto-reload and settings persistence.
 */
export function startPreviewServer(inputPath, options = {}) {
  const fullInput = resolve(process.cwd(), inputPath);
  const port = options.port !== undefined ? Number(options.port) : 0;
  const sseClients = new Set();

  // Watch for input changes
  let debounceTimer = null;
  let watcher = null;
  try {
    watcher = watch(fullInput, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        for (const client of sseClients) {
          try {
            client.write('data: reload\n\n');
          } catch {}
        }
      }, 100);
    });
  } catch {}

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'GET' && url.pathname === '/') {
      try {
        const raw = readFileSync(fullInput, 'utf8');
        const validation = validateResumeJson(raw);
        if (!validation.ok) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Validation Error in ${inputPath}:\n` + validation.issues.map((i) => `• [${i.path}]: ${i.message}`).join('\n'));
          return;
        }
        const html = renderResumeHtml(validation.value, { liveReload: true });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.message}`);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('data: connected\n\n');
      sseClients.add(res);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/settings') {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
        if (bodyStr.length > 65536) req.destroy();
      });
      req.on('end', () => {
        try {
          const body = JSON.parse(bodyStr);
          const raw = readFileSync(fullInput, 'utf8');
          const doc = JSON.parse(raw);
          doc.document = doc.document || {};
          if (body.template) doc.document.template = body.template;
          if (body.font) doc.document.font = body.font;
          if (body.textSize || body.size) doc.document.textSize = String(body.textSize || body.size);
          if (body.accent) doc.document.accent = body.accent;
          if (body.margin) doc.document.margin = body.margin;

          const updatedJson = JSON.stringify(doc, null, 2);
          const val = validateResumeJson(updatedJson);
          if (!val.ok) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, errors: val.issues }));
            return;
          }

          // Atomic write
          const tmpFile = `${fullInput}.tmp-${Date.now()}`;
          writeFileSync(tmpFile, updatedJson, 'utf8');
          renameSync(tmpFile, fullInput);

          // If user master resume matches profile name, update master resume too
          const masterJson = join(getUserHomeDir(), 'resume.json');
          if (existsSync(masterJson)) {
            try {
              const mRaw = readFileSync(masterJson, 'utf8');
              const mDoc = JSON.parse(mRaw);
              if (mDoc.profile?.name && mDoc.profile?.name === doc.profile?.name) {
                mDoc.document = mDoc.document || {};
                if (body.template) mDoc.document.template = body.template;
                if (body.font) mDoc.document.font = body.font;
                if (body.textSize || body.size) mDoc.document.textSize = String(body.textSize || body.size);
                if (body.accent) mDoc.document.accent = body.accent;
                if (body.margin) mDoc.document.margin = body.margin;
                writeFileSync(masterJson, JSON.stringify(mDoc, null, 2), 'utf8');
              }
            } catch {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => {
      const assignedPort = server.address().port;
      const url = `http://127.0.0.1:${assignedPort}`;
      console.log(`\n  openResume Preview Live Server running at:`);
      console.log(`  ➜  Local:   ${url}`);
      console.log(`  ➜  File:    ${fullInput}`);
      console.log(`  ➜  Watch:   Watching for file changes...\n`);

      if (options.open) {
        openBrowser(url);
      }

      resolvePromise({
        server,
        port: assignedPort,
        url,
        close: () => {
          if (watcher) watcher.close();
          for (const c of sseClients) c.end();
          server.close();
        },
      });
    });
  });
}

export function printHelp() {
  console.log(`openResume — Ultra-Lean AI Coding Agent Skill & Interactive Resume Preview

Usage:
  openresume [command] [options]

Commands:
  install     Install openresume skill (default: current workspace folder only)
  update      Update/replace installed skill files to latest release
  init        Create a new resume JSON from saved personal profile or starter
  profile     Show or import persistent personal profile (~/.openresume/)
  validate    Validate resume schema, date bounds, uniqueness, and security rules
  render      Compile resume JSON into printable self-contained A4 HTML
  preview     Start local 127.0.0.1 live-reload server with template switcher

Options:
  --global, -g       Install skill globally across all agent environments
  --local, -l        Install skill to current workspace only (default)
  --agent, -a        Target agent (all, antigravity, claude, pi)
  --yes, -y          Skip interactive prompts and use safe defaults
  --symlink, -s      Symlink files instead of copying
  --template, -t     Template layout (classic, executive)
  --output, -o       Output HTML file path
  --open             Open in default browser
  --port, -p         Preview server port (default: 0 for random free port)
  --force, -f        Force overwrite existing files
  --version, -v      Show version
  -h, --help         Show this help message
`);
}

/**
 * Robust check if this module is the CLI entrypoint, supporting symlinks, bunx, and npx.
 */
export function isMainModule(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    const scriptPath = fileURLToPath(metaUrl);
    if (argv1 === scriptPath || argv1 === metaUrl) return true;
    const realArgv = realpathSync(argv1);
    const realScript = realpathSync(scriptPath);
    return realArgv === realScript;
  } catch {
    return false;
  }
}

// CLI Execution Entry Point
if (isMainModule(import.meta.url, process.argv[1])) {
  const args = process.argv.slice(2);
  const first = args[0];

  if (!first || first === '-h' || first === '--help') {
    if (!first) {
      await promptInteractiveSetup(args);
      process.exit(0);
    }
    printHelp();
    process.exit(0);
  }

  if (first === '-v' || first === '--version') {
    console.log('openresume 0.2.0');
    process.exit(0);
  }

  if (first === 'install' || first === 'update' || first === '--global' || first === '-g' || first === '--local' || first === '-l' || first === '--yes' || first === '-y') {
    await promptInteractiveSetup(args);
    process.exit(0);
  }

  if (first === 'profile') {
    const sub = args[1] || 'show';
    const file = args[2] || null;
    manageProfile(sub, file).catch((err) => {
      console.error(`✗ Profile error: ${err.message}`);
      process.exit(1);
    });
  } else if (first === 'init') {
    let file = 'resume.json';
    let template = null;
    let force = args.includes('--force') || args.includes('-f');
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--template' || args[i] === '-t') template = args[++i];
      else if (!args[i].startsWith('-')) file = args[i];
    }
    try {
      initResume(file, { template, force });
      process.exit(0);
    } catch (err) {
      console.error(`✗ Init error: ${err.message}`);
      process.exit(1);
    }
  } else if (first === 'validate') {
    const file = args[1];
    if (!file) {
      console.error('Error: Missing file to validate. Usage: openresume validate <file.json>');
      process.exit(1);
    }
    const ok = validateFile(file);
    process.exit(ok ? 0 : 1);
  } else if (first === 'render') {
    let file = null;
    let template = null;
    let output = null;
    let open = args.includes('--open');
    let watchMode = args.includes('--watch') || args.includes('-w');

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--template' || args[i] === '-t') template = args[++i];
      else if (args[i] === '--output' || args[i] === '-o') output = args[++i];
      else if (!args[i].startsWith('-') && !file) file = args[i];
    }

    if (!file) {
      console.error('Error: Missing file to render. Usage: openresume render <file.json>');
      process.exit(1);
    }

    if (watchMode) {
      startPreviewServer(file, { open });
    } else {
      try {
        renderCommand(file, { template, output, open });
        process.exit(0);
      } catch (err) {
        console.error(`✗ Render error: ${err.message}`);
        process.exit(1);
      }
    }
  } else if (first === 'preview') {
    let file = null;
    let port = 0;
    let open = args.includes('--open');

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--port' || args[i] === '-p') port = parseInt(args[++i], 10);
      else if (!args[i].startsWith('-') && !file) file = args[i];
    }

    if (!file) {
      console.error('Error: Missing file to preview. Usage: openresume preview <file.json> [--port N] [--open]');
      process.exit(1);
    }

    startPreviewServer(file, { port, open });
  } else {
    // If first argument is a JSON file, treat as validate or render
    if (first.endsWith('.json') && existsSync(first)) {
      renderCommand(first, { open: args.includes('--open') });
      process.exit(0);
    }
    console.error(`Unknown command: '${first}'. Run 'openresume --help' for usage.`);
    process.exit(1);
  }
}
