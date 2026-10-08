import type { ResumeV1, MarginMode, PaperSize } from '../core/generated/resume.js';
import type { Issue } from '../core/validation.js';
import {
  type SemanticAtom,
  buildSemanticAtoms,
  createAtomElement,
} from './blocks.js';
import {
  paginateResume,
  type PaginationResult,
} from './paginate.js';

export interface LayoutResult {
  pageCount: number;
  allowedPages: 1 | 2;
  overflow: boolean;
  issues: Issue[];
  overflowAtoms: SemanticAtom[];
  generationId: number;
}

export interface RenderOptions {
  onLayoutComplete?: (result: LayoutResult) => void;
}

export interface PaperDimensions {
  widthMm: number;
  heightMm: number;
  name: string;
}

/**
 * Resolves standard physical dimensions for the given paper size.
 * Defaults to international A4 (210 x 297 mm).
 */
export function resolvePaperDimensions(paperSize?: PaperSize): PaperDimensions {
  if (paperSize === 'letter') {
    return { widthMm: 215.9, heightMm: 279.4, name: 'US Letter' };
  }
  return { widthMm: 210, heightMm: 297, name: 'A4' };
}

let currentGenerationId = 0;
let measurementRoot: HTMLElement | null = null;

function getOrCreateMeasurementRoot(): HTMLElement {
  if (!measurementRoot || !document.body.contains(measurementRoot)) {
    let existing = document.getElementById('resume-measurement-root');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'resume-measurement-root';
      existing.style.cssText = `
        position: absolute;
        left: -99999px;
        top: 0;
        width: 215.9mm;
        visibility: hidden;
        pointer-events: none;
        contain: layout style;
      `;
      document.body.appendChild(existing);
    }
    measurementRoot = existing;
  }
  return measurementRoot;
}

/**
 * Resolves the active margin mode for a document.
 * Defaults to 'narrow' (10mm).
 */
export function resolveDocumentMargin(documentConfig: {
  margin?: MarginMode;
  reduceMargin?: boolean;
}): MarginMode {
  if (documentConfig.margin) {
    return documentConfig.margin;
  }
  if (documentConfig.reduceMargin === true) {
    return 'compact';
  }
  return 'narrow';
}

/**
 * Resolves the numeric margin width in millimeters.
 * Supports presets (normal: 14mm, narrow: 10mm, compact/very-narrow: 7mm) and custom mm.
 */
export function resolveDocumentMarginMm(documentConfig: {
  margin?: MarginMode;
  reduceMargin?: boolean;
  customMarginMm?: number;
}): number {
  if (documentConfig.margin === 'custom' && typeof documentConfig.customMarginMm === 'number') {
    return Math.max(4, Math.min(25, Math.round(documentConfig.customMarginMm)));
  }
  const mode = resolveDocumentMargin(documentConfig);
  if (mode === 'normal') return 14;
  if (mode === 'compact' || mode === 'very-narrow') return 7;
  return 10;
}

/**
 * Measures an array of atoms when rendered in a column of width widthMm inside the browser DOM.
 */
function measureAtomsInDOM(
  atoms: SemanticAtom[],
  widthMm: number,
  template: ResumeV1['document']['template'],
  accent: ResumeV1['document']['accent'],
  margin: MarginMode = 'narrow',
  marginMm: number = 10,
  paper: PaperDimensions = { widthMm: 210, heightMm: 297, name: 'A4' }
): number {
  if (atoms.length === 0) return 0;
  const root = getOrCreateMeasurementRoot();

  const contentHeightMm = paper.heightMm - 2 * marginMm;
  const container = document.createElement('div');
  container.className = `resume-page template-${template} accent-${accent} margin-${margin}${marginMm < 14 ? ' margin-reduced' : ''}${marginMm <= 7 ? ' margin-compact' : ''}`;
  container.style.width = `${widthMm}mm`;
  container.style.height = 'auto';
  container.style.minHeight = '0';
  container.style.maxHeight = 'none';
  container.style.overflow = 'visible';
  container.style.setProperty('--page-width', `${paper.widthMm}mm`);
  container.style.setProperty('--page-height', `${paper.heightMm}mm`);
  container.style.setProperty('--page-padding', `${marginMm}mm`);
  container.style.setProperty('--content-width', `${widthMm}mm`);
  container.style.setProperty('--content-height', `${contentHeightMm}mm`);
  container.style.padding = '0';
  container.style.boxSizing = 'border-box';

  const content = document.createElement('div');
  content.className = 'resume-page-content';
  content.style.maxHeight = 'none';
  content.style.height = 'auto';
  content.style.overflow = 'visible';

  for (const atom of atoms) {
    content.appendChild(createAtomElement(atom, template));
  }

  container.appendChild(content);
  root.appendChild(container);

  const height = content.getBoundingClientRect().height;
  root.removeChild(container);

  return height;
}

