#!/usr/bin/env node
/**
 * Standalone openResume Document Validator
 * Zero-dependency pure ECMAScript (Node.js >= 18 or Bun)
 * Verifies openResume schema, section order, ID uniqueness, date ranges, and security limits.
 *
 * Usage:
 *   node validate.mjs <path-to-resume.json>
 *   bun validate.mjs <path-to-resume.json>
 */

import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const MAX_BYTES = 131072; // 128 KiB
const ID_REGEX = /^[a-z][a-z0-9-]{1,47}$/;
const DATE_REGEX = /^[0-9]{4}(?:-(?:0[1-9]|1[0-2]))?$/;
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const REQUIRED_SECTIONS = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'];

function printUsage() {
  console.error('Usage: node validate.mjs <resume.json>');
  console.error('       bun validate.mjs <resume.json>');
}

function validateUrl(urlStr, path, issues) {
  if (typeof urlStr !== 'string') return;
  if (urlStr.startsWith('data:image/')) return; // Allowed for icons
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      issues.push({ path, severity: 'error', message: `Unsafe URL protocol '${parsed.protocol}'. Only http, https, and mailto are allowed.` });
    }
    if (parsed.username || parsed.password) {
      issues.push({ path, severity: 'error', message: 'URLs must not contain embedded credentials.' });
    }
  } catch {
    issues.push({ path, severity: 'error', message: `Malformed URL '${urlStr}'.` });
  }
}

function validateString(val, path, min, max, issues, required = true) {
  if (val === undefined || val === null) {
    if (required) issues.push({ path, severity: 'error', message: 'Required field is missing.' });
    return;
  }
  if (typeof val !== 'string') {
    issues.push({ path, severity: 'error', message: `Expected string, got ${typeof val}.` });
    return;
  }
  if (CONTROL_CHAR_REGEX.test(val)) {
    issues.push({ path, severity: 'error', message: 'String contains forbidden ASCII control characters or NUL byte.' });
  }
  if (val.trim().length === 0 && min > 0) {
    issues.push({ path, severity: 'error', message: 'String cannot be empty or whitespace-only.' });
  }
  if (val.length < min) {
    issues.push({ path, severity: 'error', message: `Length (${val.length}) is below minimum of ${min} characters.` });
  }
  if (val.length > max) {
    issues.push({ path, severity: 'error', message: `Length (${val.length}) exceeds maximum limit of ${max} characters.` });
  }
}

function validateDate(dateStr, path, issues) {
  if (typeof dateStr !== 'string') {
    issues.push({ path, severity: 'error', message: 'Date must be a string.' });
    return;
  }
  if (!DATE_REGEX.test(dateStr)) {
    issues.push({ path, severity: 'error', message: `Date '${dateStr}' must match format YYYY or YYYY-MM.` });
  }
}

