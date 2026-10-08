import type { ResumeV1, TemplateId } from '../core/generated/resume.js';
import type { Issue } from '../core/validation.js';
import {
  type SemanticAtom,
  createContinuationAtom,
} from './blocks.js';

export interface PageContent {
  pageNumber: number;
  atoms: SemanticAtom[];
  primaryAtoms?: SemanticAtom[];
  sidebarAtoms?: SemanticAtom[];
}

export interface PaginationResult {
  pages: PageContent[];
  overflowAtoms: SemanticAtom[];
  issues: Issue[];
}

export type MeasureAtomsFn = (atoms: SemanticAtom[], widthMm: number) => number;

export interface PaginationOptions {
  resume: ResumeV1;
  atoms: SemanticAtom[];
  pageCapacityPx: number;
  measureFn: MeasureAtomsFn;
  contentWidthMm?: number;
}

export const CONTENT_WIDTH_MM = 182;

/**
 * Asserts content conservation: every source atom must be rendered exactly once
 * across the pages or explicitly accounted for in the overflow list.
 */
export function assertContentConservation(
  allAtoms: SemanticAtom[],
  pages: PageContent[],
  overflowAtoms: SemanticAtom[]
): void {
  const placedIds = new Set<string>();

  for (const page of pages) {
    for (const atom of page.atoms) {
      if (atom.type === 'continuation-label') {
        // Continuation labels are synthetic layout helpers
        continue;
      }
      if (placedIds.has(atom.id)) {
        throw new Error(`Content conservation error: Duplicate atom placed: ${atom.id}`);
      }
      placedIds.add(atom.id);
    }
  }

  const overflowIds = new Set<string>();
  for (const atom of overflowAtoms) {
    if (placedIds.has(atom.id)) {
      throw new Error(`Content conservation error: Atom ${atom.id} placed on both pages and overflow list.`);
    }
    if (overflowIds.has(atom.id)) {
      throw new Error(`Content conservation error: Duplicate atom in overflow: ${atom.id}`);
    }
    overflowIds.add(atom.id);
  }

  for (const atom of allAtoms) {
    if (!placedIds.has(atom.id) && !overflowIds.has(atom.id)) {
      throw new Error(`Content conservation error: Atom ${atom.id} (${atom.sourcePath}) was omitted without overflow record.`);
    }
  }
}

/**
 * Finds the atomic keep-together unit for an atom to prevent orphans and widows.
 * - Section heading must be kept with at least the first entry heading and its first bullet/detail.
 * - Entry heading must be kept with at least its first bullet/detail.
 */
function findKeepTogetherUnit(
  atoms: SemanticAtom[],
  startIndex: number,
  isContinuationOnNewPage: boolean,
  pageNumber: number
): { unit: SemanticAtom[]; continuationAtom?: SemanticAtom } {
  const candidate = atoms[startIndex];
  if (!candidate) {
    return { unit: [] };
  }

  // Case 1: Continuing bullet or detail on a new page requires a continuation label
  if (isContinuationOnNewPage && (candidate.type === 'bullet' || candidate.type === 'education-detail')) {
    const contAtom = createContinuationAtom(candidate, pageNumber);
    return { unit: [contAtom, candidate], continuationAtom: contAtom };
  }

  // Case 2: Section Heading
  if (candidate.type === 'section-heading') {
    const unit: SemanticAtom[] = [candidate];
    const nextIdx = startIndex + 1;
    if (nextIdx < atoms.length) {
      const nextAtom = atoms[nextIdx];
      if (nextAtom && nextAtom.sectionId === candidate.sectionId) {
        unit.push(nextAtom);

        // If next atom is an entry heading, it must also keep its first bullet/detail
        if (nextAtom.type === 'entry-heading') {
          const thirdIdx = startIndex + 2;
          if (thirdIdx < atoms.length) {
            const thirdAtom = atoms[thirdIdx];
            if (
              thirdAtom &&
              thirdAtom.entryId === nextAtom.entryId &&
              (thirdAtom.type === 'bullet' || thirdAtom.type === 'education-detail')
            ) {
              unit.push(thirdAtom);
            }
          }
        }
      }
    }
    return { unit };
  }

  // Case 3: Entry Heading
  if (candidate.type === 'entry-heading' && candidate.keepWithNext) {
    const unit: SemanticAtom[] = [candidate];
    const nextIdx = startIndex + 1;
    if (nextIdx < atoms.length) {
      const nextAtom = atoms[nextIdx];
      if (
        nextAtom &&
        nextAtom.entryId === candidate.entryId &&
        (nextAtom.type === 'bullet' || nextAtom.type === 'education-detail')
      ) {
        unit.push(nextAtom);
      }
    }
    return { unit };
  }

  // Case 4: Standard atom
  return { unit: [candidate] };
}

