import type { LayoutResult } from './render.js';
import type { Validation } from '../core/validation.js';

export interface PrintEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * Checks whether the current document and layout state are eligible for printing / saving as PDF.
 */
export function checkPrintEligibility(
  validation: Validation,
  layoutResult?: LayoutResult | null
): PrintEligibility {
  if (!validation.ok) {
    return {
      eligible: false,
      reason: 'The resume contains structural or validation errors. Fix the errors before printing.',
    };
  }

  if (!layoutResult) {
    return {
      eligible: false,
      reason: 'Layout rendering has not settled yet. Please wait a moment.',
    };
  }

  if (layoutResult.overflow) {
    return {
      eligible: false,
      reason: `The content overflows the document limit (${layoutResult.pageCount} page(s) rendered vs ${layoutResult.allowedPages} allowed). Reduce content before printing.`,
    };
  }

  return { eligible: true };
}

/**
 * Executes the native browser print action.
 * Returns true if window.print was called, false if ineligible.
 */
export function executePrint(
  validation: Validation,
  layoutResult?: LayoutResult | null
): boolean {
  const eligibility = checkPrintEligibility(validation, layoutResult);
  if (!eligibility.eligible) {
    return false;
  }

  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
    return true;
  }

  return false;
}
