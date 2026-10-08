# Resume Studio — Printing & PDF Export Guide

Resume Studio generates print-ready, accessible HTML/CSS resumes styled to exact physical A4 portrait specifications. PDF export is user-mediated through the browser's native print dialog (**Print / Save as PDF**).

---

## 1. Required Browser Print Dialog Settings

To ensure exact A4 geometry, selectable text, and clean layout without unintended page breaks:

| Setting | Required Value | Rationale |
| --- | --- | --- |
| **Destination** | **Save as PDF** | Produces a clean, high-resolution selectable PDF vector file. |
| **Paper size** | **A4** (210 × 297 mm) | Canonical document geometry is designed specifically for A4. |
| **Layout** | **Portrait** | All templates are single/two-column vertical A4 portrait. |
| **Margins** | **None** (or 0 / Minimum) | Page styling applies its own exact 14 mm internal padding. |
| **Scale** | **100%** (Default) | Never use "Fit to printable area" or "Scale to fit". |
| **Headers and footers** | **Unchecked** (Disabled) | Suppresses browser-generated page numbers, URLs, and timestamps. |
| **Background graphics** | **Checked** (Enabled) | Ensures subtle accent rules and divider borders are rendered. |

---

## 2. Print Output Guarantees

1. **Selectable and Accessible Text:** Text is rendered using semantic HTML headings, paragraphs, and list items. No text-as-image or canvas rasterization is used.
2. **Hyperlinks Preserved:** Links in profile and projects preserve clickable targets with secure `rel="noopener noreferrer"`.
3. **Zero Trailing Blank Pages:** Strict `@page { size: A4 portrait; margin: 0; }` combined with `.resume-page:last-child { break-after: avoid !important; }` guarantees that a 1-page document produces exactly 1 page and a 2-page document produces exactly 2 pages.
4. **Zero Print Chrome:** Application navigation, local bridge connection indicators, diagnostics panels, and editor panes are strictly hidden in `@media print`.

---

## 3. Template Layouts & ATS Reading Order

### Classic Template
- **Layout:** Conservative single-column.
- **Typography:** System serif (`Georgia, "Times New Roman", Times, serif`).
- **ATS Compatibility:** ATS-first linear reading order. Chronological entries with right-aligned dates.

### Modern Template
- **Layout:** Contemporary single-column.
- **Typography:** System sans-serif (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).
- **ATS Compatibility:** ATS-first linear reading order. High contrast accent headings and compact typographic whitespace.

### Executive Template
- **Layout:**
  - **Page 1:** Full-width identity header at top; two-column body with primary chronological column (120 mm) and compact sidebar (54 mm) containing Skills and Certifications.
  - **Page 2:** Full-width continuation (182 mm) containing remaining primary sections followed by any leftover sidebar entries.
- **ATS & Reading Order Caveat:** Because Skills and Certifications are placed in a spatial sidebar on Page 1, linear text extraction and screen reader reading order (DOM order: Header → Primary Column → Sidebar Column → Page 2 Continuation) may differ from document `sectionOrder`.

---

## 4. Strict Page Limit & Overflow Policy

Resume Studio enforces a strict page budget defined in `document.maxPages` (1 or 2):

- **No Silent Text Shrinking:** Font sizes are never shrunk below approved minimums (body text minimum 10.5 pt; name 24 pt; headings 11.5 pt).
- **No Silent Clipping:** Content is never cut off with `overflow: hidden` or silently dropped.
- **Legal Break Boundaries:** Headings are kept with their first content atom (orphan prevention), and individual bullets are never split across pages. Multi-bullet entries split across pages receive an automatic continuation label (`Employer (Continued)`).
- **Overflow Blocks Print:** If content exceeds the allowed page capacity, the application displays a visible diagnostics banner listing the exact unplaced atoms and JSON paths. In-app print triggers are blocked until the content is trimmed or `maxPages` is adjusted.

---

## 5. Browser Matrix & Print Verification

### 5.1 Verification Status

