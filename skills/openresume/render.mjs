#!/usr/bin/env node
/**
 * Standalone openResume Template Compiler & Interactive A4 HTML Renderer
 * Zero-dependency pure ECMAScript (Node.js >= 18 or Bun)
 *
 * Compiles an openResume JSON document into a self-contained, printable
 * single-file A4 HTML document with dual template views (Classic & Executive),
 * embedded toolbar, live settings sync, and exact print geometry.
 *
 * Usage:
 *   bun skills/openresume/render.mjs <resume.json> [--template classic|executive] [--output resume.html]
 *   node skills/openresume/render.mjs <resume.json> [--template classic|executive] [--output resume.html]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import process from 'node:process';
import { validateResumeJson } from './validate.mjs';

// Month names for date range formatting
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Escapes unsafe HTML characters to prevent XSS.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes URLs to prevent javascript: or data: injection (except safe image data URLs).
 */
export function sanitizeUrl(urlStr, allowImageData = false) {
  if (typeof urlStr !== 'string') return '#';
  const trimmed = urlStr.trim();
  if (allowImageData && trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return escapeHtml(trimmed);
    }
  } catch {
    // Malformed URL
  }
  return '#';
}

/**
 * Converts **bold** and <b>bold</b> markers into safe <strong> tags
 * while HTML-escaping all other text.
 */
export function formatTextWithBold(str) {
  if (!str) return '';
  const escaped = escapeHtml(str);
  return escaped.replace(/(\*\*(.+?)\*\*|&lt;b&gt;(.+?)&lt;\/b&gt;)/g, (_match, _p1, b1, b2) => {
    return `<strong>${b1 || b2}</strong>`;
  });
}

export const renderFormattedText = formatTextWithBold;

/**
 * Formats YYYY or YYYY-MM into 'Month Year' or 'Year'.
 */