/**
 * Measures the true pixel capacity of a resume page inner content box in the active browser context.
 */
function measurePageCapacityPx(
  margin: MarginMode = 'narrow',
  marginMm: number = 10,
  paper: PaperDimensions = { widthMm: 210, heightMm: 297, name: 'A4' }
): number {
  const root = getOrCreateMeasurementRoot();

  const contentHeightMm = paper.heightMm - 2 * marginMm;
  const testPage = document.createElement('div');
  testPage.className = `resume-page margin-${margin}${marginMm < 14 ? ' margin-reduced' : ''}${marginMm <= 7 ? ' margin-compact' : ''}`;
  testPage.style.width = `${paper.widthMm}mm`;
  testPage.style.height = `${paper.heightMm}mm`;
  testPage.style.setProperty('--page-width', `${paper.widthMm}mm`);
  testPage.style.setProperty('--page-height', `${paper.heightMm}mm`);
  testPage.style.setProperty('--page-padding', `${marginMm}mm`);
  testPage.style.setProperty('--content-height', `${contentHeightMm}mm`);
  const testContent = document.createElement('div');
  testContent.className = 'resume-page-content';
  testPage.appendChild(testContent);
  root.appendChild(testPage);

  const rect = testContent.getBoundingClientRect();
  root.removeChild(testPage);

  const fallbackHeight = (contentHeightMm / 25.4) * 96;
  return rect.height > 100 ? rect.height : fallbackHeight;
}

/**
 * Dynamically updates the @page size in a dedicated <style> element to ensure
 * browser print dialogs accurately target A4 or US Letter.
 */
export function updatePrintPageSize(paperSize: PaperSize = 'a4'): void {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById('resume-dynamic-page-size') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'resume-dynamic-page-size';
    document.head.appendChild(styleEl);
  }
  const isLetter = paperSize === 'letter';
  const sizeKeyword = isLetter ? 'letter portrait' : 'A4 portrait';
  const widthMm = isLetter ? '215.9mm' : '210mm';
  const heightMm = isLetter ? '279.4mm' : '297mm';
  styleEl.textContent = `
    @page {
      size: ${sizeKeyword};
      margin: 0;
    }
    @media print {
      .resume-pages-container {
        width: ${widthMm} !important;
      }
      .resume-page {
        width: ${widthMm} !important;
        height: ${heightMm} !important;
        min-height: ${heightMm} !important;
        max-height: ${heightMm} !important;
      }
    }
  `;
}

/**
 * Renders a ResumeV1 document with measured pagination, professional typography,
 * and strict overflow diagnostics into a target HTMLElement.
 */
