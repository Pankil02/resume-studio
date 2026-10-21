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

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
function escapeHtml(str) {
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
function sanitizeUrl(urlStr, allowImageData = false) {
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
 * Converts **bold**, *italic*, <small>, and font-size tokens into safe HTML tags
 * while HTML-escaping all other text.
 */
function formatTextWithBold(str) {
  if (!str) return '';
  const escaped = escapeHtml(str);
  return escaped
    .replace(/(\*\*(.+?)\*\*|&lt;b&gt;(.+?)&lt;\/b&gt;|<strong>(.+?)<\/strong>)/g, (_m, _p1, b1, b2, b3) => {
      return `<strong>${b1 || b2 || b3}</strong>`;
    })
    .replace(/(\*(.+?)\*|&lt;i&gt;(.+?)&lt;\/i&gt;|<em>(.+?)<\/em>)/g, (_m, _p1, i1, i2, i3) => {
      return `<em>${i1 || i2 || i3}</em>`;
    })
    .replace(/(&lt;small&gt;(.+?)&lt;\/small&gt;|<small>(.+?)<\/small>)/g, (_m, _p1, s1, s2) => {
      return `<small>${s1 || s2}</small>`;
    })
    .replace(/&lt;span class=&quot;text-lg&quot;&gt;(.+?)&lt;\/span&gt;/g, '<span class="text-lg">$1</span>')
    .replace(/&lt;span class=&quot;text-sm&quot;&gt;(.+?)&lt;\/span&gt;/g, '<span class="text-sm">$1</span>');
}

/**
 * Formats YYYY or YYYY-MM into 'Month Year' or 'Year'.
 */
function formatYearMonth(ym) {
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
function formatDateRange(start, end, current) {
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
function getCompanyMonogram(companyName) {
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
  email: `<svg class="icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>`,
  pin: `<svg class="icon-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
  globe: `<svg class="icon-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><line x1="2" x2="22" y1="12" y2="12"/></svg>`,
  calendar: `<svg class="icon-svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  diamond: `<svg class="icon-svg icon-diamond" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M10 3l-2 6 4 12 4-12-2-6"/></svg>`,
};

/**
 * Returns embedded CSS styles for both Classic and Executive templates,
 * print rules, margin presets, and the interactive preview toolbar.
 */
function getEmbeddedCss(accent = 'slate', marginMode = 'narrow', paperSize = 'a4', activeFont = 'jakarta', activeSize = '11') {
  const isA4 = paperSize !== 'letter';
  const widthMm = isA4 ? '210mm' : '215.9mm';
  const heightMm = isA4 ? '297mm' : '279.4mm';
  const pageFormatKeyword = isA4 ? 'A4 portrait' : 'letter portrait';

  let marginPadding = '10mm';
  if (marginMode === 'normal') marginPadding = '14mm';
  if (marginMode === 'compact') marginPadding = '7mm';

  const validFonts = ['jakarta', 'inter', 'serif', 'times', 'system'];
  const fontKey = validFonts.includes(activeFont) ? activeFont : 'jakarta';

  return `
/* openResume Stylesheet */
:root {
  --page-width: ${widthMm};
  --page-height: ${heightMm};
  --page-padding: ${marginPadding};
  --font-jakarta: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-inter: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-serif: 'EB Garamond', 'Instrument Serif', Georgia, 'Times New Roman', serif;
  --font-times: 'Times New Roman', Times, 'Liberation Serif', serif;
  --font-system: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-current: var(--font-${fontKey});
  --font-sans: var(--font-${fontKey});
  --color-text-main: #000000;
  --color-text-muted: #333333;
  --color-bg-page: #ffffff;
  /* Default Typography Scale: 11pt */
  --text-name-executive: 26pt;
  --text-name-classic: 21pt;
  --text-headline: 11.2pt;
  --text-heading: 11pt;
  --text-title: 11pt;
  --text-subtitle: 10.2pt;
  --text-base: 9.4pt;
  --text-meta: 8.8pt;
  --text-badge: 8pt;
}

/* Font Family Presets */
body[data-active-font="jakarta"], .font-jakarta {
  --font-current: var(--font-jakarta);
  --font-sans: var(--font-jakarta);
  --font-serif: var(--font-jakarta);
}
body[data-active-font="inter"], .font-inter {
  --font-current: var(--font-inter);
  --font-sans: var(--font-inter);
  --font-serif: var(--font-inter);
}
body[data-active-font="serif"], .font-serif {
  --font-current: var(--font-serif);
  --font-sans: var(--font-serif);
  --font-serif: var(--font-serif);
}
body[data-active-font="times"], .font-times {
  --font-current: var(--font-times);
  --font-sans: var(--font-times);
  --font-serif: var(--font-times);
}
body[data-active-font="system"], .font-system {
  --font-current: var(--font-system);
  --font-sans: var(--font-system);
  --font-serif: var(--font-system);
}

/* Text Size Presets */
body[data-active-size="10"], .size-10 {
  --text-name-executive: 23pt;
  --text-name-classic: 18.5pt;
  --text-headline: 10pt;
  --text-heading: 10.2pt;
  --text-title: 10pt;
  --text-subtitle: 9.4pt;
  --text-base: 8.6pt;
  --text-meta: 8pt;
  --text-badge: 7.5pt;
}
body[data-active-size="11"], .size-11 {
  --text-name-executive: 26pt;
  --text-name-classic: 21pt;
  --text-headline: 11.2pt;
  --text-heading: 11pt;
  --text-title: 11pt;
  --text-subtitle: 10.2pt;
  --text-base: 9.4pt;
  --text-meta: 8.8pt;
  --text-badge: 8pt;
}
body[data-active-size="12"], .size-12 {
  --text-name-executive: 28.5pt;
  --text-name-classic: 23.5pt;
  --text-headline: 12.2pt;
  --text-heading: 11.8pt;
  --text-title: 11.8pt;
  --text-subtitle: 11pt;
  --text-base: 10.2pt;
  --text-meta: 9.6pt;
  --text-badge: 8.5pt;
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
  --accent-rule: #000000;
}
.accent-forest {
  --accent-primary: #14452f;
  --accent-secondary: #166534;
  --accent-rule: #000000;
}
.accent-ocean {
  --accent-primary: #0284c7;
  --accent-secondary: #0369a1;
  --accent-rule: #000000;
}
.accent-amber {
  --accent-primary: #b45309;
  --accent-secondary: #92400e;
  --accent-rule: #000000;
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
  [data-editable="true"] {
    outline: none !important;
    background: transparent !important;
  }
  .floating-selection-bubble,
  .toolbar-edit-tools,
  .section-add-btn,
  .entry-delete-btn,
  .bullet-action-group {
    display: none !important;
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
.toolbar-save-badge {
  display: inline-flex;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 3px;
  background: #2b2622;
  color: #bfb9b2;
  border: 1px solid rgba(247, 245, 240, 0.14);
  transition: all 120ms ease;
}
.toolbar-save-badge.is-dirty {
  background: rgba(234, 179, 8, 0.2);
  color: #fef08a;
  border-color: rgba(234, 179, 8, 0.5);
}
.toolbar-save-badge.is-saved {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.5);
}
.toolbar-edit-hint {
  font-size: 11px;
  color: #c9c0ad;
  margin-left: 8px;
  display: none;
  background: rgba(37, 99, 235, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.35);
  padding: 3px 8px;
  border-radius: 3px;
  font-family: var(--font-sans);
}
body.is-editing .toolbar-edit-hint {
  display: inline-block;
}

/* Typography & Sizing Helpers */
small, .text-sm {
  font-size: 0.88em;
}
.text-lg {
  font-size: 1.15em;
}

/* Edit Mode Button & Quick Toolbar */
.toolbar-btn-edit {
  background: rgba(247, 245, 240, 0.08);
  border: 1px solid rgba(247, 245, 240, 0.22);
  color: #f7f5f0;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 3px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 150ms ease;
}
.toolbar-btn-edit:hover {
  background: rgba(247, 245, 240, 0.16);
  border-color: rgba(247, 245, 240, 0.35);
}
.toolbar-btn-edit.is-active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
}
.toolbar-edit-tools {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #2b2622;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid rgba(247, 245, 240, 0.14);
}
.toolbar-tool-btn {
  appearance: none;
  border: 1px solid rgba(247, 245, 240, 0.12);
  background: #383330;
  color: #f7f5f0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 120ms ease;
}
.toolbar-tool-btn:hover {
  background: #3f3a36;
  border-color: rgba(247, 245, 240, 0.25);
}

/* Floating Selection Bubble Toolbar */
.floating-selection-bubble {
  position: absolute;
  z-index: 1000;
  display: none;
  align-items: center;
  background: #2b2622;
  border: 1px solid rgba(247, 245, 240, 0.2);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
  padding: 3px 6px;
  gap: 3px;
  transform: translateX(-50%);
  pointer-events: auto;
  animation: bubbleFadeIn 120ms ease-out;
}
@keyframes bubbleFadeIn {
  from { opacity: 0; transform: translate(-50%, 4px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
.floating-selection-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 5px;
  border-style: solid;
  border-color: #2b2622 transparent transparent transparent;
}
.floating-selection-bubble.is-below::after {
  top: auto;
  bottom: 100%;
  border-color: transparent transparent #2b2622 transparent;
}
.bubble-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: #dad2c1;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 7px;
  border-radius: 2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  transition: background 100ms ease, color 100ms ease;
}
.bubble-btn:hover {
  background: #3f3a36;
  color: #f7f5f0;
}
.bubble-btn:active {
  background: #2563eb;
  color: #ffffff;
}
.bubble-btn-del:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
.bubble-sep {
  width: 1px;
  height: 14px;
  background: rgba(247, 245, 240, 0.15);
  margin: 0 2px;
}

/* Section Add & Entry Delete Buttons */
.section-add-btn {
  display: none;
  appearance: none;
  border: 1px dashed rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.05);
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 8px;
  margin-bottom: 8px;
  width: 100%;
  text-align: center;
  transition: all 120ms ease;
}
body.is-editing .section-add-btn {
  display: block;
}
.section-add-btn:hover {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.12);
}
.entry-delete-btn {
  display: none;
  appearance: none;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
  margin-left: 6px;
}
body.is-editing .atom-entry-heading:hover .entry-delete-btn,
body.is-editing .sidebar-achievement-item:hover .entry-delete-btn,
body.is-editing .sidebar-edu-item:hover .entry-delete-btn,
body.is-editing .sidebar-skill-group:hover .entry-delete-btn,
body.is-editing .atom-skill-group:hover .entry-delete-btn,
body.is-editing .atom-certification:hover .entry-delete-btn {
  display: inline-block;
}
.entry-delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* Live In-Place Editing Styles */
body.is-editing [data-editable="true"] {
  cursor: text;
  outline: 1px dashed rgba(59, 130, 246, 0.45);
  border-radius: 2px;
  transition: outline 100ms ease, background-color 100ms ease;
  min-width: 8px;
}
body.is-editing [data-editable="true"]:hover {
  outline: 1.5px dashed #2563eb;
  background-color: rgba(37, 99, 235, 0.05);
}
body.is-editing [data-editable="true"]:focus {
  outline: 2px solid #2563eb;
  background-color: rgba(37, 99, 235, 0.08);
}
body.is-editing [data-editable="true"]:empty::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  font-style: italic;
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
  font-family: var(--font-current);
  line-height: 1.28;
}

.template-classic .atom-header {
  text-align: center;
  margin-bottom: 5px;
}

.template-classic .profile-name {
  font-family: var(--font-current);
  font-size: var(--text-name-classic);
  font-weight: 700;
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 3px;
  color: #000000;
  text-align: center;
}

.template-classic .profile-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  font-size: var(--text-base);
  line-height: 1.3;
  color: #000000;
  margin-bottom: 4px;
}

.template-classic .meta-item {
  display: inline-flex;
  align-items: center;
}

.template-classic .meta-sep {
  margin: 0 4px;
  color: #000000;
  font-weight: 400;
}

.template-classic .meta-link {
  color: #000000;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.template-classic .atom-section-heading {
  margin-top: 7px;
  margin-bottom: 2px;
}

.template-classic .atom-section-heading:first-of-type {
  margin-top: 3px;
}

.template-classic .section-heading-title {
  font-family: var(--font-current);
  font-size: var(--text-heading);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #000000;
  margin-bottom: 1px;
}

.template-classic .section-heading-rule {
  width: 100%;
  height: 0.8px;
  background-color: #000000;
  margin-top: 1px;
  margin-bottom: 3.5px;
}

.template-classic .summary-body-text {
  font-family: var(--font-current);
  font-size: var(--text-base);
  text-align: justify;
  line-height: 1.3;
  margin-bottom: 4px;
  color: #000000;
}
.template-classic .summary-body-text strong {
  font-weight: 700;
  color: #000000;
}

.template-classic .atom-entry-heading {
  margin-top: 3.5px;
  margin-bottom: 1.5px;
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
  font-size: var(--text-title);
  font-weight: 700;
  color: #000000;
}

.template-classic .entry-sep {
  margin: 0 3px;
  font-weight: 700;
  color: #000000;
}

.template-classic .entry-subtitle {
  font-size: var(--text-subtitle);
  font-weight: 700;
  color: #000000;
}

.template-classic .entry-meta-group {
  text-align: right;
  white-space: nowrap;
  font-size: var(--text-subtitle);
  font-weight: 700;
  color: #000000;
}

.template-classic .entry-subline {
  font-size: var(--text-meta);
  font-style: normal;
  margin-top: 1px;
  margin-bottom: 1.5px;
  color: #000000;
}

.template-classic .entry-bullets-list {
  margin: 1.5px 0 3.5px 0;
  padding-left: 14px;
  list-style-type: disc;
}

.template-classic .entry-bullet {
  font-size: var(--text-base);
  line-height: 1.28;
  margin-bottom: 1.5px;
  text-align: justify;
  color: #000000;
}
.template-classic .entry-bullet strong {
  font-weight: 700;
  color: #000000;
}

.template-classic .atom-skill-group {
  font-size: var(--text-base);
  line-height: 1.3;
  margin-bottom: 1.5px;
  padding-left: 14px;
  text-indent: -14px;
}

.template-classic .bullet-dot {
  font-weight: 700;
  margin-right: 2px;
}

.template-classic .skill-category {
  font-weight: 700;
  color: #000000;
}

.template-classic .atom-education-detail,
.template-classic .atom-certification {
  font-size: var(--text-base);
  line-height: 1.3;
  margin-bottom: 1.5px;
  padding-left: 14px;
}

.template-classic .cert-name {
  font-weight: 700;
}

/* =========================================================================
   2. EXECUTIVE TEMPLATE (Two-Column Modern Layout)
   ========================================================================= */
.template-executive {
  font-family: var(--font-current);
  line-height: 1.3;
  color: #000000;
}

.template-executive .atom-header {
  text-align: left;
  margin-bottom: 8px;
}

.template-executive .profile-name {
  font-family: var(--font-current);
  font-size: var(--text-name-executive);
  font-weight: 800;
  letter-spacing: 0.01em;
  color: #000000;
  line-height: 1.05;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.template-executive .profile-headline {
  font-family: var(--font-current);
  font-size: var(--text-headline);
  font-weight: 600;
  color: var(--accent-primary, #0284c7);
  margin-bottom: 5px;
}

.template-executive .profile-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  font-size: var(--text-meta);
  color: #000000;
  margin-bottom: 3px;
}

.template-executive .meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #000000;
}

.template-executive .meta-item .icon-svg {
  color: var(--accent-primary);
}

.template-executive .meta-link {
  color: #000000;
  text-decoration: none;
}
.template-executive .meta-link:hover {
  text-decoration: underline;
  color: var(--accent-primary);
}

.executive-page-1-body {
  display: flex;
  flex-direction: row;
  gap: 6mm;
  width: 100%;
  box-sizing: border-box;
}

.executive-primary-column {
  flex: 0 0 calc((100% - 6mm) * 0.62);
  width: calc((100% - 6mm) * 0.62);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.executive-sidebar-column {
  flex: 0 0 calc((100% - 6mm) * 0.38);
  width: calc((100% - 6mm) * 0.38);
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
  margin-top: 8px;
  margin-bottom: 3px;
}

.template-executive .atom-section-heading.heading-no-rule {
  margin-top: 5px;
  margin-bottom: 2px;
}

.template-executive .atom-section-heading.heading-no-rule .section-heading-title {
  margin-bottom: 0;
}

.template-executive .section-heading-title {
  font-family: var(--font-current);
  font-size: var(--text-heading);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #000000;
  margin-bottom: 2px;
}

.template-executive .section-heading-rule {
  width: 100%;
  height: 2px;
  background-color: #000000;
  margin-top: 2px;
  margin-bottom: 6px;
}

.template-executive .summary-body-text {
  font-size: var(--text-base);
  line-height: 1.34;
  color: #1e293b;
  margin-bottom: 8px;
}
.template-executive .summary-body-text strong {
  font-weight: 700;
  color: #000000;
}

.template-executive .atom-entry-heading {
  margin-top: 5px;
  margin-bottom: 2px;
}
.template-executive .atom-entry-heading:first-of-type {
  margin-top: 2px;
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
  background-color: #f8fafc;
  border: 1px solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-badge);
  font-weight: 700;
  color: var(--accent-primary);
  margin-top: 1px;
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
  font-size: var(--text-title);
  font-weight: 700;
  color: #000000;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.template-executive .entry-company-name {
  font-size: var(--text-subtitle);
  font-weight: 700;
  color: var(--accent-primary);
  line-height: 1.2;
  margin-top: 1px;
}

.template-executive .entry-date-location-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: var(--text-meta);
  color: #555555;
  margin-top: 2px;
}

.template-executive .entry-date-location-row .icon-svg {
  color: var(--accent-primary);
}

.template-executive .entry-subline {
  font-size: var(--text-meta);
  color: #555555;
  margin-top: 1px;
}

.template-executive .entry-bullets-list {
  margin: 2px 0 6px 0;
  padding-left: 14px;
  list-style-type: disc;
}

.template-executive .entry-bullet {
  font-size: var(--text-base);
  line-height: 1.32;
  color: #1e293b;
  margin-bottom: 2px;
}

.template-executive .entry-bullet:last-child {
  margin-bottom: 0;
}

.template-executive .entry-bullet strong {
  font-weight: 700;
  color: #000000;
}

.template-executive .executive-sidebar-column .atom-section-heading {
  margin-top: 8px;
}

.template-executive .sidebar-skill-group {
  margin-bottom: 6px;
}

.template-executive .sidebar-skill-category {
  font-size: var(--text-subtitle);
  font-weight: 700;
  color: #000000;
  margin-bottom: 3px;
}

.template-executive .sidebar-skill-items {
  font-size: var(--text-base);
  color: #1e293b;
  line-height: 1.35;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 7px;
}

.template-executive .sidebar-skill-inline-item {
  display: inline-flex;
  align-items: baseline;
  white-space: nowrap;
}

.template-executive .sidebar-skill-inline-item .bullet-dot {
  font-size: var(--text-meta);
  margin-right: 3px;
  color: var(--accent-primary);
}

.template-executive .sidebar-skill-list {
  margin: 1px 0 0 0;
  padding-left: 0;
  list-style: none;
}

.template-executive .sidebar-skill-bullet {
  font-size: var(--text-base);
  color: #1e293b;
  line-height: 1.32;
  margin-bottom: 4px;
  display: flex;
  align-items: baseline;
}

.template-executive .sidebar-skill-bullet .bullet-dot {
  color: #000000;
  margin-right: 5px;
  flex-shrink: 0;
  font-size: var(--text-meta);
}

.template-executive .sidebar-skill-bullet strong.skill-label-underlined {
  font-weight: 700;
  color: #000000;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Sidebar Key Achievements */
.template-executive .sidebar-achievement-item {
  margin-bottom: 6px;
}

.template-executive .sidebar-achievement-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-subtitle);
  font-weight: 700;
  color: #000000;
  line-height: 1.25;
}

.template-executive .sidebar-achievement-title-row .icon-diamond {
  color: var(--accent-primary);
  flex-shrink: 0;
  width: 13px;
  height: 13px;
}

.template-executive .sidebar-achievement-text {
  font-size: var(--text-meta);
  color: #334155;
  line-height: 1.32;
  margin-top: 2px;
  padding-left: 19px;
}

/* Sidebar Education & Certifications */
.template-executive .sidebar-edu-item {
  margin-bottom: 6px;
}

.template-executive .sidebar-edu-qual {
  font-weight: 700;
  color: #000000;
  font-size: var(--text-subtitle);
  line-height: 1.25;
}

.template-executive .sidebar-edu-inst {
  color: var(--accent-primary);
  font-weight: 700;
  font-size: var(--text-subtitle);
  line-height: 1.25;
  margin-top: 1px;
}

.template-executive .sidebar-edu-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-meta);
  color: #64748b;
  margin-top: 2px;
}

.template-executive .sidebar-edu-meta .icon-svg {
  color: var(--accent-primary);
}

.template-executive .sidebar-edu-detail {
  font-size: var(--text-meta);
  color: #334155;
  margin-top: 1px;
  line-height: 1.3;
}

.template-executive .sidebar-cert-item {
  margin-bottom: 4px;
}

.template-executive .sidebar-cert-name {
  font-weight: 700;
  color: #000000;
  font-size: var(--text-subtitle);
  line-height: 1.25;
}

.template-executive .sidebar-cert-meta {
  font-size: var(--text-meta);
  color: #64748b;
  margin-top: 1px;
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

  const linkItems = (prefixIcon = '') => links.map((link, i) => {
    const href = sanitizeUrl(link.url);
    const label = escapeHtml(link.label || 'Link');
    return `<a class="meta-item meta-link" href="${href}" target="_blank" rel="noopener noreferrer">${prefixIcon}<span data-editable="true" data-field="link-label" data-link-index="${i}">${label}</span></a>`;
  });

  if (template === 'classic') {
    if (location) metaItems.push(`<span class="meta-item meta-location" data-editable="true" data-field="location" data-placeholder="Location">${location}</span>`);
    if (phone) metaItems.push(`<span class="meta-item meta-phone" data-editable="true" data-field="phone" data-placeholder="Phone">${phone}</span>`);
    if (email) metaItems.push(`<a class="meta-item meta-email meta-link" href="mailto:${email}"><span data-editable="true" data-field="email" data-placeholder="Email">${email}</span></a>`);
    metaItems.push(...linkItems());

    return `
      <header class="atom-header">
        <h1 class="profile-name" data-editable="true" data-field="name" data-placeholder="Candidate Name">${name}</h1>
        ${metaItems.length > 0 ? `<div class="profile-meta-row">${metaItems.join('<span class="meta-sep" aria-hidden="true">|</span>')}</div>` : ''}
      </header>
    `;
  }

  // Executive layout uses SVG icons
  if (phone) {
    metaItems.push(`<span class="meta-item meta-phone">${ICONS.phone}<span data-editable="true" data-field="phone" data-placeholder="Phone">${phone}</span></span>`);
  }
  if (email) {
    metaItems.push(`<a class="meta-item meta-email meta-link" href="mailto:${email}">${ICONS.email}<span data-editable="true" data-field="email" data-placeholder="Email">${email}</span></a>`);
  }
  if (location) {
    metaItems.push(`<span class="meta-item meta-location">${ICONS.pin}<span data-editable="true" data-field="location" data-placeholder="Location">${location}</span></span>`);
  }
  metaItems.push(...linkItems(ICONS.globe));

  return `
    <header class="atom-header">
      <h1 class="profile-name" data-editable="true" data-field="name" data-placeholder="Candidate Name">${name}</h1>
      ${headline ? `<div class="profile-headline" data-editable="true" data-field="headline" data-placeholder="Professional Headline">${headline}</div>` : ''}
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
    else if (sectionId === 'certifications') displayTitle = 'CERTIFICATES';
    else if (sectionId === 'summary') displayTitle = 'SUMMARY';
    else displayTitle = (title || '').toUpperCase();

    const hasRule = sectionId !== 'summary';
    return `
      <div class="atom-section-heading${hasRule ? '' : ' heading-no-rule'}">
        <h2 class="section-heading-title">${escapeHtml(displayTitle)}</h2>
        ${hasRule ? '<div class="section-heading-rule"></div>' : ''}
      </div>
    `;
  } else if (template === 'classic') {
    if (sectionId === 'experience') displayTitle = 'WORK EXPERIENCE';
    else if (sectionId === 'skills') displayTitle = 'TECHNICAL SKILLS';
    else if (sectionId === 'projects') displayTitle = 'PROJECTS';
    else if (sectionId === 'education') displayTitle = 'EDUCATION';
    else if (sectionId === 'certifications') displayTitle = 'CERTIFICATIONS';
    else if (sectionId === 'summary') displayTitle = 'SUMMARY';
    else displayTitle = (title || '').toUpperCase();

    return `
      <div class="atom-section-heading">
        <h2 class="section-heading-title">${escapeHtml(displayTitle)}</h2>
        <div class="section-heading-rule"></div>
      </div>
    `;
  }
}

/**
 * Builds HTML for Experience section.
 */
function renderExperienceSection(experience, template) {
  if (!Array.isArray(experience) || experience.length === 0) return '';
  let out = renderSectionHeading('Experience', 'experience', template);

  for (let index = 0; index < experience.length; index++) {
    const item = experience[index];
    const employer = escapeHtml(item.employer || '');
    const role = escapeHtml(item.role || '');
    const location = escapeHtml(item.location || '');
    const subline = escapeHtml(item.technologies || item.subtitle || '');
    const dateRange = formatDateRange(item.start, item.end, item.current);
    const bullets = Array.isArray(item.bullets) ? item.bullets : [];

    if (template === 'executive') {
      const monogram = getCompanyMonogram(item.employer || '');
      const hasIcon = item.icon && (item.icon.startsWith('data:image/') || item.icon.startsWith('https://') || item.icon.startsWith('http://'));
      const badgeContent = hasIcon
        ? `<img class="company-badge-img" src="${sanitizeUrl(item.icon, true)}" alt="${employer}" />`
        : monogram;

      out += `
        <article class="atom-entry-heading" data-entry-type="experience" data-entry-index="${index}">
          <div class="executive-entry-wrapper">
            <div class="entry-company-badge ${hasIcon ? 'has-icon' : ''}" aria-hidden="true">${badgeContent}</div>
            <div class="executive-entry-text-group">
              <div class="entry-role-title" data-editable="true" data-field="role" data-placeholder="Role">${role}</div>
              <div class="entry-company-name" data-editable="true" data-field="employer" data-placeholder="Company">${employer}</div>
              <div class="entry-date-location-row">
                <span class="entry-date-wrapper">${ICONS.calendar} <span data-editable="true" data-field="dateRange" data-placeholder="Date Range">${escapeHtml(dateRange)}</span></span>
                ${location ? `<span class="entry-loc-wrapper">${ICONS.pin} <span data-editable="true" data-field="location" data-placeholder="Location">${location}</span></span>` : ''}
              </div>
              ${subline ? `<div class="entry-subline" data-editable="true" data-field="technologies" data-placeholder="Technologies">${subline}</div>` : ''}
            </div>
            <button type="button" class="entry-delete-btn no-print" title="Delete this role">🗑️</button>
          </div>
          <ul class="entry-bullets-list" data-entry-type="experience" data-entry-index="${index}">
            ${bullets.map((b) => `<li class="entry-bullet" data-editable="true">${formatTextWithBold(b)}</li>`).join('')}
          </ul>
        </article>
      `;
    } else {
      // Classic
      const displaySubline = subline || (location && !employer.includes(location) ? location : '');
      out += `
        <article class="atom-entry-heading" data-entry-type="experience" data-entry-index="${index}">
          <div class="entry-top-row">
            <div class="entry-title-group">
              <span class="entry-title" data-editable="true" data-field="employer" data-placeholder="Company">${employer}</span>
              <span class="entry-sep">|</span>
              <span class="entry-subtitle" data-editable="true" data-field="role" data-placeholder="Role">${role}</span>
            </div>
            <div class="entry-meta-group">
              <span class="entry-date-text" data-editable="true" data-field="dateRange" data-placeholder="Date Range">${escapeHtml(dateRange)}</span>
              <button type="button" class="entry-delete-btn no-print" title="Delete this role">🗑️</button>
            </div>
          </div>
          ${displaySubline ? `<div class="entry-subline" data-editable="true" data-field="technologies" data-placeholder="Technologies">${displaySubline}</div>` : ''}
          <ul class="entry-bullets-list" data-entry-type="experience" data-entry-index="${index}">
            ${bullets.map((b) => `<li class="entry-bullet" data-editable="true">${formatTextWithBold(b)}</li>`).join('')}
          </ul>
        </article>
      `;
    }
  }

  out += '<button type="button" class="section-add-btn no-print" data-add-section="experience">+ Add Experience Role</button>';
  return out;
}

/**
 * Builds HTML for Education section.
 */
function renderEducationSection(education, template, isSidebar = false) {
  if (!Array.isArray(education) || education.length === 0) return '';
  let out = renderSectionHeading('Education', 'education', template);

  for (let index = 0; index < education.length; index++) {
    const item = education[index];
    const institution = escapeHtml(item.institution || '');
    const qualification = escapeHtml(item.qualification || '');
    const location = escapeHtml(item.location || '');
    const dateRange = formatDateRange(item.start, item.end, false);
    const details = Array.isArray(item.details) ? item.details : [];

    if (isSidebar && template === 'executive') {
      out += `
        <div class="sidebar-edu-item" data-entry-type="education" data-entry-index="${index}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="sidebar-edu-qual" data-editable="true" data-field="qualification" data-placeholder="Degree / Qualification">${qualification}</div>
            <button type="button" class="entry-delete-btn no-print" title="Delete Education">🗑️</button>
          </div>
          <div class="sidebar-edu-inst" data-editable="true" data-field="institution" data-placeholder="Institution">${institution}</div>
          ${location || dateRange ? `
            <div class="sidebar-edu-meta">
              ${location ? `<span>${ICONS.pin} <span data-editable="true" data-field="location">${location}</span></span>` : ''}
              ${dateRange ? `<span data-editable="true" data-field="dateRange">${escapeHtml(dateRange)}</span>` : ''}
            </div>` : ''}
          ${details.map((d) => `<div class="sidebar-edu-detail" data-editable="true">${formatTextWithBold(d)}</div>`).join('')}
        </div>
      `;
    } else {
      // Classic
      const hasSingleGpa = details.length === 1 && (details[0].toLowerCase().includes('gpa') || details[0].length < 25);
      const inlineDetails = hasSingleGpa ? ` [${escapeHtml(details[0])}]` : '';
      const bulletDetails = hasSingleGpa ? [] : details;
      const rightMeta = [location, dateRange].filter(Boolean).map(escapeHtml).join('  ');

      out += `
        <div class="atom-entry-heading" data-entry-type="education" data-entry-index="${index}">
          <div class="entry-top-row">
            <div class="entry-title-group">
              <span class="entry-title" data-editable="true" data-field="institution" data-placeholder="Institution">${institution}</span>
              <span class="entry-sep">|</span>
              <span class="entry-subtitle" data-editable="true" data-field="qualification" data-placeholder="Qualification">${qualification}${inlineDetails}</span>
            </div>
            <div class="entry-meta-group">
              <span class="entry-date-text" data-editable="true" data-field="dateRange">${rightMeta}</span>
              <button type="button" class="entry-delete-btn no-print" title="Delete Education">🗑️</button>
            </div>
          </div>
          ${bulletDetails.map((d) => `<div class="atom-education-detail" data-editable="true"><span class="bullet-dot">•</span> ${formatTextWithBold(d)}</div>`).join('')}
        </div>
      `;
    }
  }

  out += '<button type="button" class="section-add-btn no-print" data-add-section="education">+ Add Education</button>';
  return out;
}

/**
 * Builds HTML for Projects section.
 */
function renderProjectsSection(projects, template, isSidebar = false) {
  if (!Array.isArray(projects) || projects.length === 0) return '';
  let out = renderSectionHeading('Projects', 'projects', template);

  if (isSidebar && template === 'executive') {
    for (let index = 0; index < projects.length; index++) {
      const item = projects[index];
      const name = escapeHtml(item.name || '');
      const bullets = Array.isArray(item.bullets) ? item.bullets : [];
      const role = escapeHtml(item.role || '');

      let textContent = '';
      if (bullets.length > 0) {
        textContent = bullets.map((b) => `<div class="sidebar-achievement-text" data-editable="true">${formatTextWithBold(b)}</div>`).join('');
      } else if (role) {
        textContent = `<div class="sidebar-achievement-text" data-editable="true">${formatTextWithBold(role)}</div>`;
      }

      out += `
        <div class="sidebar-achievement-item" data-entry-type="projects" data-entry-index="${index}">
          <div class="sidebar-achievement-title-row" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:4px;">
              ${ICONS.diamond}
              <span class="sidebar-achievement-title" data-editable="true" data-field="name" data-placeholder="Project Name">${name}</span>
            </div>
            <button type="button" class="entry-delete-btn no-print" title="Delete Project">🗑️</button>
          </div>
          ${textContent}
        </div>
      `;
    }
    out += '<button type="button" class="section-add-btn no-print" data-add-section="projects">+ Add Project</button>';
    return out;
  }

  for (let index = 0; index < projects.length; index++) {
    const item = projects[index];
    const name = escapeHtml(item.name || '');
    const role = escapeHtml(item.role || '');
    const url = item.url ? sanitizeUrl(item.url) : '';
    const cleanUrlText = item.url ? escapeHtml(item.url.replace(/^https?:\/\/(www\.)?/, '')) : '';
    const bullets = Array.isArray(item.bullets) ? item.bullets : [];

    out += `
      <article class="atom-entry-heading" data-entry-type="projects" data-entry-index="${index}">
        <div class="entry-top-row">
          <div class="entry-title-group">
            <span class="entry-title" data-editable="true" data-field="name" data-placeholder="Project Name">${name}</span>
            ${role ? `<span class="entry-sep">|</span><span class="entry-subtitle" data-editable="true" data-field="role" data-placeholder="Role">${role}</span>` : ''}
          </div>
          <div class="entry-meta-group">
            ${url ? `<a class="meta-link" href="${url}" target="_blank" rel="noopener noreferrer"><span data-editable="true" data-field="url">${cleanUrlText || escapeHtml(item.url)}</span></a>` : ''}
            <button type="button" class="entry-delete-btn no-print" title="Delete Project">🗑️</button>
          </div>
        </div>
        <ul class="entry-bullets-list" data-entry-type="projects" data-entry-index="${index}">
          ${bullets.map((b) => `<li class="entry-bullet" data-editable="true">${formatTextWithBold(b)}</li>`).join('')}
        </ul>
      </article>
    `;
  }

  out += '<button type="button" class="section-add-btn no-print" data-add-section="projects">+ Add Project</button>';
  return out;
}

/**
 * Builds HTML for Skills section.
 */
function renderSkillsSection(skills, template, isSidebar = false) {
  if (!Array.isArray(skills) || skills.length === 0) return '';
  let out = renderSectionHeading('Skills', 'skills', template);

  if (isSidebar && template === 'executive') {
    for (let index = 0; index < skills.length; index++) {
      const group = skills[index];
      const cat = escapeHtml(group.category || '');
      const rawItems = Array.isArray(group.items) ? group.items : [];
      const hasLongOrColon = rawItems.some((i) => typeof i === 'string' && (i.includes(':') || i.length > 40));

      let itemsHtml = '';
      if (hasLongOrColon) {
        itemsHtml = `<ul class="sidebar-skill-list" data-entry-type="skills" data-entry-index="${index}">` + rawItems.map((item) => {
          if (typeof item === 'string' && item.includes(':')) {
            const idx = item.indexOf(':');
            const head = item.slice(0, idx);
            const tail = item.slice(idx + 1);
            return `<li class="sidebar-skill-bullet" data-editable="true"><span class="bullet-dot">•</span> <span><strong class="skill-label-underlined">${escapeHtml(head)}:</strong> ${formatTextWithBold(tail)}</span></li>`;
          }
          return `<li class="sidebar-skill-bullet" data-editable="true"><span class="bullet-dot">•</span> <span>${formatTextWithBold(item)}</span></li>`;
        }).join('') + `</ul>`;
      } else {
        itemsHtml = `<div class="sidebar-skill-items" data-editable="true" data-field="items" data-entry-type="skills" data-entry-index="${index}">${rawItems.map((i) => `<span class="sidebar-skill-inline-item"><span class="bullet-dot">•</span> ${escapeHtml(i)}</span>`).join(' ')}</div>`;
      }

      out += `
        <div class="sidebar-skill-group" data-entry-type="skills" data-entry-index="${index}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            ${cat ? `<div class="sidebar-skill-category" data-editable="true" data-field="category" data-placeholder="Category">${cat}</div>` : '<div></div>'}
            <button type="button" class="entry-delete-btn no-print" title="Delete Skill Group">🗑️</button>
          </div>
          ${itemsHtml}
        </div>
      `;
    }
    out += '<button type="button" class="section-add-btn no-print" data-add-section="skills">+ Add Skill Group</button>';
    return out;
  }

  // Classic
  for (let index = 0; index < skills.length; index++) {
    const group = skills[index];
    const cat = escapeHtml(group.category || '');
    const items = (Array.isArray(group.items) ? group.items : []).map(escapeHtml).join(', ');
    out += `
      <div class="atom-skill-group" data-entry-type="skills" data-entry-index="${index}">
        <span class="bullet-dot">• </span><strong class="skill-category" data-editable="true" data-field="category" data-placeholder="Category">${cat}:</strong>
        <span class="skill-items" data-editable="true" data-field="items" data-placeholder="Skills separated by commas">${items}</span>
        <button type="button" class="entry-delete-btn no-print" title="Delete Skill Group">🗑️</button>
      </div>
    `;
  }

  out += '<button type="button" class="section-add-btn no-print" data-add-section="skills">+ Add Skill Group</button>';
  return out;
}

/**
 * Builds HTML for Certifications section.
 */
function renderCertificationsSection(certifications, template, isSidebar = false) {
  if (!Array.isArray(certifications) || certifications.length === 0) return '';
  let out = renderSectionHeading('Certifications', 'certifications', template);

  for (let index = 0; index < certifications.length; index++) {
    const cert = certifications[index];
    const name = escapeHtml(cert.name || '');
    const issuer = escapeHtml(cert.issuer || '');
    const date = cert.date ? formatYearMonth(cert.date) : '';
    const url = cert.url ? sanitizeUrl(cert.url) : '';

    if (isSidebar && template === 'executive') {
      out += `
        <div class="sidebar-cert-item" data-entry-type="certifications" data-entry-index="${index}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="sidebar-cert-name" data-editable="true" data-field="name">${url ? `<a class="meta-link" href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>` : name}</div>
            <button type="button" class="entry-delete-btn no-print" title="Delete Certification">🗑️</button>
          </div>
          ${issuer || date ? `<div class="sidebar-cert-meta" data-editable="true" data-field="meta">${[issuer, date].filter(Boolean).map(escapeHtml).join('  •  ')}</div>` : ''}
        </div>
      `;
    } else {
      out += `
        <div class="atom-certification" data-entry-type="certifications" data-entry-index="${index}">
          <span class="bullet-dot">• </span><strong class="cert-name" data-editable="true" data-field="name">${name}</strong>
          ${issuer ? `<span class="cert-issuer" data-editable="true" data-field="issuer">— ${issuer}</span>` : ''}
          ${date ? `<span class="cert-date" data-editable="true" data-field="date">(${escapeHtml(date)})</span>` : ''}
          ${url ? `<a class="cert-link" href="${url}" target="_blank" rel="noopener noreferrer">Verify</a>` : ''}
          <button type="button" class="entry-delete-btn no-print" title="Delete Certification">🗑️</button>
        </div>
      `;
    }
  }

  out += '<button type="button" class="section-add-btn no-print" data-add-section="certifications">+ Add Certification</button>';
  return out;
}

/**
 * Renders the Summary section.
 */
function renderSummarySection(summary, template) {
  if (!summary || summary.trim().length === 0) return '';
  return `
    ${renderSectionHeading('Summary', 'summary', template)}
    <p class="summary-body-text" data-editable="true" data-field="summary" data-placeholder="Professional Summary...">${formatTextWithBold(summary.trim())}</p>
  `;
}

/**
 * Renders individual pages for the specified template (classic or executive).
 */
function renderTemplatePagesHtml(doc, template, accent = 'slate') {
  const maxPages = doc.document?.maxPages || 1;
  const headerHtml = renderHeader(doc.profile, template);
  const sectionOrder = Array.isArray(doc.sectionOrder)
    ? doc.sectionOrder
    : ['summary', 'experience', 'projects', 'skills', 'education', 'certifications'];

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
    const exp = Array.isArray(doc.experience) ? doc.experience : [];
    let page1Exp = exp;
    let page2Exp = [];
    if (maxPages > 1 && exp.length > 3) {
      page1Exp = exp.slice(0, 3);
      page2Exp = exp.slice(3);
    }

    const primaryHtml = [
      renderedSections.summary,
      renderExperienceSection(page1Exp, template),
    ].filter(Boolean).join('');

    const sidebarHtml = [
      renderSkillsSection(doc.skills, template, true),
      renderProjectsSection(doc.projects, template, true),
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

    if (maxPages > 1) {
      const page2ExpHtml = page2Exp.length > 0 ? renderExperienceSection(page2Exp, template) : '';
      const page2Content = [page2ExpHtml].filter(Boolean).join('');

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
  const activeFont = options.font || doc.document?.font || 'jakarta';
  const activeSize = String(options.size || options.textSize || doc.document?.textSize || '11');
  const accent = doc.document?.accent || 'slate';
  const marginMode = doc.document?.margin || 'narrow';
  const paperSize = doc.document?.paperSize || 'a4';
  const title = doc.document?.title || `${doc.profile?.name || 'Resume'} — openResume`;

  const embeddedCss = getEmbeddedCss(accent, marginMode, paperSize, activeFont, activeSize);

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
      <button type="button" class="toolbar-btn toolbar-btn-edit" id="btn-toggle-edit" title="Toggle Live In-Place Edit Mode (Cmd+E)">✏️ Edit Resume</button>
      <div class="toolbar-edit-tools" id="toolbar-edit-tools" style="display:none;" role="toolbar" aria-label="Quick Formatting">
        <button type="button" class="toolbar-tool-btn" data-format="bold" title="Bold Selection (Cmd+B)"><b>B</b></button>
        <button type="button" class="toolbar-tool-btn" data-format="italic" title="Italic Selection (Cmd+I)"><i>I</i></button>
        <button type="button" class="toolbar-tool-btn" data-format="size-small" title="Decrease Selection Size">A-</button>
        <button type="button" class="toolbar-tool-btn" data-format="size-large" title="Increase Selection Size">A+</button>
        <button type="button" class="toolbar-tool-btn" data-format="add-bullet" title="Add Bullet Below">+ Bullet</button>
      </div>
      <label for="select-font" style="color:#bfb9b2">Font:</label>
      <select id="select-font" class="toolbar-select">
        <option value="jakarta"${activeFont === 'jakarta' ? ' selected' : ''}>Plus Jakarta Sans</option>
        <option value="inter"${activeFont === 'inter' ? ' selected' : ''}>Inter</option>
        <option value="serif"${activeFont === 'serif' ? ' selected' : ''}>EB Garamond Serif</option>
        <option value="times"${activeFont === 'times' ? ' selected' : ''}>Times New Roman</option>
      </select>
      <label for="select-size" style="color:#bfb9b2">Size:</label>
      <select id="select-size" class="toolbar-select">
        <option value="10"${activeSize === '10' ? ' selected' : ''}>10pt (Compact)</option>
        <option value="11"${activeSize === '11' ? ' selected' : ''}>11pt (Default)</option>
        <option value="12"${activeSize === '12' ? ' selected' : ''}>12pt (Large)</option>
      </select>
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
      <span class="toolbar-save-badge" id="save-status">Saved</span>
      <button type="button" class="toolbar-cta" id="btn-save-changes" title="Save edits to resume.json (Cmd+S)">💾 Save Changes</button>
      <button type="button" class="toolbar-secondary" id="btn-download-json">Download JSON</button>
      <button type="button" class="toolbar-cta" id="btn-print-pdf">Save / Download PDF</button>
      <span class="toolbar-edit-hint" id="toolbar-edit-hint">✏️ Edit Mode Active — Click text to edit • Select text to format • Enter: new bullet • Backspace: delete</span>
    </div>
  </header>`;

  const floatingToolbarHtml = `
  <div id="floating-format-bubble" class="floating-selection-bubble no-print" style="display:none;" role="toolbar" aria-label="Text Formatting">
    <button type="button" class="bubble-btn" data-format="bold" title="Bold Selection (Cmd+B)"><b>B</b></button>
    <button type="button" class="bubble-btn" data-format="italic" title="Italic Selection (Cmd+I)"><i>I</i></button>
    <span class="bubble-sep"></span>
    <button type="button" class="bubble-btn" data-format="size-small" title="Smaller font size">A-</button>
    <button type="button" class="bubble-btn" data-format="size-normal" title="Normal font size">A</button>
    <button type="button" class="bubble-btn" data-format="size-large" title="Larger font size">A+</button>
    <span class="bubble-sep"></span>
    <button type="button" class="bubble-btn" data-format="add-bullet" title="Add bullet below">+ Bullet</button>
    <button type="button" class="bubble-btn bubble-btn-del" data-format="delete" title="Delete bullet or selection">🗑️</button>
  </div>`;

  const safeJson = JSON.stringify(doc).replace(/</g, '\\u003c');
  const controllerScript = `
  <script class="no-print">
  (() => {
    const rawDoc = ${safeJson};
    let currentDoc = JSON.parse(JSON.stringify(rawDoc));
    let isEditing = false;
    let isDirty = false;
    let isSelfSaving = false;
    let selfSaveTimer = null;

    const statusBadge = document.getElementById('save-status');
    const btnToggleEdit = document.getElementById('btn-toggle-edit');
    const btnSaveChanges = document.getElementById('btn-save-changes');
    const bubble = document.getElementById('floating-format-bubble');
    const editTools = document.getElementById('toolbar-edit-tools');
    const editHint = document.getElementById('toolbar-edit-hint');

    function setStatus(text, type = 'normal') {
      if (!statusBadge) return;
      statusBadge.textContent = text;
      statusBadge.className = 'toolbar-save-badge' + (type === 'dirty' ? ' is-dirty' : (type === 'saved' ? ' is-saved' : ''));
    }

    function markDirty() {
      isDirty = true;
      setStatus('● Unsaved', 'dirty');
    }

    function hideBubble() {
      if (bubble) bubble.style.display = 'none';
    }

    function updateBubblePosition() {
      if (!isEditing || !bubble) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        hideBubble();
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        hideBubble();
        return;
      }
      const anchor = sel.anchorNode;
      const editable = (anchor?.nodeType === 1 ? anchor : anchor?.parentElement)?.closest('[data-editable="true"]');
      if (!editable) {
        hideBubble();
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        hideBubble();
        return;
      }

      bubble.style.display = 'inline-flex';
      const bubbleWidth = bubble.offsetWidth || 260;
      const bubbleHeight = bubble.offsetHeight || 36;
      let left = rect.left + window.scrollX + (rect.width / 2);
      let top = rect.top + window.scrollY - bubbleHeight - 8;

      const minLeft = (bubbleWidth / 2) + 12;
      const maxLeft = window.innerWidth - (bubbleWidth / 2) - 12;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      if (top < window.scrollY + 10) {
        top = rect.bottom + window.scrollY + 8;
        bubble.classList.add('is-below');
      } else {
        bubble.classList.remove('is-below');
      }

      bubble.style.left = left + 'px';
      bubble.style.top = top + 'px';
    }

    document.addEventListener('selectionchange', () => {
      requestAnimationFrame(updateBubblePosition);
    });
    window.addEventListener('resize', updateBubblePosition);
    window.addEventListener('scroll', updateBubblePosition, { passive: true });

    function toggleEditMode(forceState) {
      isEditing = typeof forceState === 'boolean' ? forceState : !isEditing;
      document.body.classList.toggle('is-editing', isEditing);
      if (btnToggleEdit) {
        btnToggleEdit.classList.toggle('is-active', isEditing);
        btnToggleEdit.textContent = isEditing ? '✓ Editing Mode' : '✏️ Edit Resume';
      }
      if (editTools) {
        editTools.style.display = isEditing ? 'inline-flex' : 'none';
      }
      if (editHint) {
        editHint.style.display = isEditing ? 'inline-block' : 'none';
      }
      document.querySelectorAll('[data-editable="true"]').forEach(el => {
        el.contentEditable = isEditing ? 'true' : 'false';
        el.spellcheck = isEditing;
      });
      if (isEditing) {
        const firstEditable = document.querySelector('.template-view:not([style*="display: none"]) [data-editable="true"]');
        if (firstEditable && !document.activeElement?.matches?.('[data-editable="true"]')) {
          firstEditable.focus();
        }
      } else {
        hideBubble();
      }
    }

    if (btnToggleEdit) {
      btnToggleEdit.addEventListener('click', () => toggleEditMode());
    }

    // Direct click-to-edit activation on any editable text
    document.addEventListener('click', (e) => {
      if (!isEditing) {
        const editable = e.target.closest('[data-editable="true"]');
        if (editable) {
          toggleEditMode(true);
          editable.focus();
        }
      }
    });

    // Formatting functions for selection
    function formatSelectionSize(sizeType) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);

      if (sizeType === 'reset') {
        let node = sel.anchorNode;
        while (node && !node.hasAttribute?.('data-editable')) {
          if (node.nodeName === 'SMALL' || (node.classList && node.classList.contains('text-lg'))) {
            const parent = node.parentNode;
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            parent.removeChild(node);
            markDirty();
            break;
          }
          node = node.parentNode;
        }
        updateBubblePosition();
        return;
      }

      let existingWrapper = null;
      let curr = sel.anchorNode;
      while (curr && !curr.hasAttribute?.('data-editable')) {
        if (sizeType === 'small' && curr.nodeName === 'SMALL') { existingWrapper = curr; break; }
        if (sizeType === 'large' && curr.classList?.contains('text-lg')) { existingWrapper = curr; break; }
        curr = curr.parentNode;
      }

      if (existingWrapper) {
        const parent = existingWrapper.parentNode;
        while (existingWrapper.firstChild) parent.insertBefore(existingWrapper.firstChild, existingWrapper);
        parent.removeChild(existingWrapper);
        markDirty();
        updateBubblePosition();
        return;
      }

      try {
        const wrapper = sizeType === 'small' ? document.createElement('small') : document.createElement('span');
        if (sizeType === 'large') wrapper.className = 'text-lg';
        const fragment = range.extractContents();
        wrapper.appendChild(fragment);
        range.insertNode(wrapper);

        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        sel.addRange(newRange);

        markDirty();
        updateBubblePosition();
      } catch (e) {
        console.error('Failed to format selection size:', e);
      }
    }

    function insertBulletAtCursor() {
      const sel = window.getSelection();
      let bullet = null;
      if (sel && sel.anchorNode) {
        const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
        bullet = node?.closest('.entry-bullet, .sidebar-skill-bullet');
      }
      if (!bullet) {
        const activeView = document.querySelector('.template-view:not([style*="display: none"])');
        bullet = activeView?.querySelector('.entry-bullet');
      }
      if (bullet) {
        const newLi = document.createElement('li');
        newLi.className = bullet.className;
        newLi.setAttribute('data-editable', 'true');
        newLi.contentEditable = 'true';
        newLi.innerHTML = '';
        bullet.after(newLi);
        newLi.focus();
        markDirty();
      }
    }

    function deleteCurrentSelectionOrBullet() {
      const sel = window.getSelection();
      if (!sel) return;
      if (!sel.isCollapsed) {
        document.execCommand('delete', false, null);
        markDirty();
        hideBubble();
        return;
      }
      const node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
      const bullet = node?.closest('.entry-bullet, .sidebar-skill-bullet');
      if (bullet) {
        const prev = bullet.previousElementSibling || bullet.nextElementSibling;
        const parent = bullet.parentElement;
        if (parent && parent.children.length > 1) {
          bullet.remove();
          if (prev) prev.focus();
          markDirty();
          hideBubble();
        }
      }
    }

    function handleFormatAction(action) {
      if (!isEditing) toggleEditMode(true);
      if (action === 'bold') {
        document.execCommand('bold', false, null);
        markDirty();
        updateBubblePosition();
        return;
      }
      if (action === 'italic') {
        document.execCommand('italic', false, null);
        markDirty();
        updateBubblePosition();
        return;
      }
      if (action === 'size-small') {
        formatSelectionSize('small');
        return;
      }
      if (action === 'size-large') {
        formatSelectionSize('large');
        return;
      }
      if (action === 'size-normal') {
        formatSelectionSize('reset');
        return;
      }
      if (action === 'add-bullet') {
        insertBulletAtCursor();
        return;
      }
      if (action === 'delete') {
        deleteCurrentSelectionOrBullet();
        return;
      }
    }

    document.querySelectorAll('[data-format]').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.format;
        handleFormatAction(action);
      });
    });

    // Convert HTML tags (strong, b, em, i, small, span.text-lg) back to markdown / clean tokens
    function htmlToMarkdownBold(html) {
      if (!html) return '';
      const div = document.createElement('div');
      div.innerHTML = html;
      function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          if (tag === 'strong' || tag === 'b') {
            const inner = Array.from(node.childNodes).map(walk).join('').trim();
            return inner ? '**' + inner + '**' : '';
          }
          if (tag === 'em' || tag === 'i') {
            const inner = Array.from(node.childNodes).map(walk).join('').trim();
            return inner ? '*' + inner + '*' : '';
          }
          if (tag === 'small' || node.classList.contains('text-sm')) {
            const inner = Array.from(node.childNodes).map(walk).join('').trim();
            return inner ? '<small>' + inner + '</small>' : '';
          }
          if (node.classList.contains('text-lg') || (node.style && node.style.fontSize && parseFloat(node.style.fontSize) > 13)) {
            const inner = Array.from(node.childNodes).map(walk).join('').trim();
            return inner ? '<span class="text-lg">' + inner + '</span>' : '';
          }
          if (tag === 'br') return '\\n';
          return Array.from(node.childNodes).map(walk).join('');
        }
        return '';
      }
      return Array.from(div.childNodes).map(walk).join('').replace(/[\u00A0\\s]+/g, ' ').trim();
    }

    function parseMonthYearToIso(str) {
      if (!str) return null;
      const cleaned = str.trim();
      if (/^[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(cleaned)) return cleaned;
      if (/^[0-9]{4}$/.test(cleaned)) return cleaned + '-01';
      const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };
      const mMatch = cleaned.match(/([a-z]+)\\s*([0-9]{4})/i) || cleaned.match(/([0-9]{4})\\s*([a-z]+)/i);
      if (mMatch) {
        const word = isNaN(Number(mMatch[1])) ? mMatch[1].toLowerCase() : mMatch[2].toLowerCase();
        const year = isNaN(Number(mMatch[1])) ? mMatch[2] : mMatch[1];
        const monthNum = months[word] || months[word.slice(0, 3)];
        if (monthNum && year) return year + '-' + monthNum;
      }
      return null;
    }

    function parseDateRange(dateStr, originalStart, originalEnd, originalCurrent) {
      if (!dateStr) return { start: originalStart, end: originalEnd, current: originalCurrent };
      const str = dateStr.trim();
      const isCurrent = /present|current|now/i.test(str);
      const parts = str.split(/\\s*(?:–|—|-|to)\\s*/i);
      const parsedStart = parts[0] ? parseMonthYearToIso(parts[0]) : null;
      const parsedEnd = (!isCurrent && parts[1]) ? parseMonthYearToIso(parts[1]) : null;
      return {
        start: parsedStart || originalStart,
        end: isCurrent ? undefined : (parsedEnd || originalEnd),
        current: isCurrent,
      };
    }

    function extractDocFromDom() {
      const activeTemplate = document.body.dataset.activeTemplate || 'classic';
      const activeView = document.querySelector('.template-view[data-template-view="' + activeTemplate + '"]') || document;

      currentDoc.document = currentDoc.document || {};
      currentDoc.document.template = activeTemplate;
      if (document.body.dataset.activeFont) currentDoc.document.font = document.body.dataset.activeFont;
      if (document.body.dataset.activeSize) currentDoc.document.textSize = document.body.dataset.activeSize;
      const selectAccent = document.getElementById('select-accent');
      if (selectAccent) currentDoc.document.accent = selectAccent.value;
      const selectMargin = document.getElementById('select-margin');
      if (selectMargin) currentDoc.document.margin = selectMargin.value;

      currentDoc.profile = currentDoc.profile || {};
      const nameEl = activeView.querySelector('[data-field="name"]');
      if (nameEl) currentDoc.profile.name = nameEl.textContent.trim();

      const headlineEl = activeView.querySelector('[data-field="headline"]');
      if (headlineEl) currentDoc.profile.headline = headlineEl.textContent.trim();

      const locEl = activeView.querySelector('[data-field="location"]');
      if (locEl) currentDoc.profile.location = locEl.textContent.trim();

      const phoneEl = activeView.querySelector('[data-field="phone"]');
      if (phoneEl) currentDoc.profile.phone = phoneEl.textContent.trim();

      const emailEl = activeView.querySelector('[data-field="email"]');
      if (emailEl) currentDoc.profile.email = emailEl.textContent.trim();

      const linkEls = activeView.querySelectorAll('[data-field="link-label"]');
      if (linkEls.length > 0 && Array.isArray(currentDoc.profile.links)) {
        linkEls.forEach(el => {
          const lIdx = Number(el.dataset.linkIndex);
          if (currentDoc.profile.links[lIdx]) {
            currentDoc.profile.links[lIdx].label = el.textContent.trim();
          }
        });
      }

      const sumEl = activeView.querySelector('[data-field="summary"]');
      if (sumEl) currentDoc.summary = htmlToMarkdownBold(sumEl.innerHTML);

      // Experience
      const expEls = Array.from(activeView.querySelectorAll('[data-entry-type="experience"]'));
      if (expEls.length > 0) {
        currentDoc.experience = expEls.map((entry, idx) => {
          const existing = (Array.isArray(rawDoc.experience) && rawDoc.experience[idx]) || {};
          const item = { ...existing };
          const employerEl = entry.querySelector('[data-field="employer"]');
          if (employerEl) item.employer = employerEl.textContent.trim();
          const roleEl = entry.querySelector('[data-field="role"]');
          if (roleEl) item.role = roleEl.textContent.trim();
          const techEl = entry.querySelector('[data-field="technologies"]');
          if (techEl) item.technologies = techEl.textContent.trim();
          const expLocEl = entry.querySelector('[data-field="location"]');
          if (expLocEl) item.location = expLocEl.textContent.trim();
          const dateEl = entry.querySelector('[data-field="dateRange"]');
          if (dateEl) {
            const parsedDates = parseDateRange(dateEl.textContent, item.start, item.end, item.current);
            item.start = parsedDates.start || item.start || '2024-01';
            if (parsedDates.current) {
              item.current = true;
              delete item.end;
            } else {
              delete item.current;
              item.end = parsedDates.end;
            }
          }
          const bulletEls = entry.querySelectorAll('.entry-bullet');
          if (bulletEls.length > 0) {
            item.bullets = Array.from(bulletEls).map(el => htmlToMarkdownBold(el.innerHTML)).filter(Boolean);
          }
          if (!item.bullets || item.bullets.length === 0) {
            item.bullets = ['Key accomplishment or duty'];
          }
          if (!item.id) item.id = 'exp-' + (idx + 1);
          if (!item.employer) item.employer = 'Company Name';
          if (!item.role) item.role = 'Role Title';
          return item;
        });
      }

      // Projects
      const projEls = Array.from(activeView.querySelectorAll('[data-entry-type="projects"]'));
      if (projEls.length > 0) {
        currentDoc.projects = projEls.map((entry, idx) => {
          const existing = (Array.isArray(rawDoc.projects) && rawDoc.projects[idx]) || {};
          const item = { ...existing };
          const nameEl = entry.querySelector('[data-field="name"]');
          if (nameEl) item.name = nameEl.textContent.trim();
          const roleEl = entry.querySelector('[data-field="role"]');
          if (roleEl) item.role = roleEl.textContent.trim();
          const bulletEls = entry.querySelectorAll('.entry-bullet, .sidebar-achievement-text');
          if (bulletEls.length > 0) {
            item.bullets = Array.from(bulletEls).map(el => htmlToMarkdownBold(el.innerHTML)).filter(Boolean);
          }
          if (!item.bullets || item.bullets.length === 0) {
            item.bullets = ['Project description or outcome'];
          }
          if (!item.id) item.id = 'proj-' + (idx + 1);
          if (!item.name) item.name = 'Project Name';
          return item;
        });
      }

      // Skills
      const skillEls = Array.from(activeView.querySelectorAll('[data-entry-type="skills"]'));
      if (skillEls.length > 0) {
        currentDoc.skills = skillEls.map((entry, idx) => {
          const existing = (Array.isArray(rawDoc.skills) && rawDoc.skills[idx]) || {};
          const group = { ...existing };
          const catEl = entry.querySelector('[data-field="category"]');
          if (catEl) group.category = catEl.textContent.replace(/:$/, '').trim();
          const bulletEls = entry.querySelectorAll('.sidebar-skill-bullet');
          if (bulletEls.length > 0) {
            group.items = Array.from(bulletEls).map(el => htmlToMarkdownBold(el.innerHTML.replace(/^[•\\s]+/, ''))).filter(Boolean);
          } else {
            const itemsEl = entry.querySelector('[data-field="items"]');
            if (itemsEl) {
              group.items = itemsEl.textContent.split(',').map(s => s.replace(/^[•\\s]+/, '').trim()).filter(Boolean);
            }
          }
          if (!group.category) group.category = 'Technical Skills';
          if (!group.items || group.items.length === 0) group.items = ['Proficiency'];
          return group;
        });
      }

      // Education
      const eduEls = Array.from(activeView.querySelectorAll('[data-entry-type="education"]'));
      if (eduEls.length > 0) {
        currentDoc.education = eduEls.map((entry, idx) => {
          const existing = (Array.isArray(rawDoc.education) && rawDoc.education[idx]) || {};
          const item = { ...existing };
          const instEl = entry.querySelector('[data-field="institution"]');
          if (instEl) item.institution = instEl.textContent.trim();
          const qualEl = entry.querySelector('[data-field="qualification"]');
          if (qualEl) item.qualification = qualEl.textContent.replace(/\\[.*?\\]/, '').trim();
          const detailEls = entry.querySelectorAll('.sidebar-edu-detail, .atom-education-detail');
          if (detailEls.length > 0) {
            item.details = Array.from(detailEls).map(el => htmlToMarkdownBold(el.innerHTML.replace(/^[•\\s]+/, ''))).filter(Boolean);
          }
          if (!item.id) item.id = 'edu-' + (idx + 1);
          if (!item.institution) item.institution = 'Institution';
          if (!item.qualification) item.qualification = 'Degree';
          return item;
        });
      }

      // Certifications
      const certEls = Array.from(activeView.querySelectorAll('[data-entry-type="certifications"]'));
      if (certEls.length > 0) {
        currentDoc.certifications = certEls.map((entry, idx) => {
          const existing = (Array.isArray(rawDoc.certifications) && rawDoc.certifications[idx]) || {};
          const item = { ...existing };
          const nameEl = entry.querySelector('[data-field="name"]');
          if (nameEl) item.name = nameEl.textContent.trim();
          const issuerEl = entry.querySelector('[data-field="issuer"]');
          if (issuerEl) item.issuer = issuerEl.textContent.replace(/^[—\\s]+/, '').trim();
          if (!item.id) item.id = 'cert-' + (idx + 1);
          if (!item.name) item.name = 'Certification Name';
          if (!item.issuer) item.issuer = 'Issuing Body';
          return item;
        });
      }

      return currentDoc;
    }

    // Dynamic section entry additions
    function addNewExperienceItem() {
      const activeTemplate = document.body.dataset.activeTemplate || 'classic';
      const activeView = document.querySelector('.template-view[data-template-view="' + activeTemplate + '"]') || document;
      const newIdx = activeView.querySelectorAll('[data-entry-type="experience"]').length;
      const article = document.createElement('article');
      article.className = 'atom-entry-heading';
      article.setAttribute('data-entry-type', 'experience');
      article.setAttribute('data-entry-index', String(newIdx));

      if (activeTemplate === 'executive') {
        article.innerHTML = \`
          <div class="executive-entry-wrapper">
            <div class="entry-company-badge" aria-hidden="true">NW</div>
            <div class="executive-entry-text-group">
              <div class="entry-role-title" data-editable="true" data-field="role" data-placeholder="Role" contenteditable="true">Role Title</div>
              <div class="entry-company-name" data-editable="true" data-field="employer" data-placeholder="Company" contenteditable="true">Company Name</div>
              <div class="entry-date-location-row">
                <span class="entry-date-wrapper">${ICONS.calendar} <span data-editable="true" data-field="dateRange" data-placeholder="Date Range" contenteditable="true">2025 – Present</span></span>
                <span class="entry-loc-wrapper">${ICONS.pin} <span data-editable="true" data-field="location" data-placeholder="Location" contenteditable="true">Location</span></span>
              </div>
            </div>
            <button type="button" class="entry-delete-btn no-print" title="Delete this role">🗑️</button>
          </div>
          <ul class="entry-bullets-list" data-entry-type="experience" data-entry-index="\${newIdx}">
            <li class="entry-bullet" data-editable="true" contenteditable="true">New accomplishment or responsibility description.</li>
          </ul>
        \`;
      } else {
        article.innerHTML = \`
          <div class="entry-top-row">
            <div class="entry-title-group">
              <span class="entry-title" data-editable="true" data-field="employer" data-placeholder="Company" contenteditable="true">Company Name</span>
              <span class="entry-sep">|</span>
              <span class="entry-subtitle" data-editable="true" data-field="role" data-placeholder="Role" contenteditable="true">Role Title</span>
            </div>
            <div class="entry-meta-group">
              <span class="entry-date-text" data-editable="true" data-field="dateRange" data-placeholder="Date Range" contenteditable="true">2025 – Present</span>
              <button type="button" class="entry-delete-btn no-print" title="Delete this role">🗑️</button>
            </div>
          </div>
          <ul class="entry-bullets-list" data-entry-type="experience" data-entry-index="\${newIdx}">
            <li class="entry-bullet" data-editable="true" contenteditable="true">New accomplishment or responsibility description.</li>
          </ul>
        \`;
      }

      const addBtn = activeView.querySelector('[data-add-section="experience"]');
      if (addBtn) addBtn.before(article);
      const roleEl = article.querySelector('[data-field="role"]');
      if (roleEl) roleEl.focus();
      markDirty();
    }

    function addNewProjectItem() {
      const activeTemplate = document.body.dataset.activeTemplate || 'classic';
      const activeView = document.querySelector('.template-view[data-template-view="' + activeTemplate + '"]') || document;
      const newIdx = activeView.querySelectorAll('[data-entry-type="projects"]').length;

      if (activeTemplate === 'executive') {
        const div = document.createElement('div');
        div.className = 'sidebar-achievement-item';
        div.setAttribute('data-entry-type', 'projects');
        div.setAttribute('data-entry-index', String(newIdx));
        div.innerHTML = \`
          <div class="sidebar-achievement-title-row" style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:4px;">
              ${ICONS.diamond}
              <span class="sidebar-achievement-title" data-editable="true" data-field="name" data-placeholder="Project Name" contenteditable="true">New Project</span>
            </div>
            <button type="button" class="entry-delete-btn no-print" title="Delete Project">🗑️</button>
          </div>
          <div class="sidebar-achievement-text" data-editable="true" contenteditable="true">Key project achievement and outcome.</div>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="projects"]');
        if (addBtn) addBtn.before(div);
        const nameEl = div.querySelector('[data-field="name"]');
        if (nameEl) nameEl.focus();
      } else {
        const article = document.createElement('article');
        article.className = 'atom-entry-heading';
        article.setAttribute('data-entry-type', 'projects');
        article.setAttribute('data-entry-index', String(newIdx));
        article.innerHTML = \`
          <div class="entry-top-row">
            <div class="entry-title-group">
              <span class="entry-title" data-editable="true" data-field="name" data-placeholder="Project Name" contenteditable="true">New Project</span>
              <span class="entry-sep">|</span>
              <span class="entry-subtitle" data-editable="true" data-field="role" data-placeholder="Role" contenteditable="true">Lead</span>
            </div>
            <div class="entry-meta-group">
              <button type="button" class="entry-delete-btn no-print" title="Delete Project">🗑️</button>
            </div>
          </div>
          <ul class="entry-bullets-list" data-entry-type="projects" data-entry-index="\${newIdx}">
            <li class="entry-bullet" data-editable="true" contenteditable="true">Key project achievement and measurable outcome.</li>
          </ul>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="projects"]');
        if (addBtn) addBtn.before(article);
        const nameEl = article.querySelector('[data-field="name"]');
        if (nameEl) nameEl.focus();
      }
      markDirty();
    }

    function addNewSkillItem() {
      const activeTemplate = document.body.dataset.activeTemplate || 'classic';
      const activeView = document.querySelector('.template-view[data-template-view="' + activeTemplate + '"]') || document;
      const newIdx = activeView.querySelectorAll('[data-entry-type="skills"]').length;

      if (activeTemplate === 'executive') {
        const div = document.createElement('div');
        div.className = 'sidebar-skill-group';
        div.setAttribute('data-entry-type', 'skills');
        div.setAttribute('data-entry-index', String(newIdx));
        div.innerHTML = \`
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="sidebar-skill-category" data-editable="true" data-field="category" data-placeholder="Category" contenteditable="true">Specialty</div>
            <button type="button" class="entry-delete-btn no-print" title="Delete Skill Group">🗑️</button>
          </div>
          <div class="sidebar-skill-items" data-editable="true" data-field="items" data-entry-type="skills" data-entry-index="\${newIdx}" contenteditable="true">Skill One, Skill Two, Skill Three</div>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="skills"]');
        if (addBtn) addBtn.before(div);
        const catEl = div.querySelector('[data-field="category"]');
        if (catEl) catEl.focus();
      } else {
        const div = document.createElement('div');
        div.className = 'atom-skill-group';
        div.setAttribute('data-entry-type', 'skills');
        div.setAttribute('data-entry-index', String(newIdx));
        div.innerHTML = \`
          <span class="bullet-dot">• </span><strong class="skill-category" data-editable="true" data-field="category" data-placeholder="Category" contenteditable="true">Specialty:</strong>
          <span class="skill-items" data-editable="true" data-field="items" data-placeholder="Skills separated by commas" contenteditable="true">Skill One, Skill Two, Skill Three</span>
          <button type="button" class="entry-delete-btn no-print" title="Delete Skill Group">🗑️</button>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="skills"]');
        if (addBtn) addBtn.before(div);
        const catEl = div.querySelector('[data-field="category"]');
        if (catEl) catEl.focus();
      }
      markDirty();
    }

    function addNewEducationItem() {
      const activeTemplate = document.body.dataset.activeTemplate || 'classic';
      const activeView = document.querySelector('.template-view[data-template-view="' + activeTemplate + '"]') || document;
      const newIdx = activeView.querySelectorAll('[data-entry-type="education"]').length;

      if (activeTemplate === 'executive') {
        const div = document.createElement('div');
        div.className = 'sidebar-edu-item';
        div.setAttribute('data-entry-type', 'education');
        div.setAttribute('data-entry-index', String(newIdx));
        div.innerHTML = \`
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="sidebar-edu-qual" data-editable="true" data-field="qualification" data-placeholder="Degree / Qualification" contenteditable="true">Degree / Diploma</div>
            <button type="button" class="entry-delete-btn no-print" title="Delete Education">🗑️</button>
          </div>
          <div class="sidebar-edu-inst" data-editable="true" data-field="institution" data-placeholder="Institution" contenteditable="true">University or College</div>
          <div class="sidebar-edu-meta">
            <span data-editable="true" data-field="dateRange" contenteditable="true">2022 – 2024</span>
          </div>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="education"]');
        if (addBtn) addBtn.before(div);
        const qualEl = div.querySelector('[data-field="qualification"]');
        if (qualEl) qualEl.focus();
      } else {
        const div = document.createElement('div');
        div.className = 'atom-entry-heading';
        div.setAttribute('data-entry-type', 'education');
        div.setAttribute('data-entry-index', String(newIdx));
        div.innerHTML = \`
          <div class="entry-top-row">
            <div class="entry-title-group">
              <span class="entry-title" data-editable="true" data-field="institution" data-placeholder="Institution" contenteditable="true">University or College</span>
              <span class="entry-sep">|</span>
              <span class="entry-subtitle" data-editable="true" data-field="qualification" data-placeholder="Qualification" contenteditable="true">Degree / Diploma</span>
            </div>
            <div class="entry-meta-group">
              <span class="entry-date-text" data-editable="true" data-field="dateRange" contenteditable="true">2022 – 2024</span>
              <button type="button" class="entry-delete-btn no-print" title="Delete Education">🗑️</button>
            </div>
          </div>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="education"]');
        if (addBtn) addBtn.before(div);
        const qualEl = div.querySelector('[data-field="qualification"]');
        if (qualEl) qualEl.focus();
      }
      markDirty();
    }

    function addNewCertItem() {
      const activeTemplate = document.body.dataset.activeTemplate || 'classic';
      const activeView = document.querySelector('.template-view[data-template-view="' + activeTemplate + '"]') || document;
      const newIdx = activeView.querySelectorAll('[data-entry-type="certifications"]').length;

      if (activeTemplate === 'executive') {
        const div = document.createElement('div');
        div.className = 'sidebar-cert-item';
        div.setAttribute('data-entry-type', 'certifications');
        div.setAttribute('data-entry-index', String(newIdx));
        div.innerHTML = \`
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="sidebar-cert-name" data-editable="true" data-field="name" contenteditable="true">Certification Name</div>
            <button type="button" class="entry-delete-btn no-print" title="Delete Certification">🗑️</button>
          </div>
          <div class="sidebar-cert-meta" data-editable="true" data-field="meta" contenteditable="true">Issuing Organization  •  2025</div>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="certifications"]');
        if (addBtn) addBtn.before(div);
        const nameEl = div.querySelector('[data-field="name"]');
        if (nameEl) nameEl.focus();
      } else {
        const div = document.createElement('div');
        div.className = 'atom-certification';
        div.setAttribute('data-entry-type', 'certifications');
        div.setAttribute('data-entry-index', String(newIdx));
        div.innerHTML = \`
          <span class="bullet-dot">• </span><strong class="cert-name" data-editable="true" data-field="name" contenteditable="true">Certification Name</strong>
          <span class="cert-issuer" data-editable="true" data-field="issuer" contenteditable="true">— Issuing Organization</span>
          <button type="button" class="entry-delete-btn no-print" title="Delete Certification">🗑️</button>
        \`;
        const addBtn = activeView.querySelector('[data-add-section="certifications"]');
        if (addBtn) addBtn.before(div);
        const nameEl = div.querySelector('[data-field="name"]');
        if (nameEl) nameEl.focus();
      }
      markDirty();
    }

    document.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.entry-delete-btn');
      if (delBtn) {
        e.preventDefault();
        const entry = delBtn.closest('.atom-entry-heading, .sidebar-achievement-item, .sidebar-edu-item, .sidebar-skill-group, .atom-skill-group, .atom-certification, [data-entry-type]');
        if (entry) {
          entry.remove();
          markDirty();
        }
        return;
      }

      const addBtn = e.target.closest('[data-add-section]');
      if (addBtn) {
        e.preventDefault();
        const sec = addBtn.dataset.addSection;
        if (sec === 'experience') addNewExperienceItem();
        else if (sec === 'projects') addNewProjectItem();
        else if (sec === 'skills') addNewSkillItem();
        else if (sec === 'education') addNewEducationItem();
        else if (sec === 'certifications') addNewCertItem();
        return;
      }
    });

    async function saveChanges() {
      setStatus('Saving...', 'dirty');
      extractDocFromDom();

      isSelfSaving = true;
      clearTimeout(selfSaveTimer);
      selfSaveTimer = setTimeout(() => { isSelfSaving = false; }, 800);

      if (window.location.protocol.startsWith('http')) {
        try {
          const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc: currentDoc })
          });
          const data = await res.json();
          if (data.ok) {
            isDirty = false;
            setStatus('✓ Saved', 'saved');
            setTimeout(() => { if (!isDirty) setStatus('Saved'); }, 2000);
          } else {
            setStatus('✗ Save Error', 'dirty');
            console.error('Save failed:', data.issues || data.error);
            alert('Failed to save resume:\\n' + (data.issues ? data.issues.map(i => i.path + ': ' + i.message).join('\\n') : data.error));
          }
        } catch (err) {
          setStatus('✗ Network Error', 'dirty');
          console.error(err);
        }
      } else {
        const blob = new Blob([JSON.stringify(currentDoc, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (currentDoc.document.title || 'resume').replace(/[^a-z0-9_-]/gi, '_').toLowerCase() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        isDirty = false;
        setStatus('✓ Saved (Downloaded)', 'saved');
        setTimeout(() => { if (!isDirty) setStatus('Saved'); }, 2000);
      }
    }

    if (btnSaveChanges) {
      btnSaveChanges.addEventListener('click', saveChanges);
    }

    document.addEventListener('input', (e) => {
      if (e.target && e.target.closest('[data-editable="true"]')) {
        markDirty();
      }
    });

    document.addEventListener('keydown', (e) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Cmd+E: Toggle edit mode
      if (isMeta && key === 'e') {
        e.preventDefault();
        toggleEditMode();
        return;
      }

      // Cmd+S: Save changes
      if (isMeta && key === 's') {
        e.preventDefault();
        saveChanges();
        return;
      }

      if (e.key === 'Escape') {
        hideBubble();
        return;
      }

      // In edit mode: handle Cmd+B, Cmd+I, Enter, Backspace
      if (isEditing) {
        if (isMeta && key === 'b') {
          e.preventDefault();
          handleFormatAction('bold');
          return;
        }
        if (isMeta && key === 'i') {
          e.preventDefault();
          handleFormatAction('italic');
          return;
        }

        const target = e.target;
        if (target && target.matches && target.matches('[data-editable="true"]')) {
          if (e.key === 'Enter') {
            if (target.classList.contains('entry-bullet')) {
              e.preventDefault();
              const newLi = document.createElement('li');
              newLi.className = 'entry-bullet';
              newLi.setAttribute('data-editable', 'true');
              newLi.contentEditable = 'true';
              newLi.innerHTML = '';
              target.after(newLi);
              newLi.focus();
              markDirty();
              return;
            }
            if (!target.classList.contains('summary-body-text')) {
              e.preventDefault();
              target.blur();
              return;
            }
          }

          if (e.key === 'Backspace' && target.classList.contains('entry-bullet')) {
            if (target.textContent.trim().length === 0) {
              const parent = target.parentElement;
              if (parent && parent.querySelectorAll('.entry-bullet').length > 1) {
                e.preventDefault();
                const prev = target.previousElementSibling;
                target.remove();
                if (prev) {
                  prev.focus();
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(prev);
                  range.collapse(false);
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
                markDirty();
                return;
              }
            }
          }
        }
      }
    });

    function notifySettings() {
      isSelfSaving = true;
      clearTimeout(selfSaveTimer);
      selfSaveTimer = setTimeout(() => { isSelfSaving = false; }, 800);

      if (window.location.protocol.startsWith('http')) {
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: document.body.dataset.activeTemplate,
            font: document.body.dataset.activeFont,
            textSize: document.body.dataset.activeSize,
            accent: document.getElementById('select-accent')?.value,
            margin: document.getElementById('select-margin')?.value,
          })
        }).catch(() => {});
      }
    }

    // Template toggle
    document.querySelectorAll('[data-set-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        extractDocFromDom();
        const tmpl = btn.dataset.setTemplate;
        document.body.dataset.activeTemplate = tmpl;
        document.querySelectorAll('[data-set-template]').forEach(b => {
          b.classList.toggle('is-active', b === btn);
        });
        if (isEditing) {
          toggleEditMode(true);
        }
        notifySettings();
      });
    });

    // Font select
    const selectFont = document.getElementById('select-font');
    if (selectFont) {
      selectFont.addEventListener('change', () => {
        const val = selectFont.value;
        document.body.dataset.activeFont = val;
        document.body.className = document.body.className.replace(/\\bfont-[a-z0-9-]+\\b/g, '').trim() + ' font-' + val;
        notifySettings();
      });
    }

    // Text size select
    const selectSize = document.getElementById('select-size');
    if (selectSize) {
      selectSize.addEventListener('change', () => {
        const val = selectSize.value;
        document.body.dataset.activeSize = val;
        document.body.className = document.body.className.replace(/\\bsize-[a-z0-9-]+\\b/g, '').trim() + ' size-' + val;
        notifySettings();
      });
    }

    // Accent select
    const selectAccent = document.getElementById('select-accent');
    if (selectAccent) {
      selectAccent.addEventListener('change', () => {
        const val = selectAccent.value;
        document.querySelectorAll('.resume-page').forEach(page => {
          page.className = page.className.replace(/\\baccent-[a-z0-9-]+\\b/g, '').trim() + ' accent-' + val;
        });
        notifySettings();
      });
    }

    // Margin select
    const selectMargin = document.getElementById('select-margin');
    if (selectMargin) {
      selectMargin.addEventListener('change', () => {
        const val = selectMargin.value;
        document.body.className = document.body.className.replace(/\\bmargin-[a-z0-9-]+\\b/g, '').trim() + ' margin-' + val;
        notifySettings();
      });
    }

    // Save / Download PDF
    const btnPdf = document.getElementById('btn-print-pdf');
    if (btnPdf) {
      btnPdf.addEventListener('click', () => window.print());
    }

    // Download JSON
    const btnJson = document.getElementById('btn-download-json');
    if (btnJson) {
      btnJson.addEventListener('click', () => {
        extractDocFromDom();
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
            if (ev.data === 'reload' && !isSelfSaving && !isDirty) {
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
${embeddedCss}
  </style>
</head>
<body data-active-template="${activeTemplate}" data-active-font="${activeFont}" data-active-size="${activeSize}" class="margin-${marginMode} font-${activeFont} size-${activeSize}">
  ${toolbarHtml}
  <div class="resume-screen-shell">
    <div class="template-view" data-template-view="classic">
      ${classicPages}
    </div>
    <div class="template-view" data-template-view="executive">
      ${executivePages}
    </div>
  </div>
  ${floatingToolbarHtml}
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

// CLI Execution Entry Point
if (isMain()) {
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