/**
 * Packs a sequence of atoms into single-column pages using measured geometry and legal break boundaries.
 */
function packSingleColumn(
  atoms: SemanticAtom[],
  allowedPages: number,
  pageCapacityPx: number,
  contentWidthMm: number,
  measureFn: MeasureAtomsFn,
  initialPageNumber = 1
): { pages: PageContent[]; overflowAtoms: SemanticAtom[] } {
  const pages: PageContent[] = [];
  const overflowAtoms: SemanticAtom[] = [];
  let currentPageAtoms: SemanticAtom[] = [];
  let currentPageNumber = initialPageNumber;

  let activeEntryIdOnPage: string | null = null;
  let previousPageEntryId: string | null = null;

  for (let i = 0; i < atoms.length; i++) {
    const candidate = atoms[i];
    if (!candidate) continue;

    // Determine if this atom is continuing an entry started on a previous page
    const isContinuingAcrossPages =
      (candidate.type === 'bullet' || candidate.type === 'education-detail') &&
      candidate.entryId !== undefined &&
      candidate.entryId === previousPageEntryId &&
      activeEntryIdOnPage !== candidate.entryId;

    const { unit, continuationAtom } = findKeepTogetherUnit(
      atoms,
      i,
      isContinuingAcrossPages,
      currentPageNumber
    );

    // Test whether unit fits on current page
    const candidateTestAtoms = [...currentPageAtoms, ...unit];
    const measuredHeight = measureFn(candidateTestAtoms, contentWidthMm);

    // Rounding tolerance of 1px
    if (measuredHeight <= pageCapacityPx + 1) {
      // Unit fits on current page
      if (continuationAtom) {
        currentPageAtoms.push(continuationAtom);
      }
      currentPageAtoms.push(candidate);
      if (candidate.entryId) {
        activeEntryIdOnPage = candidate.entryId;
      }
      continue;
    }

    // Unit does not fit on current page. Check if we can advance to a new page.
    const pagesCompleted = pages.length + (currentPageAtoms.length > 0 ? 1 : 0);

    if (pagesCompleted < allowedPages) {
      // Seal current page if populated
      if (currentPageAtoms.length > 0) {
        pages.push({
          pageNumber: currentPageNumber,
          atoms: [...currentPageAtoms],
        });
        previousPageEntryId = activeEntryIdOnPage;
        currentPageNumber++;
        currentPageAtoms = [];
        activeEntryIdOnPage = null;
      }

      // Check whether this unit needs continuation on the fresh page
      const needsContOnFresh =
        (candidate.type === 'bullet' || candidate.type === 'education-detail') &&
        candidate.entryId !== undefined &&
        candidate.entryId === previousPageEntryId;

      const freshUnitResult = findKeepTogetherUnit(
        atoms,
        i,
        needsContOnFresh,
        currentPageNumber
      );

      const freshHeight = measureFn(freshUnitResult.unit, contentWidthMm);

      if (freshHeight <= pageCapacityPx + 1) {
        if (freshUnitResult.continuationAtom) {
          currentPageAtoms.push(freshUnitResult.continuationAtom);
        }
        currentPageAtoms.push(candidate);
        if (candidate.entryId) {
          activeEntryIdOnPage = candidate.entryId;
        }
      } else {
        // Unit is taller than an entire empty page!
        overflowAtoms.push(...atoms.slice(i));
        break;
      }
    } else {
      // No more pages allowed: seal current page and push all remaining atoms to overflow
      if (currentPageAtoms.length > 0) {
        pages.push({
          pageNumber: currentPageNumber,
          atoms: [...currentPageAtoms],
        });
        currentPageAtoms = [];
      }
      overflowAtoms.push(...atoms.slice(i));
      break;
    }
  }

  if (currentPageAtoms.length > 0) {
    pages.push({
      pageNumber: currentPageNumber,
      atoms: [...currentPageAtoms],
    });
  }

  return { pages, overflowAtoms };
}