| Browser / Environment | Automated Status | Manual Print Checklist | Notes |
| :--- | :--- | :--- | :--- |
| **Desktop Chromium (Chrome, Edge)** | **Verified (CI & Tests)** | Passed | Reference platform. Automated headless PDF export verifies exact page counts, zero blank pages, and selectable text. |
| **Desktop Mozilla Firefox** | **Manual Reference** | Documented Checklist | Requires setting Margins to "None" in Firefox Print dialog. Headers/Footers must be set to "--blank--". |
| **Desktop Apple Safari (macOS)** | **Manual Reference** | Documented Checklist | Requires selecting A4 in macOS Page Setup. Uncheck "Print headers and footers". Background graphics enabled. |
| **Mobile Browsers** | **Unverified / Out of Scope** | N/A | Mobile printing engines vary significantly; desktop browsers are the authoritative target. |

### 5.2 Desktop Chromium Reference Results
- **Page counts:** 1-page Classic produces exactly 1 page (210 × 297 mm). 2-page Modern and Executive produce exactly 2 pages.
- **Trailing pages:** Zero blank trailing pages generated. Verified via PDF object stream inspection in Playwright Chromium.
- **Text & links:** 100% vector selectable text. Links retain active clickable targets with `rel="noopener noreferrer"`.
- **Chrome Print Settings:**
  - Destination: Save as PDF
  - Pages: All
  - Layout: Portrait
  - Paper size: A4
  - Margins: None
  - Scale: Default (100%)
  - Options: Background graphics checked, Headers and footers unchecked

### 5.3 Manual Print Checklist for Firefox Desktop
Firefox uses its own layout engine (Gecko) and print dialog:
- [ ] Open resume in Firefox (`http://127.0.0.1:<port>/#local=...` or hosted).
- [ ] Trigger print (`Cmd+P` on macOS, `Ctrl+P` on Windows/Linux).
- [ ] In Destination, choose **Save to PDF**.
- [ ] In Paper size, ensure **A4** is selected.
- [ ] Under **Margins**, select **None**.
- [ ] Under **Options**, uncheck **Print headers and footers**.
- [ ] Under **Options**, check **Print backgrounds**.
- [ ] In the print preview, confirm the exact page count matches the indicator (`1 / 1` or `2 / 2`).
- [ ] Save the PDF and open in a standalone PDF viewer (Preview, Acrobat, or browser tab).
- [ ] Verify text is selectable, contact links are clickable, and section divider rules are visible.

### 5.4 Manual Print Checklist for Safari Desktop (macOS WebKit)
WebKit on macOS delegates page sizing to the macOS native printing system:
- [ ] Open resume in Safari.
- [ ] Open print dialog (`Cmd+P`).
- [ ] If sheet is collapsed, click "Show Details".
- [ ] Set **Paper Size** to **A4** (210 by 297 mm).
- [ ] Set **Orientation** to **Portrait**.
- [ ] Uncheck **Print headers and footers**.
- [ ] Check **Print backgrounds**.
- [ ] In the PDF dropdown menu (bottom left), choose **Save as PDF**.
- [ ] Open saved PDF and confirm geometry, text selection, and absence of trailing blank page.

### 5.5 OS Typography & System Font Variance
Resume Studio intentionally uses native system font stacks to ensure privacy and zero external network calls:
- **macOS / iOS:** `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Georgia`, `Times`
- **Windows:** `"Segoe UI"`, `Calibri`, `Georgia`, `"Times New Roman"`
- **Linux:** `system-ui`, `Roboto`, `"Liberation Sans"`, `Georgia`, `"Liberation Serif"`

Because system fonts possess slight glyph metric differences across operating systems:
- The measured pagination engine runs **live in the browser DOM**, waiting for `document.fonts.ready`.
- It measures actual rendered text wrapping on the host system before packing blocks into pages.
- This guarantees that whether a user runs on macOS, Windows, or Linux, page breaks are calculated based on the actual system typography, preventing unexpected layout overflows during print.