export function formatYearMonth(ym) {
  if (!ym || typeof ym !== 'string') return '';
  if (!ym.includes('-')) return ym;
  const [year, monthStr] = ym.split('-');
  const monthIdx = parseInt(monthStr || '1', 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || monthStr;
  return `${monthName} ${year}`;
}

/**
 * Formats start, end, and current flag into a human-readable date range.
 */
export function formatDateRange(start, end, current) {
  if (current && start) {
    return `${formatYearMonth(start)} – Present`;
  }
  if (start && end) {
    return `${formatYearMonth(start)} – ${formatYearMonth(end)}`;
  }
  if (end) {
    return formatYearMonth(end);
  }
  if (start) {
    return formatYearMonth(start);
  }
  return '';
}

/**
 * Generates initials monogram from company name.
 */
export function getCompanyMonogram(companyName) {
  if (!companyName || typeof companyName !== 'string') return '';
  const cleaned = companyName.trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const firstWord = words[0];
  if (words.length === 1) {
    return cleaned.slice(0, 3).toUpperCase();
  }
  const secondWord = words[1];
  return ((firstWord[0] || '') + (secondWord[0] || '')).toUpperCase();
}

// Embedded SVG Icons (Self-Contained)
const ICONS = {
  phone: `<svg class="icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  email: `<svg class="icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  pin: `<svg class="icon-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
  globe: `<svg class="icon-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><line x1="2" x2="22" y1="12" y2="12"/></svg>`,
  calendar: `<svg class="icon-svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
};

/**
 * Returns embedded CSS styles for both Classic and Executive templates,
 * print rules, margin presets, and the interactive preview toolbar.
 */
function getEmbeddedCss(accent = 'slate', marginMode = 'narrow', paperSize = 'a4') {
  const isA4 = paperSize !== 'letter';
  const widthMm = isA4 ? '210mm' : '215.9mm';
  const heightMm = isA4 ? '297mm' : '279.4mm';
  const pageFormatKeyword = isA4 ? 'A4 portrait' : 'letter portrait';

  let marginPadding = '10mm';
  if (marginMode === 'normal') marginPadding = '14mm';
  if (marginMode === 'compact') marginPadding = '7mm';

  return `
/* openResume Stylesheet */
:root {
  --page-width: ${widthMm};
  --page-height: ${heightMm};
  --page-padding: ${marginPadding};
  --font-serif: 'Times New Roman', Times, 'Nimbus Roman', Georgia, serif;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --color-text-main: #000000;
  --color-text-muted: #333333;
  --color-bg-page: #ffffff;
}

/* Margin Presets */
body.margin-narrow, .margin-narrow { --page-padding: 10mm; }
body.margin-normal, .margin-normal { --page-padding: 14mm; }
body.margin-compact, .margin-compact { --page-padding: 7mm; }

/* Accent Palettes */
.accent-slate {
  --accent-primary: #000000;
  --accent-secondary: #333333;
  --accent-rule: #000000;
}
.accent-navy {
  --accent-primary: #0f2b5c;
  --accent-secondary: #1e3a8a;
  --accent-rule: #0f2b5c;
}
.accent-forest {
  --accent-primary: #14452f;
  --accent-secondary: #166534;
  --accent-rule: #14452f;
}
.accent-ocean {
  --accent-primary: #0284c7;
  --accent-secondary: #0369a1;
  --accent-rule: #0284c7;
}
.accent-amber {
  --accent-primary: #b45309;
  --accent-secondary: #92400e;
  --accent-rule: #b45309;
}

/* Page Geometry & Print Rules */
@page {
  size: ${pageFormatKeyword};
  margin: 0;
}

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print {
    display: none !important;
  }
  .resume-screen-shell {
    padding: 0 !important;
    background: transparent !important;
  }
  .template-view {
    display: none !important;
    gap: 0 !important;
  }
  body[data-active-template="classic"] .template-view[data-template-view="classic"],
  body[data-active-template="executive"] .template-view[data-template-view="executive"] {
    display: block !important;
  }
  .resume-page {
    margin: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    width: var(--page-width) !important;
    height: var(--page-height) !important;
    min-height: var(--page-height) !important;
    max-height: var(--page-height) !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .resume-page:not(:last-child) {
    page-break-after: always !important;
    break-after: page !important;
  }
  .resume-page:last-child {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
}

/* Screen Preview Shell */
body {
  margin: 0;
  padding: 0;
  background-color: #2b2622;
  color: #111827;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.resume-screen-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px 16px;
  box-sizing: border-box;
}

.template-view {
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
}
body[data-active-template="classic"] .template-view[data-template-view="classic"],
body[data-active-template="executive"] .template-view[data-template-view="executive"] {
  display: flex;
}

.resume-page {
  width: var(--page-width);
  min-height: var(--page-height);
  box-sizing: border-box;
  padding: var(--page-padding);
  background-color: var(--color-bg-page);
  color: var(--color-text-main);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.resume-page-content {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

/* Floating Toolbar adhering strictly to DESIGN.md */
.preview-toolbar {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  background: rgba(56, 51, 48, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(247, 245, 240, 0.14);
  color: #f7f5f0;
  padding: 10px 20px;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: var(--font-sans);
  font-size: 12px;
}
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar-brand {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: -0.01em;
  color: #f7f5f0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: #2b2622;
  color: #bfb9b2;
  border: 1px solid rgba(247, 245, 240, 0.12);
}
.toolbar-segmented {
  display: inline-flex;
  background: #2b2622;
  padding: 2px;
  border-radius: 3px;
  border: 1px solid rgba(247, 245, 240, 0.12);
}
.toolbar-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: #bfb9b2;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.toolbar-btn:hover {
  color: #f7f5f0;
}
.toolbar-btn.is-active {
  background: #3f3a36;
  color: #f7f5f0;
  font-weight: 600;
}
.toolbar-select {
  background: #2b2622;
  color: #f7f5f0;
  border: 1px solid rgba(247, 245, 240, 0.14);
  border-radius: 3px;
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
}
.toolbar-cta {
  appearance: none;
  background: #f7f5f0;
  color: #1c1917;
  border: 1px solid #f7f5f0;
  border-radius: 3px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.toolbar-cta:hover {
  background: #eae6df;
}
.toolbar-secondary {
  appearance: none;
  background: #3f3a36;
  color: #f7f5f0;
  border: 1px solid rgba(247, 245, 240, 0.14);
  border-radius: 3px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

/* Typography & Reset */
h1, h2, h3, p, ul, li {
  margin: 0;
  padding: 0;
}

.icon-svg {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}

/* =========================================================================
   1. CLASSIC TEMPLATE (Single-Column LaTeX / SWE Canonical Format)
   ========================================================================= */
.template-classic {
  font-family: var(--font-serif);
  line-height: 1.28;
}

.template-classic .atom-header {
  text-align: center;
  margin-bottom: 8px;
}

.template-classic .profile-name {
  font-family: var(--font-serif);
  font-size: 22pt;
  font-weight: 700;
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 2px;
}

.template-classic .profile-headline {
  font-family: var(--font-serif);
  font-size: 10pt;
  font-style: italic;
  margin-bottom: 4px;
}

.template-classic .profile-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  font-size: 9.5pt;
  line-height: 1.3;
}

.template-classic .meta-item {
  display: inline-flex;
  align-items: center;
}

.template-classic .meta-sep {
  margin: 0 5px;
  color: #333333;
}

.template-classic .meta-link {
  color: var(--color-text-main);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.template-classic .atom-section-heading {
  margin-top: 10px;
  margin-bottom: 4px;
}

.template-classic .atom-section-heading:first-of-type {
  margin-top: 4px;
}

.template-classic .section-heading-title {
  font-family: var(--font-serif);
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--accent-primary);
  margin-bottom: 2px;
}

.template-classic .section-heading-rule {
  width: 100%;
  height: 1px;
  background-color: var(--accent-rule);
}

.template-classic .summary-body-text {
  font-family: var(--font-serif);
  font-size: 10pt;
  text-align: justify;
  margin-bottom: 6px;
}

.template-classic .atom-entry-heading {
  margin-top: 5px;
  margin-bottom: 2px;
}

.template-classic .entry-top-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.template-classic .entry-title-group {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0;
}

.template-classic .entry-title {
  font-size: 10.5pt;
  font-weight: 700;
}

.template-classic .entry-sep {
  margin: 0 4px;
}

.template-classic .entry-subtitle {
  font-size: 10.5pt;
  font-weight: 700;
  font-style: italic;
}

.template-classic .entry-meta-group {
  text-align: right;
  white-space: nowrap;
  font-size: 10pt;
  font-weight: 700;
}

.template-classic .entry-subline {
  font-size: 9.5pt;
  font-style: italic;
  margin-top: 1px;
  margin-bottom: 2px;
}

.template-classic .entry-bullets-list {
  margin: 2px 0 6px 0;
  padding-left: 16px;
  list-style-type: disc;
}

.template-classic .entry-bullet {
  font-size: 10pt;
  line-height: 1.3;
  margin-bottom: 2px;
}

.template-classic .atom-skill-group,
.template-classic .atom-education-detail,
.template-classic .atom-certification {
  font-size: 10pt;
  line-height: 1.35;
  margin-bottom: 2.5px;
  padding-left: 16px;
}

.template-classic .skill-category {
  font-weight: 700;
}

.template-classic .cert-name {
  font-weight: 700;
}

/* =========================================================================
   2. EXECUTIVE TEMPLATE (Two-Column Modern Layout)
   ========================================================================= */
.template-executive {
  font-family: var(--font-sans);
  line-height: 1.3;
  color: #111827;
}

.template-executive .atom-header {
  text-align: left;
  margin-bottom: 12px;
}

.template-executive .profile-name {
  font-size: 26pt;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: #000000;
  line-height: 1.05;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.template-executive .profile-headline {
  font-size: 11pt;
  font-weight: 600;
  color: var(--accent-primary, #0284c7);
  margin-bottom: 6px;
}

.template-executive .profile-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  font-size: 9pt;
  color: #111827;
}

.template-executive .meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.template-executive .meta-item .icon-svg {
  color: var(--accent-primary);
}

.template-executive .meta-link {
  color: #111827;
  text-decoration: none;
}
.template-executive .meta-link:hover {
  text-decoration: underline;
  color: var(--accent-primary);
}

.executive-page-1-body {
  display: flex;
  flex-direction: row;
  gap: 8mm;
  width: 100%;
  box-sizing: border-box;
}

.executive-primary-column {
  flex: 0 0 calc((100% - 8mm) * 0.61);
  width: calc((100% - 8mm) * 0.61);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.executive-sidebar-column {
  flex: 0 0 calc((100% - 8mm) * 0.39);
  width: calc((100% - 8mm) * 0.39);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.executive-continued-content {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.template-executive .atom-section-heading {
  margin-top: 10px;
  margin-bottom: 5px;
}

.template-executive .section-heading-title {
  font-size: 10.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #000000;
  margin-bottom: 3px;
}

.template-executive .section-heading-rule {
  width: 100%;
  height: 1.5px;
  background-color: #000000;
}

.template-executive .summary-body-text {
  font-size: 8.8pt;
  line-height: 1.35;
  color: #1f2937;
  margin-bottom: 6px;
}

.template-executive .atom-entry-heading {
  margin-top: 8px;
  margin-bottom: 3px;
}

.template-executive .executive-entry-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
}

.template-executive .entry-company-badge {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 50%;
  background-color: #f1f5f9;
  border: 1px solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7.5pt;
  font-weight: 700;
  color: var(--accent-primary);
  margin-top: 2px;
}

.template-executive .entry-company-badge.has-icon {
  border-radius: 4px;
  background-color: #ffffff;
}

.template-executive .company-badge-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.template-executive .executive-entry-text-group {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.template-executive .entry-role-title {
  font-size: 9.8pt;
  font-weight: 700;
  color: #000000;
  line-height: 1.2;
}

.template-executive .entry-company-name {
  font-size: 9.2pt;
  font-weight: 600;
  color: var(--accent-primary);
  line-height: 1.2;
  margin-top: 1px;
}

.template-executive .entry-date-location-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 8.2pt;
  color: #4b5563;
  margin-top: 2px;
}

.template-executive .entry-bullets-list {
  margin: 2px 0 6px 0;
  padding-left: 14px;
  list-style-type: disc;
}

.template-executive .entry-bullet {
  font-size: 8.8pt;
  line-height: 1.32;
  color: #1f2937;
  margin-bottom: 2px;
}

.template-executive .executive-sidebar-column .atom-section-heading {
  margin-top: 8px;
}

.template-executive .sidebar-skill-group {
  margin-bottom: 6px;
}

.template-executive .sidebar-skill-category {
  font-size: 9pt;
  font-weight: 700;
  color: #000000;
  margin-bottom: 2px;
}

.template-executive .sidebar-skill-items {
  font-size: 8.5pt;
  color: #374151;
  line-height: 1.25;
}

.template-executive .sidebar-edu-item,
.template-executive .sidebar-cert-item {
  margin-bottom: 6px;
  font-size: 8.5pt;
}

.template-executive .sidebar-edu-qual,
.template-executive .sidebar-cert-name {
  font-weight: 700;
  color: #000000;
}

.template-executive .sidebar-edu-inst,
.template-executive .sidebar-cert-issuer {
  color: var(--accent-primary);
}

.template-executive .sidebar-edu-meta,
.template-executive .sidebar-cert-date {
  font-size: 8pt;
  color: #6b7280;
}
`;
}

/**
 * Builds HTML for Header Atom.
 */
function renderHeader(profile, template) {
  if (!profile) return '';
  const name = escapeHtml(profile.name || '');
  const headline = escapeHtml(profile.headline || '');
  const phone = escapeHtml(profile.phone || '');
  const email = escapeHtml(profile.email || '');
  const location = escapeHtml(profile.location || '');
  const links = Array.isArray(profile.links) ? profile.links : [];

  let metaItems = [];

  if (template === 'classic') {
    if (location) metaItems.push(`<span class="meta-item meta-location">${location}</span>`);
    if (phone) metaItems.push(`<span class="meta-item meta-phone">${phone}</span>`);
    if (email) metaItems.push(`<a class="meta-item meta-email meta-link" href="mailto:${email}">${email}</a>`);
    for (const link of links) {
      const href = sanitizeUrl(link.url);
      const label = escapeHtml(link.label || 'Link');
      metaItems.push(`<a class="meta-item meta-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    }

    return `
      <header class="atom-header">
        <h1 class="profile-name">${name}</h1>
        ${headline ? `<div class="profile-headline">${headline}</div>` : ''}
        ${metaItems.length > 0 ? `<div class="profile-meta-row">${metaItems.join('<span class="meta-sep" aria-hidden="true">|</span>')}</div>` : ''}
      </header>
    `;
  }

  // Executive layout uses SVG icons
  if (phone) {
    metaItems.push(`<span class="meta-item meta-phone">${ICONS.phone}<span>${phone}</span></span>`);
  }
  if (email) {
    metaItems.push(`<a class="meta-item meta-email meta-link" href="mailto:${email}">${ICONS.email}<span>${email}</span></a>`);
  }
  if (location) {
    metaItems.push(`<span class="meta-item meta-location">${ICONS.pin}<span>${location}</span></span>`);
  }
  for (const link of links) {
    const href = sanitizeUrl(link.url);
    const label = escapeHtml(link.label || 'Link');
    metaItems.push(`<a class="meta-item meta-link" href="${href}" target="_blank" rel="noopener noreferrer">${ICONS.globe}<span>${label}</span></a>`);
  }

  return `
    <header class="atom-header">
      <h1 class="profile-name">${name}</h1>
      ${headline ? `<div class="profile-headline">${headline}</div>` : ''}
      ${metaItems.length > 0 ? `<div class="profile-meta-row">${metaItems.join('')}</div>` : ''}
    </header>
  `;
}

/**
 * Builds HTML for Section Heading.
 */
function renderSectionHeading(title, sectionId, template) {
  let displayTitle = title;
  if (template === 'executive') {
    if (sectionId === 'experience') displayTitle = 'EXPERIENCE';
    else if (sectionId === 'skills') displayTitle = 'SKILLS';
    else if (sectionId === 'projects') displayTitle = 'KEY ACHIEVEMENTS';
    else if (sectionId === 'education') displayTitle = 'EDUCATION';
    else if (sectionId === 'certifications') displayTitle = 'CERTIFICATIONS';
    else if (sectionId === 'summary') displayTitle = 'SUMMARY';
    else displayTitle = (title || '').toUpperCase();
  }
  return `
    <div class="atom-section-heading">
      <h2 class="section-heading-title">${escapeHtml(displayTitle)}</h2>
      <div class="section-heading-rule"></div>
    </div>
  `;
}

/**
 * Builds HTML for Experience section.
 */
function renderExperienceSection(experience, template) {
  if (!Array.isArray(experience) || experience.length === 0) return '';
  let out = renderSectionHeading('Experience', 'experience', template);

  for (const item of experience) {
    const employer = escapeHtml(item.employer || '');
    const role = escapeHtml(item.role || '');
    const location = escapeHtml(item.location || '');
    const dateRange = formatDateRange(item.start, item.end, item.current);
    const bullets = Array.isArray(item.bullets) ? item.bullets : [];

    if (template === 'executive') {
      const monogram = getCompanyMonogram(item.employer || '');
      const hasIcon = item.icon && (item.icon.startsWith('data:image/') || item.icon.startsWith('https://') || item.icon.startsWith('http://'));
      const badgeContent = hasIcon
        ? `<img class="company-badge-img" src="${sanitizeUrl(item.icon, true)}" alt="${employer}" />`
        : monogram;

      out += `
        <article class="atom-entry-heading">
          <div class="executive-entry-wrapper">
            <div class="entry-company-badge ${hasIcon ? 'has-icon' : ''}" aria-hidden="true">${badgeContent}</div>
            <div class="executive-entry-text-group">
              <div class="entry-role-title">${role}</div>
              <div class="entry-company-name">${employer}</div>
              <div class="entry-date-location-row">
                ${dateRange ? `<span>${ICONS.calendar} ${escapeHtml(dateRange)}</span>` : ''}
                ${location ? `<span>${ICONS.pin} ${location}</span>` : ''}
              </div>
            </div>
          </div>
          <ul class="entry-bullets-list">
            ${bullets.map((b) => `<li class="entry-bullet">${formatTextWithBold(b)}</li>`).join('')}
          </ul>
        </article>
      `;
    } else {
      // Classic
      out += `
        <article class="atom-entry-heading">
          <div class="entry-top-row">
            <div class="entry-title-group">
              <span class="entry-title">${employer}</span>
              <span class="entry-sep">—</span>
              <span class="entry-subtitle">${role}</span>
            </div>
            <div class="entry-meta-group">
              <span>${escapeHtml(dateRange)}</span>
            </div>
          </div>
          ${location ? `<div class="entry-subline">${location}</div>` : ''}
          <ul class="entry-bullets-list">
            ${bullets.map((b) => `<li class="entry-bullet">${formatTextWithBold(b)}</li>`).join('')}
          </ul>
        </article>
      `;
    }
  }

  return out;
}

/**
 * Builds HTML for Education section.
 */
function renderEducationSection(education, template, isSidebar = false) {
  if (!Array.isArray(education) || education.length === 0) return '';
  let out = renderSectionHeading('Education', 'education', template);

  for (const item of education) {
    const institution = escapeHtml(item.institution || '');
    const qualification = escapeHtml(item.qualification || '');
    const location = escapeHtml(item.location || '');
    const dateRange = formatDateRange(item.start, item.end, false);
    const details = Array.isArray(item.details) ? item.details : [];

    if (isSidebar && template === 'executive') {
      out += `
        <div class="sidebar-edu-item">
          <div class="sidebar-edu-qual">${qualification}</div>
          <div class="sidebar-edu-inst">${institution}</div>
          ${dateRange || location ? `<div class="sidebar-edu-meta">${[dateRange, location].filter(Boolean).map(escapeHtml).join(' | ')}</div>` : ''}
          ${details.map((d) => `<div class="sidebar-edu-meta">• ${formatTextWithBold(d)}</div>`).join('')}
        </div>
      `;
    } else {
      // Classic
      out += `
        <div class="atom-entry-heading">
          <div class="entry-top-row">
            <div class="entry-title-group">
              <span class="entry-title">${institution}</span>
              <span class="entry-sep">—</span>
              <span class="entry-subtitle">${qualification}</span>
            </div>
            <div class="entry-meta-group">
              <span>${escapeHtml(dateRange)}</span>
            </div>
          </div>
          ${location ? `<div class="entry-subline">${location}</div>` : ''}
          ${details.map((d) => `<div class="atom-education-detail">• ${formatTextWithBold(d)}</div>`).join('')}
        </div>
      `;
    }
  }

  return out;
}

/**
 * Builds HTML for Projects section.
 */
function renderProjectsSection(projects, template) {
  if (!Array.isArray(projects) || projects.length === 0) return '';
  let out = renderSectionHeading('Projects', 'projects', template);

  for (const item of projects) {
    const name = escapeHtml(item.name || '');
    const role = escapeHtml(item.role || '');
    const url = item.url ? sanitizeUrl(item.url) : '';
    const bullets = Array.isArray(item.bullets) ? item.bullets : [];

    out += `
      <article class="atom-entry-heading">
        <div class="entry-top-row">
          <div class="entry-title-group">
            <span class="entry-title">${name}</span>
            ${role ? `<span class="entry-sep">—</span><span class="entry-subtitle">${role}</span>` : ''}
          </div>
          ${url ? `<div class="entry-meta-group"><a class="meta-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a></div>` : ''}
        </div>
        <ul class="entry-bullets-list">
          ${bullets.map((b) => `<li class="entry-bullet">${formatTextWithBold(b)}</li>`).join('')}
        </ul>
      </article>
    `;
  }

  return out;
}

/**
 * Builds HTML for Skills section.
 */
function renderSkillsSection(skills, template, isSidebar = false) {
  if (!Array.isArray(skills) || skills.length === 0) return '';
  let out = renderSectionHeading('Skills', 'skills', template);

  if (isSidebar && template === 'executive') {
    for (const group of skills) {
      const cat = escapeHtml(group.category || '');
      const items = (Array.isArray(group.items) ? group.items : []).map(escapeHtml).join(', ');
      out += `
        <div class="sidebar-skill-group">
          <div class="sidebar-skill-category">${cat}</div>
          <div class="sidebar-skill-items">${items}</div>
        </div>
      `;
    }
    return out;
  }

  for (const group of skills) {
    const cat = escapeHtml(group.category || '');
    const items = (Array.isArray(group.items) ? group.items : []).map(escapeHtml).join(', ');
    out += `
      <div class="atom-skill-group">
        <span class="skill-category">${cat}:</span>
        <span class="skill-items">${items}</span>
      </div>
    `;
  }

  return out;
}

/**
 * Builds HTML for Certifications section.
 */
function renderCertificationsSection(certifications, template, isSidebar = false) {
  if (!Array.isArray(certifications) || certifications.length === 0) return '';
  let out = renderSectionHeading('Certifications', 'certifications', template);

  if (isSidebar && template === 'executive') {
    for (const cert of certifications) {
      const name = escapeHtml(cert.name || '');
      const issuer = escapeHtml(cert.issuer || '');
      const date = cert.date ? formatYearMonth(cert.date) : '';
      const url = cert.url ? sanitizeUrl(cert.url) : '';

      out += `
        <div class="sidebar-cert-item">
          <div class="sidebar-cert-name">${url ? `<a class="meta-link" href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>` : name}</div>
          ${issuer ? `<div class="sidebar-cert-issuer">${issuer}</div>` : ''}
          ${date ? `<div class="sidebar-cert-date">${escapeHtml(date)}</div>` : ''}
        </div>
      `;
    }
    return out;
  }

  for (const cert of certifications) {
    const name = escapeHtml(cert.name || '');
    const issuer = escapeHtml(cert.issuer || '');
    const date = cert.date ? formatYearMonth(cert.date) : '';
    const url = cert.url ? sanitizeUrl(cert.url) : '';

    out += `
      <div class="atom-certification">
        <span class="cert-name">${name}</span>
        ${issuer ? `<span class="cert-issuer">— ${issuer}</span>` : ''}
        ${date ? `<span class="cert-date">(${escapeHtml(date)})</span>` : ''}
        ${url ? `<a class="cert-link" href="${url}" target="_blank" rel="noopener noreferrer">Verify</a>` : ''}
      </div>
    `;
  }

  return out;
}

/**
 * Renders the Summary section.
 */
function renderSummarySection(summary, template) {
  if (!summary || summary.trim().length === 0) return '';
  return `
    ${renderSectionHeading('Summary', 'summary', template)}
    <p class="summary-body-text">${formatTextWithBold(summary.trim())}</p>
  `;
}

/**
 * Renders individual pages for the specified template (classic or executive).
 */
export function renderTemplatePagesHtml(doc, template, accent = 'slate') {
  const maxPages = doc.document?.maxPages || 1;
  const headerHtml = renderHeader(doc.profile, template);
  const sectionOrder = Array.isArray(doc.sectionOrder)
    ? doc.sectionOrder
    : ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'];

  const renderedSections = {
    summary: renderSummarySection(doc.summary, template),
    experience: renderExperienceSection(doc.experience, template),
    education: renderEducationSection(doc.education, template, false),
    projects: renderProjectsSection(doc.projects, template),
    skills: renderSkillsSection(doc.skills, template, false),
    certifications: renderCertificationsSection(doc.certifications, template, false),
  };

  let pagesHtml = '';

  if (template === 'executive') {
    if (maxPages === 1) {
      const primaryHtml = [
        renderedSections.summary,
        renderedSections.experience,
        renderedSections.projects,
      ].filter(Boolean).join('');

      const sidebarHtml = [
        renderSkillsSection(doc.skills, template, true),
        renderEducationSection(doc.education, template, true),
        renderCertificationsSection(doc.certifications, template, true),
      ].filter(Boolean).join('');

      pagesHtml += `
        <section class="resume-page template-executive accent-${accent}" data-page="1">
          <div class="resume-page-content">
            ${headerHtml}
            <div class="executive-page-1-body">
              <main class="executive-primary-column">
                ${primaryHtml}
              </main>
              <aside class="executive-sidebar-column">
                ${sidebarHtml}
              </aside>
            </div>
          </div>
        </section>
      `;
    } else {
      // 2-page split
      const exp = Array.isArray(doc.experience) ? doc.experience : [];
      let page1Exp = exp;
      let page2Exp = [];
      if (exp.length > 3) {
        page1Exp = exp.slice(0, 3);
        page2Exp = exp.slice(3);
      }

      const primaryHtml = [
        renderedSections.summary,
        renderExperienceSection(page1Exp, template),
      ].filter(Boolean).join('');

      const sidebarHtml = [
        renderSkillsSection(doc.skills, template, true),
        renderEducationSection(doc.education, template, true),
        renderCertificationsSection(doc.certifications, template, true),
      ].filter(Boolean).join('');

      pagesHtml += `
        <section class="resume-page template-executive accent-${accent}" data-page="1">
          <div class="resume-page-content">
            ${headerHtml}
            <div class="executive-page-1-body">
              <main class="executive-primary-column">
                ${primaryHtml}
              </main>
              <aside class="executive-sidebar-column">
                ${sidebarHtml}
              </aside>
            </div>
          </div>
        </section>
      `;

      const page2ExpHtml = page2Exp.length > 0 ? renderExperienceSection(page2Exp, template) : '';
      const page2ProjectsHtml = renderedSections.projects || '';
      const page2Content = [page2ExpHtml, page2ProjectsHtml].filter(Boolean).join('');

      pagesHtml += `
        <section class="resume-page template-executive accent-${accent}" data-page="2">
          <div class="resume-page-content">
            <div class="atom-section-heading">
              <h2 class="section-heading-title">CONTINUED</h2>
              <div class="section-heading-rule"></div>
            </div>
            <main class="executive-continued-content">
              ${page2Content}
            </main>
          </div>
        </section>
      `;
    }
  } else {
    // Single-column classic template
    if (maxPages === 1) {
      const bodyContent = sectionOrder.map((sec) => renderedSections[sec] || '').join('');
      pagesHtml += `
        <section class="resume-page template-classic accent-${accent}" data-page="1">
          <div class="resume-page-content">
            ${headerHtml}
            <main>
              ${bodyContent}
            </main>
          </div>
        </section>
      `;
    } else {
      const page1Sections = ['summary', 'experience'];
      const page2Sections = sectionOrder.filter((s) => !page1Sections.includes(s));

      const page1Content = page1Sections.map((sec) => renderedSections[sec] || '').join('');
      const page2Content = page2Sections.map((sec) => renderedSections[sec] || '').join('');

      pagesHtml += `
        <section class="resume-page template-classic accent-${accent}" data-page="1">
          <div class="resume-page-content">
            ${headerHtml}
            <main>
              ${page1Content}
            </main>
          </div>
        </section>
        <section class="resume-page template-classic accent-${accent}" data-page="2">
          <div class="resume-page-content">
            <main>
              ${page2Content}
            </main>
          </div>
        </section>
      `;
    }
  }

  return pagesHtml;
}

/**
 * Renders complete HTML string for an openResume document.
 * Outputs both Classic and Executive views inside .template-view containers,
 * with an interactive preview toolbar and print styling.
 *
 * @param {object|string} resumeInput - Parsed openResume object or JSON string.
 * @param {object} [options] - Compiler options.
 * @param {'classic'|'executive'} [options.template] - Default active template.
 * @param {boolean} [options.liveReload] - Whether to connect to SSE /events.
 * @returns {string} Fully self-contained A4 HTML string.
 */
export function renderResumeHtml(resumeInput, options = {}) {
  const doc = typeof resumeInput === 'string' ? JSON.parse(resumeInput) : resumeInput;
  const activeTemplate = options.template || doc.document?.template || 'classic';
  const accent = doc.document?.accent || 'slate';
  const marginMode = doc.document?.margin || 'narrow';
  const paperSize = doc.document?.paperSize || 'a4';
  const title = doc.document?.title || `${doc.profile?.name || 'Resume'} — openResume`;

  const embeddedCss = getEmbeddedCss(accent, marginMode, paperSize);

  // Render both Classic and Executive views
  const classicPages = renderTemplatePagesHtml(doc, 'classic', accent);
  const executivePages = renderTemplatePagesHtml(doc, 'executive', accent);

  const toolbarHtml = `
  <header class="preview-toolbar no-print">
    <div class="toolbar-group">
      <span class="toolbar-brand">openResume <span class="toolbar-badge">A4</span></span>
      <div class="toolbar-segmented" role="group" aria-label="Template">
        <button type="button" class="toolbar-btn${activeTemplate === 'classic' ? ' is-active' : ''}" data-set-template="classic">Classic (ATS)</button>
        <button type="button" class="toolbar-btn${activeTemplate === 'executive' ? ' is-active' : ''}" data-set-template="executive">Executive (2-Col)</button>
      </div>
    </div>
    <div class="toolbar-group">
      <label for="select-accent" style="color:#bfb9b2">Accent:</label>
      <select id="select-accent" class="toolbar-select">
        <option value="slate"${accent === 'slate' ? ' selected' : ''}>Slate</option>
        <option value="navy"${accent === 'navy' ? ' selected' : ''}>Navy</option>
        <option value="forest"${accent === 'forest' ? ' selected' : ''}>Forest</option>
        <option value="ocean"${accent === 'ocean' ? ' selected' : ''}>Ocean</option>
        <option value="amber"${accent === 'amber' ? ' selected' : ''}>Amber</option>
      </select>
      <label for="select-margin" style="color:#bfb9b2">Margin:</label>
      <select id="select-margin" class="toolbar-select">
        <option value="narrow"${marginMode === 'narrow' ? ' selected' : ''}>Narrow (10mm)</option>
        <option value="normal"${marginMode === 'normal' ? ' selected' : ''}>Normal (14mm)</option>
        <option value="compact"${marginMode === 'compact' ? ' selected' : ''}>Compact (7mm)</option>
      </select>
      <button type="button" class="toolbar-secondary" id="btn-download-json">Save JSON</button>
      <button type="button" class="toolbar-cta" id="btn-print-pdf">Save / Download PDF</button>
    </div>
  </header>`;

  const safeJson = JSON.stringify(doc).replace(/</g, '\\u003c');
  const controllerScript = `
  <script class="no-print">
  (() => {
    const rawDoc = ${safeJson};
    let currentDoc = JSON.parse(JSON.stringify(rawDoc));

    function notifySettings() {
      if (window.location.protocol.startsWith('http')) {
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: document.body.dataset.activeTemplate,
            accent: document.getElementById('select-accent')?.value,
            margin: document.getElementById('select-margin')?.value,
          })
        }).catch(() => {});
      }
    }

    // Template toggle
    document.querySelectorAll('[data-set-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tmpl = btn.dataset.setTemplate;
        document.body.dataset.activeTemplate = tmpl;
        document.querySelectorAll('[data-set-template]').forEach(b => {
          b.classList.toggle('is-active', b === btn);
        });
        notifySettings();
      });
    });

    // Accent select
    const selectAccent = document.getElementById('select-accent');
    if (selectAccent) {
      selectAccent.addEventListener('change', () => {
        const val = selectAccent.value;
        document.querySelectorAll('.resume-page').forEach(page => {
          page.className = page.className.replace(/\\baccent-[a-z0-9-]+\\b/g, '') + ' accent-' + val;
        });
        notifySettings();
      });
    }

    // Margin select
    const selectMargin = document.getElementById('select-margin');
    if (selectMargin) {
      selectMargin.addEventListener('change', () => {
        const val = selectMargin.value;
        document.body.className = document.body.className.replace(/\\bmargin-[a-z0-9-]+\\b/g, '') + ' margin-' + val;
        notifySettings();
      });
    }

    // Save / Download PDF
    const btnPdf = document.getElementById('btn-print-pdf');
    if (btnPdf) {
      btnPdf.addEventListener('click', () => window.print());
    }

    // Save JSON
    const btnJson = document.getElementById('btn-download-json');
    if (btnJson) {
      btnJson.addEventListener('click', () => {
        currentDoc.document = currentDoc.document || {};
        currentDoc.document.template = document.body.dataset.activeTemplate;
        if (selectAccent) currentDoc.document.accent = selectAccent.value;
        if (selectMargin) currentDoc.document.margin = selectMargin.value;
        const blob = new Blob([JSON.stringify(currentDoc, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (currentDoc.document.title || 'resume').replace(/[^a-z0-9_-]/gi, '_').toLowerCase() + '.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Live reload SSE hook
    if (${options.liveReload === true ? 'true' : 'false'} || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      if (window.location.protocol.startsWith('http')) {
        try {
          const es = new EventSource('/events');
          es.onmessage = (ev) => {
            if (ev.data === 'reload') {
              window.location.reload();
            }
          };
        } catch (e) {}
      }
    }
  })();
  </script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(title)}</title>
  <style>
${embeddedCss}
  </style>
</head>
<body data-active-template="${activeTemplate}" class="margin-${marginMode}">
  ${toolbarHtml}
  <div class="resume-screen-shell">
    <div class="template-view" data-template-view="classic">
      ${classicPages}
    </div>
    <div class="template-view" data-template-view="executive">
      ${executivePages}
    </div>
  </div>
  ${controllerScript}
</body>
</html>`;
}

/**
 * Renders a JSON resume file into an HTML output file.
 */
export function renderFile(inputPath, outputPath, options = {}) {
  const fullInput = resolve(process.cwd(), inputPath);
  const rawText = readFileSync(fullInput, 'utf8');

  // Validate prior to rendering
  const validation = validateResumeJson(rawText);
  if (!validation.ok) {
    const errMessages = validation.issues.map((i) => `  • [${i.path}]: ${i.message}`).join('\n');
    throw new Error(`Validation failed for '${inputPath}':\n${errMessages}`);
  }

  const doc = validation.value;
  const template = options.template || doc.document?.template || 'classic';
  const html = renderResumeHtml(doc, { ...options, template });

  let fullOutput = outputPath;
  if (!fullOutput) {
    const ext = extname(inputPath);
    fullOutput = inputPath.replace(new RegExp(`${ext}$`), '.html');
    if (fullOutput === inputPath) fullOutput = `${inputPath}.html`;
  }
  fullOutput = resolve(process.cwd(), fullOutput);

  writeFileSync(fullOutput, html, 'utf8');
  return {
    outputPath: fullOutput,
    template,
    pages: doc.document?.maxPages || 1,
    title: doc.document?.title || 'Resume',
  };
}

// CLI Execution Entry Point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let inputFile = null;
  let outputFile = null;
  let template = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      console.log(`openResume HTML Template Compiler

Usage:
  bun skills/openresume/render.mjs <file.json> [--template classic|executive] [--output resume.html]
  node skills/openresume/render.mjs <file.json> [--template classic|executive] [--output resume.html]

Options:
  --template, -t   Override template (classic, executive)
  --output, -o     Output file destination (defaults to <name>.html)
  -h, --help       Show this help message
`);
      process.exit(0);
    } else if (arg === '--template' || arg === '-t') {
      template = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      outputFile = args[++i];
    } else if (!arg.startsWith('-') && !inputFile) {
      inputFile = arg;
    }
  }

  if (!inputFile) {
    console.error('Error: Missing required input resume JSON file.\nUse --help for usage.');
    process.exit(1);
  }

  if (template && !['classic', 'executive'].includes(template)) {
    console.error(`Error: Unknown template '${template}'. Choose from: classic, executive.`);
    process.exit(1);
  }

  try {
    const res = renderFile(inputFile, outputFile, { template });
    console.log(`✓ Rendered resume to '${basename(res.outputPath)}' (template: ${res.template}, pages: ${res.pages})`);
    console.log(`  Path: ${res.outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`✗ Render error: ${err.message}`);
    process.exit(1);
  }
}