export const EXECUTIVE_PRIMARY_WIDTH_MM = 114;
export const EXECUTIVE_SIDEBAR_WIDTH_MM = 66;

/**
 * Packs atoms for the two-column executive template.
 * Page 1 features a full-width header with two columns (primary ~62% and sidebar ~38%).
 * Page 2 provides full-width continuation.
 */
function packExecutive(
  atoms: SemanticAtom[],
  allowedPages: number,
  pageCapacityPx: number,
  measureFn: MeasureAtomsFn,
  contentWidthMm: number
): { pages: PageContent[]; overflowAtoms: SemanticAtom[] } {
  const headerAtom = atoms.find((a) => a.type === 'header');
  if (!headerAtom) {
    throw new Error('Executive layout requires a header atom.');
  }

  const sidebarAtoms = atoms.filter((a) => a.isSidebarCandidate);
  const primaryAtoms = atoms.filter((a) => !a.isSidebarCandidate && a.type !== 'header');

  const primaryWidthMm = Math.round((contentWidthMm - 8) * 0.62);
  const sidebarWidthMm = contentWidthMm - 8 - primaryWidthMm;

  // Measure Page 1 Header across full content width
  const headerHeight = measureFn([headerAtom], contentWidthMm);
  const page1BodyCapacityPx = Math.max(0, pageCapacityPx - headerHeight - 14);

  // 1. Pack Page 1 Sidebar
  const sidebarP1 = packSingleColumn(
    sidebarAtoms,
    1,
    page1BodyCapacityPx,
    sidebarWidthMm,
    measureFn,
    1
  );

  const page1SidebarAtoms = sidebarP1.pages[0]?.atoms || [];
  const leftoverSidebarAtoms = sidebarP1.overflowAtoms;

  // 2. Pack Page 1 Primary
  const primaryP1 = packSingleColumn(
    primaryAtoms,
    1,
    page1BodyCapacityPx,
    primaryWidthMm,
    measureFn,
    1
  );

  const page1PrimaryAtoms = primaryP1.pages[0]?.atoms || [];
  const leftoverPrimaryAtoms = primaryP1.overflowAtoms;

  // Build Page 1
  const pages: PageContent[] = [
    {
      pageNumber: 1,
      atoms: [headerAtom, ...page1PrimaryAtoms, ...page1SidebarAtoms],
      primaryAtoms: page1PrimaryAtoms,
      sidebarAtoms: page1SidebarAtoms,
    },
  ];

  let overflowAtoms: SemanticAtom[] = [];

  if (allowedPages === 1) {
    overflowAtoms = [...leftoverPrimaryAtoms, ...leftoverSidebarAtoms];
    return { pages, overflowAtoms };
  }

  // Page 2 packing (Full width)
  const hasPage2Content = leftoverPrimaryAtoms.length > 0 || leftoverSidebarAtoms.length > 0;

  if (hasPage2Content) {
    const primaryP2 = packSingleColumn(
      leftoverPrimaryAtoms,
      1,
      pageCapacityPx,
      contentWidthMm,
      measureFn,
      2
    );

    const page2PrimaryAtoms = primaryP2.pages[0]?.atoms || [];
    const unplacedPrimaryAtoms = primaryP2.overflowAtoms;

    const page2PrimaryHeight = measureFn(page2PrimaryAtoms, contentWidthMm);
    const page2RemainingHeight = Math.max(0, pageCapacityPx - page2PrimaryHeight - 10);

    let page2SidebarAtoms: SemanticAtom[] = [];
    let unplacedSidebarAtoms: SemanticAtom[] = [];

    if (unplacedPrimaryAtoms.length === 0 && leftoverSidebarAtoms.length > 0 && page2RemainingHeight > 0) {
      const sidebarP2 = packSingleColumn(
        leftoverSidebarAtoms,
        1,
        page2RemainingHeight,
        contentWidthMm,
        measureFn,
        2
      );

      page2SidebarAtoms = sidebarP2.pages[0]?.atoms || [];
      unplacedSidebarAtoms = sidebarP2.overflowAtoms;
    } else {
      unplacedSidebarAtoms = leftoverSidebarAtoms;
    }

    const page2AllAtoms = [...page2PrimaryAtoms, ...page2SidebarAtoms];
    if (page2AllAtoms.length > 0) {
      pages.push({
        pageNumber: 2,
        atoms: page2AllAtoms,
        primaryAtoms: page2PrimaryAtoms,
        sidebarAtoms: page2SidebarAtoms,
      });
    }

    overflowAtoms = [...unplacedPrimaryAtoms, ...unplacedSidebarAtoms];
  }

  return { pages, overflowAtoms };
}

