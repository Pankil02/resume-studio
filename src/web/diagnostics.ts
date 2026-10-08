import type { Issue } from '../core/validation.js';
import type { LayoutResult } from './render.js';

export function getFieldErrors(issues: Issue[], pathPrefix: string): Issue[] {
  return issues.filter((issue) => issue.path === pathPrefix || issue.path.startsWith(`${pathPrefix}/`));
}

export function renderDiagnostics(
  container: HTMLElement,
  issues: Issue[],
  layoutResult?: LayoutResult | null,
  onFocusField?: (path: string) => void
): void {
  container.innerHTML = '';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Validation and Diagnostics');
  container.setAttribute('aria-live', 'polite');

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const overflow = layoutResult?.overflow ?? false;

  if (errors.length === 0 && warnings.length === 0 && !overflow) {
    const cleanEl = document.createElement('div');
    cleanEl.className = 'diagnostics-clean';
    cleanEl.setAttribute('role', 'status');
    cleanEl.textContent = '✓ Document is valid and fits page budget.';
    container.appendChild(cleanEl);
    return;
  }

  // If overflow
  if (overflow && layoutResult) {
    const overflowCard = document.createElement('div');
    overflowCard.className = 'diagnostic-card diagnostic-error';
    overflowCard.setAttribute('role', 'alert');
    overflowCard.innerHTML = `
      <div class="diagnostic-header">
        <strong>Page Budget Overflow</strong>
        <span class="badge badge-error">${layoutResult.pageCount} / ${layoutResult.allowedPages} Pages</span>
      </div>
      <p class="diagnostic-msg">Content exceeds the allowed ${layoutResult.allowedPages}-page limit. Shorten bullets or remove entries to enable PDF printing.</p>
    `;
    container.appendChild(overflowCard);
  }

  // Render errors
  if (errors.length > 0) {
    const errorGroup = document.createElement('div');
    errorGroup.className = 'diagnostic-group';
    errorGroup.setAttribute('role', 'alert');
    const title = document.createElement('h4');
    title.className = 'diagnostic-group-title text-error';
    title.textContent = `Errors (${errors.length})`;
    errorGroup.appendChild(title);

    for (const err of errors) {
      const item = document.createElement('div');
      item.className = 'diagnostic-item diagnostic-error-item';
      item.textContent = `${err.path}: ${err.message}`;
      if (onFocusField) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => onFocusField(err.path));
      }
      errorGroup.appendChild(item);
    }
    container.appendChild(errorGroup);
  }

  // Render warnings (Collapsible)
  if (warnings.length > 0) {
    const warnDetails = document.createElement('details');
    warnDetails.className = 'diagnostic-group diagnostic-collapsible';
    warnDetails.id = 'diagnostics-warnings-collapsible';

    // Retain user's expanded preference if they explicitly toggled it during this session
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('resume-studio-warnings-open') === 'true') {
        warnDetails.open = true;
      }
    } catch {
      // Storage unavailable
    }

    warnDetails.addEventListener('toggle', () => {
      try {
        sessionStorage.setItem('resume-studio-warnings-open', String(warnDetails.open));
      } catch {
        // Storage quota or restricted
      }
    });

    const summary = document.createElement('summary');
    summary.className = 'diagnostic-group-title text-warning diagnostic-summary';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'diagnostic-summary-title';
    titleSpan.textContent = `Guidance & Editorial Warnings`;

    const countBadge = document.createElement('span');
    countBadge.className = 'badge badge-warning-count';
    countBadge.textContent = `${warnings.length}`;

    summary.appendChild(titleSpan);
    summary.appendChild(countBadge);
    warnDetails.appendChild(summary);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'diagnostic-items-container';

    for (const w of warnings) {
      const item = document.createElement('div');
      item.className = 'diagnostic-item diagnostic-warning-item';
      item.textContent = `${w.path}: ${w.message}`;
      if (onFocusField) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => onFocusField(w.path));
      }
      itemsContainer.appendChild(item);
    }
    warnDetails.appendChild(itemsContainer);
    container.appendChild(warnDetails);
  }
}