export function validateResumeJson(rawText) {
  const issues = [];
  const warnings = [];

  // 1. Byte limit check
  const byteLen = Buffer.byteLength(rawText, 'utf8');
  if (byteLen > MAX_BYTES) {
    return {
      ok: false,
      issues: [{ path: '/', severity: 'error', message: `File size (${byteLen} bytes) exceeds 128 KiB limit.` }],
      warnings: [],
    };
  }

  // 2. JSON syntax check
  let doc;
  try {
    doc = JSON.parse(rawText);
  } catch (err) {
    return {
      ok: false,
      issues: [{ path: '/', severity: 'error', message: `Invalid JSON syntax: ${err.message}` }],
      warnings: [],
    };
  }

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return {
      ok: false,
      issues: [{ path: '/', severity: 'error', message: 'Root document must be a JSON object.' }],
      warnings: [],
    };
  }

  // 3. Schema version
  if (doc.schemaVersion !== 1) {
    issues.push({ path: '/schemaVersion', severity: 'error', message: `schemaVersion must be integer 1, got ${doc.schemaVersion}.` });
  }

  // 4. Document config
  if (!doc.document || typeof doc.document !== 'object') {
    issues.push({ path: '/document', severity: 'error', message: 'Missing document configuration object.' });
  } else {
    validateString(doc.document.title, '/document/title', 1, 120, issues);
    if (!['classic', 'executive'].includes(doc.document.template)) {
      issues.push({ path: '/document/template', severity: 'error', message: `Template must be 'classic' or 'executive'.` });
    }
    if (![1, 2].includes(doc.document.maxPages)) {
      issues.push({ path: '/document/maxPages', severity: 'error', message: 'maxPages must be 1 or 2.' });
    }
    if (doc.document.accent && !['slate', 'ocean', 'forest', 'amber', 'navy'].includes(doc.document.accent)) {
      issues.push({ path: '/document/accent', severity: 'error', message: 'Invalid accent palette.' });
    }
    if (doc.document.paperSize && !['a4', 'letter'].includes(doc.document.paperSize)) {
      issues.push({ path: '/document/paperSize', severity: 'error', message: 'paperSize must be a4 or letter.' });
    }
    if (doc.document.margin && !['narrow', 'normal', 'compact'].includes(doc.document.margin)) {
      issues.push({ path: '/document/margin', severity: 'error', message: "margin must be 'narrow', 'normal', or 'compact'." });
    }
    if (doc.document.font && !['jakarta', 'inter', 'serif', 'times', 'system'].includes(doc.document.font)) {
      issues.push({ path: '/document/font', severity: 'error', message: "font must be 'jakarta', 'inter', 'serif', 'times', or 'system'." });
    }
    if (doc.document.textSize && !['10', '11', '12'].includes(String(doc.document.textSize))) {
      issues.push({ path: '/document/textSize', severity: 'error', message: "textSize must be '10', '11', or '12'." });
    }
    if (doc.document.sidebarSections !== undefined) {
      if (!Array.isArray(doc.document.sidebarSections)) {
        issues.push({ path: '/document/sidebarSections', severity: 'error', message: 'sidebarSections must be an array of section names.' });
      } else {
        const validSectionIds = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'];
        for (const sec of doc.document.sidebarSections) {
          if (!validSectionIds.includes(sec)) {
            issues.push({ path: '/document/sidebarSections', severity: 'error', message: `Invalid sidebar section '${sec}'.` });
          }
        }
      }
    }
  }

  // 5. Profile config
  if (!doc.profile || typeof doc.profile !== 'object') {
    issues.push({ path: '/profile', severity: 'error', message: 'Missing profile configuration object.' });
  } else {
    validateString(doc.profile.name, '/profile/name', 1, 80, issues);
    if (doc.profile.headline !== undefined && doc.profile.headline !== null) {
      validateString(doc.profile.headline, '/profile/headline', 1, 120, issues, false);
    }
    if (doc.profile.email) validateString(doc.profile.email, '/profile/email', 1, 100, issues, false);
    if (doc.profile.phone) validateString(doc.profile.phone, '/profile/phone', 1, 50, issues, false);
    if (doc.profile.location) validateString(doc.profile.location, '/profile/location', 1, 80, issues, false);
    if (doc.profile.links !== undefined && !Array.isArray(doc.profile.links)) {
      issues.push({ path: '/profile/links', severity: 'error', message: 'profile.links must be an array.' });
    }
  }

  // 6. Section order
  if (!Array.isArray(doc.sectionOrder)) {
    issues.push({ path: '/sectionOrder', severity: 'error', message: 'sectionOrder must be an array of section names.' });
  } else {
    const set = new Set(doc.sectionOrder);
    if (doc.sectionOrder.length !== 6 || set.size !== 6) {
      issues.push({ path: '/sectionOrder', severity: 'error', message: 'sectionOrder must contain exactly the 6 required sections once.' });
    }
    for (const sec of REQUIRED_SECTIONS) {
      if (!set.has(sec)) {
        issues.push({ path: '/sectionOrder', severity: 'error', message: `sectionOrder is missing '${sec}'.` });
      }
    }
  }

  // 7. Track IDs for global uniqueness
  const seenIds = new Set();
  function checkId(id, path) {
    if (typeof id !== 'string' || !ID_REGEX.test(id)) {
      issues.push({ path: `${path}/id`, severity: 'error', message: `ID '${id}' must match ^[a-z][a-z0-9-]{1,47}$.` });
      return;
    }
    if (seenIds.has(id)) {
      issues.push({ path: `${path}/id`, severity: 'error', message: `Duplicate item ID '${id}' detected across document.` });
    } else {
      seenIds.add(id);
    }
  }

  // Profile links
  if (Array.isArray(doc.profile?.links)) {
    doc.profile.links.forEach((l, idx) => {
      checkId(l.id, `/profile/links/${idx}`);
      validateString(l.label, `/profile/links/${idx}/label`, 1, 50, issues);
      validateUrl(l.url, `/profile/links/${idx}/url`, issues);
    });
  }

  // Summary
  if (doc.summary !== undefined && doc.summary !== null) {
    validateString(doc.summary, '/summary', 1, 900, issues, false);
  }

  // Experience
  if (!Array.isArray(doc.experience)) {
    issues.push({ path: '/experience', severity: 'error', message: 'experience must be an array.' });
  } else {
    doc.experience.forEach((e, idx) => {
      const p = `/experience/${idx}`;
      checkId(e.id, p);
      validateString(e.employer, `${p}/employer`, 1, 100, issues);
      validateString(e.role, `${p}/role`, 1, 100, issues);
      if (e.location) validateString(e.location, `${p}/location`, 1, 80, issues, false);
      if (e.technologies) validateString(e.technologies, `${p}/technologies`, 1, 250, issues, false);
      if (e.subtitle) validateString(e.subtitle, `${p}/subtitle`, 1, 250, issues, false);
      validateDate(e.start, `${p}/start`, issues);

      if (e.current) {
        if (e.end) {
          issues.push({ path: `${p}/end`, severity: 'error', message: 'Current role must not contain an end date.' });
        }
      } else {
        if (!e.end) {
          issues.push({ path: `${p}/end`, severity: 'error', message: 'Non-current role requires an end date.' });
        } else {
          validateDate(e.end, `${p}/end`, issues);
          if (e.start && e.end && e.start > e.end) {
            issues.push({ path: `${p}/end`, severity: 'error', message: `Start date (${e.start}) cannot be after end date (${e.end}).` });
          }
        }
      }

      if (!Array.isArray(e.bullets) || e.bullets.length === 0) {
        issues.push({ path: `${p}/bullets`, severity: 'error', message: 'Role must have at least 1 bullet point.' });
      } else {
        if (doc.document?.maxPages === 1 && e.bullets.length > 5) {
          warnings.push({ path: `${p}/bullets`, message: `Role has ${e.bullets.length} bullets; 3-4 bullets recommended for 1-page budget.` });
        }
        e.bullets.forEach((b, bIdx) => {
          validateString(b, `${p}/bullets/${bIdx}`, 1, 300, issues);
        });
      }
    });
  }

  // Education
  if (!Array.isArray(doc.education)) {
    issues.push({ path: '/education', severity: 'error', message: 'education must be an array.' });
  } else {
    doc.education.forEach((edu, idx) => {
      const p = `/education/${idx}`;
      checkId(edu.id, p);
      validateString(edu.institution, `${p}/institution`, 1, 100, issues);
      validateString(edu.qualification, `${p}/qualification`, 1, 100, issues);
      if (edu.start) validateDate(edu.start, `${p}/start`, issues);
      if (edu.end) validateDate(edu.end, `${p}/end`, issues);
      if (Array.isArray(edu.details)) {
        edu.details.forEach((d, dIdx) => validateString(d, `${p}/details/${dIdx}`, 1, 200, issues));
      }
    });
  }

  // Projects
  if (!Array.isArray(doc.projects)) {
    issues.push({ path: '/projects', severity: 'error', message: 'projects must be an array.' });
  } else {
    doc.projects.forEach((proj, idx) => {
      const p = `/projects/${idx}`;
      checkId(proj.id, p);
      validateString(proj.name, `${p}/name`, 1, 100, issues);
      if (proj.role) validateString(proj.role, `${p}/role`, 1, 100, issues, false);
      if (proj.url) validateUrl(proj.url, `${p}/url`, issues);
      if (Array.isArray(proj.bullets)) {
        proj.bullets.forEach((b, bIdx) => validateString(b, `${p}/bullets/${bIdx}`, 1, 300, issues));
      }
    });
  }

  // Skills
  if (!Array.isArray(doc.skills)) {
    issues.push({ path: '/skills', severity: 'error', message: 'skills must be an array.' });
  } else {
    doc.skills.forEach((sk, idx) => {
      const p = `/skills/${idx}`;
      checkId(sk.id, p);
      validateString(sk.category, `${p}/category`, 1, 50, issues);
      if (!Array.isArray(sk.items) || sk.items.length === 0) {
        issues.push({ path: `${p}/items`, severity: 'error', message: 'Skill category must contain at least 1 item.' });
      } else {
        sk.items.forEach((item, iIdx) => validateString(item, `${p}/items/${iIdx}`, 1, 50, issues));
      }
    });
  }

  // Certifications
  if (!Array.isArray(doc.certifications)) {
    issues.push({ path: '/certifications', severity: 'error', message: 'certifications must be an array.' });
  } else {
    doc.certifications.forEach((cert, idx) => {
      const p = `/certifications/${idx}`;
      checkId(cert.id, p);
      validateString(cert.name, `${p}/name`, 1, 120, issues);
      if (cert.issuer) validateString(cert.issuer, `${p}/issuer`, 1, 100, issues, false);
      if (cert.date) validateDate(cert.date, `${p}/date`, issues);
      if (cert.url) validateUrl(cert.url, `${p}/url`, issues);
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    value: issues.length === 0 ? doc : null,
  };
}

// fallow-ignore-next-line code-duplication
function isMain() {
  if (!process.argv[1]) return false;
  try {
    const s = fileURLToPath(import.meta.url);
    return process.argv[1] === s || realpathSync(process.argv[1]) === realpathSync(s);
  } catch {
    return false;
  }
}

// CLI execution
if (isMain()) {
  const filePath = process.argv[2];
  if (!filePath || filePath === '-h' || filePath === '--help') {
    printUsage();
    process.exit(filePath ? 0 : 1);
  }

  try {
    const fullPath = resolve(process.cwd(), filePath);
    const content = readFileSync(fullPath, 'utf8');
    const result = validateResumeJson(content);

    if (!result.ok) {
      console.error(`✗ Validation failed for ${filePath}:`);
      for (const issue of result.issues) {
        console.error(`  • [${issue.path}]: ${issue.message}`);
      }
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.warn(`⚠ Warnings for ${filePath}:`);
      for (const warn of result.warnings) {
        console.warn(`  • [${warn.path}]: ${warn.message}`);
      }
    }

    const doc = result.value;
    console.log(`✓ Validation passed: "${doc.document.title}"`);
    console.log(`  Template: ${doc.document.template} | Target Pages: ${doc.document.maxPages} | Sections: ${doc.sectionOrder.length}`);
    console.log(`  Experience: ${doc.experience.length} roles | Projects: ${doc.projects.length} | Skills: ${doc.skills.length} groups`);
    process.exit(0);
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
    process.exit(1);
  }
}