/**
 * Main pagination engine.
 * Takes a resume and atoms, executes measurement-driven packing, asserts content conservation,
 * and generates structured overflow issues with affected JSON paths.
 */
export function paginateResume(options: PaginationOptions): PaginationResult {
  const { resume, atoms, pageCapacityPx, measureFn } = options;
  const templateId = resume.document.template;
  const allowedPages = resume.document.maxPages;

  const widthMm = options.contentWidthMm || CONTENT_WIDTH_MM;
  let result: { pages: PageContent[]; overflowAtoms: SemanticAtom[] };

  if (templateId === 'executive') {
    result = packExecutive(atoms, allowedPages, pageCapacityPx, measureFn, widthMm);
  } else {
    result = packSingleColumn(atoms, allowedPages, pageCapacityPx, widthMm, measureFn, 1);
  }

  // Assert content conservation invariant: every source atom must be accounted for
  assertContentConservation(atoms, result.pages, result.overflowAtoms);

  // Generate structured issues
  const issues: Issue[] = [];

  if (templateId === 'executive') {
    issues.push({
      code: 'EXECUTIVE_SIDEBAR_READING_ORDER',
      severity: 'warning',
      path: 'document.template',
      message:
        'Executive template places secondary sections in a right sidebar; reading and extraction order may differ from linear sectionOrder.',
    });
  }

  if (result.overflowAtoms.length > 0) {
    issues.push({
      code: 'OVERFLOW_PAGE_LIMIT',
      severity: 'error',
      path: 'document.maxPages',
      message: `Document content exceeds the allowed ${allowedPages}-page budget (${result.overflowAtoms.length} unplaced items).`,
    });

    for (const atom of result.overflowAtoms) {
      const label = atom.title || atom.category || atom.text || atom.id;
      const snippet = label.length > 50 ? `${label.slice(0, 47)}...` : label;
      issues.push({
        code: 'OVERFLOW_UNPLACED_CONTENT',
        severity: 'error',
        path: atom.sourcePath,
        message: `Content cannot fit within allowed pages: "${snippet}"`,
      });
    }
  }

  return {
    pages: result.pages,
    overflowAtoms: result.overflowAtoms,
    issues,
  };
}