export async function renderResume(
  resume: ResumeV1,
  target: HTMLElement,
  options?: RenderOptions
): Promise<LayoutResult> {
  const generationId = ++currentGenerationId;

  // Wait for document fonts to settle to ensure accurate text metric measurements
  if (typeof document !== 'undefined' && 'fonts' in document && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Guard against race conditions from rapid concurrent edits
  if (generationId !== currentGenerationId) {
    return {
      pageCount: 0,
      allowedPages: resume.document.maxPages,
      overflow: false,
      issues: [],
      overflowAtoms: [],
      generationId,
    };
  }

  const template = resume.document.template;
  const accent = resume.document.accent;
  const margin = resolveDocumentMargin(resume.document);
  const marginMm = resolveDocumentMarginMm(resume.document);
  const paper = resolvePaperDimensions(resume.document.paperSize);
  const pageCapacityPx = measurePageCapacityPx(margin, marginMm, paper);
  const contentWidthMm = paper.widthMm - 2 * marginMm;
  const contentHeightMm = paper.heightMm - 2 * marginMm;

  // Ensure browser print media accurately targets active paper format
  updatePrintPageSize(resume.document.paperSize);

  // 1. Build semantic atoms
  const atoms = buildSemanticAtoms(resume);

  // 2. Run measured pagination engine
  const paginationResult: PaginationResult = paginateResume({
    resume,
    atoms,
    pageCapacityPx,
    contentWidthMm,
    measureFn: (candidateAtoms, widthMm) =>
      measureAtomsInDOM(candidateAtoms, widthMm, template, accent, margin, marginMm, paper),
  });

  // Guard again before DOM commit
  if (generationId !== currentGenerationId) {
    return {
      pageCount: paginationResult.pages.length,
      allowedPages: resume.document.maxPages,
      overflow: paginationResult.overflowAtoms.length > 0,
      issues: paginationResult.issues,
      overflowAtoms: paginationResult.overflowAtoms,
      generationId,
    };
  }

  // 3. Clear target and render pages DOM
  target.innerHTML = '';

  // Render overflow diagnostics banner if content exceeds budget
  if (paginationResult.overflowAtoms.length > 0) {
    const banner = document.createElement('div');
    banner.className = 'resume-overflow-banner no-print';
    banner.setAttribute('role', 'alert');

    const header = document.createElement('div');
    header.className = 'overflow-banner-header';
    header.textContent = `Page Limit Exceeded: ${paginationResult.overflowAtoms.length} item(s) could not fit within the allowed ${resume.document.maxPages}-page limit. Print / Save PDF is disabled until content is trimmed or pages are increased.`;
    banner.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'overflow-banner-list';

    for (const atom of paginationResult.overflowAtoms) {
      const li = document.createElement('li');
      const pathSpan = document.createElement('span');
      pathSpan.className = 'overflow-item-path';
      pathSpan.textContent = atom.sourcePath;
      li.appendChild(pathSpan);

      const label = atom.title || atom.category || atom.text || atom.id;
      const textNode = document.createTextNode(label.length > 60 ? `${label.slice(0, 57)}...` : label);
      li.appendChild(textNode);
      list.appendChild(li);
    }

    banner.appendChild(list);
    target.appendChild(banner);
  }

  const pagesContainer = document.createElement('div');
  pagesContainer.className = 'resume-pages-container';
  pagesContainer.style.setProperty('--page-width', `${paper.widthMm}mm`);

  const totalPages = paginationResult.pages.length;

  for (const page of paginationResult.pages) {
    const pageEl = document.createElement('div');
    pageEl.className = `resume-page template-${template} accent-${accent} margin-${margin} paper-${resume.document.paperSize || 'a4'}${marginMm < 14 ? ' margin-reduced' : ''}${marginMm <= 7 ? ' margin-compact' : ''}`;
    pageEl.style.width = `${paper.widthMm}mm`;
    pageEl.style.height = `${paper.heightMm}mm`;
    pageEl.style.minHeight = `${paper.heightMm}mm`;
    pageEl.style.maxHeight = `${paper.heightMm}mm`;
    pageEl.style.setProperty('--page-width', `${paper.widthMm}mm`);
    pageEl.style.setProperty('--page-height', `${paper.heightMm}mm`);
    pageEl.style.setProperty('--page-padding', `${marginMm}mm`);
    pageEl.style.setProperty('--content-width', `${contentWidthMm}mm`);
    pageEl.style.setProperty('--content-height', `${contentHeightMm}mm`);
    pageEl.style.padding = `${marginMm}mm`;
    pageEl.setAttribute('data-page-number', String(page.pageNumber));
    pageEl.setAttribute('data-total-pages', String(totalPages));

    const contentEl = document.createElement('div');
    contentEl.className = 'resume-page-content';

    if (template === 'executive' && page.pageNumber === 1 && page.primaryAtoms && page.sidebarAtoms) {
      const headerAtom = page.atoms.find((a) => a.type === 'header');
      if (headerAtom) {
        contentEl.appendChild(createAtomElement(headerAtom, template));
      }

      const bodyEl = document.createElement('div');
      bodyEl.className = 'executive-page-1-body';

      const primaryCol = document.createElement('div');
      primaryCol.className = 'executive-primary-column';
      for (const atom of page.primaryAtoms) {
        primaryCol.appendChild(createAtomElement(atom, template));
      }
      bodyEl.appendChild(primaryCol);

      const sidebarCol = document.createElement('aside');
      sidebarCol.className = 'executive-sidebar-column';
      for (const atom of page.sidebarAtoms) {
        sidebarCol.appendChild(createAtomElement(atom, template));
      }
      bodyEl.appendChild(sidebarCol);

      contentEl.appendChild(bodyEl);
    } else if (template === 'executive' && page.pageNumber === 2) {
      const contEl = document.createElement('div');
      contEl.className = 'executive-continuation';
      for (const atom of page.atoms) {
        contEl.appendChild(createAtomElement(atom, template));
      }
      contentEl.appendChild(contEl);
    } else {
      for (const atom of page.atoms) {
        contentEl.appendChild(createAtomElement(atom, template));
      }
    }

    pageEl.appendChild(contentEl);
    pagesContainer.appendChild(pageEl);
  }

  target.appendChild(pagesContainer);

  const result: LayoutResult = {
    pageCount: paginationResult.pages.length,
    allowedPages: resume.document.maxPages,
    overflow: paginationResult.overflowAtoms.length > 0,
    issues: paginationResult.issues,
    overflowAtoms: paginationResult.overflowAtoms,
    generationId,
  };

  if (options?.onLayoutComplete) {
    options.onLayoutComplete(result);
  }

  return result;
}

/**
 * Triggers the browser print dialog only if layout is valid and not overflowing.
 * Returns true if print dialog was invoked, false if blocked by overflow.
 */
export function triggerPrint(layoutResult: LayoutResult): boolean {
  if (layoutResult.overflow) {
    return false;
  }
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
    return true;
  }
  return false;
}
