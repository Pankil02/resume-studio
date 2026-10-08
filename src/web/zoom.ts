/**
 * Zoom controller for the A4 sheet preview.
 * Provides zoom in/out, fit-to-width, 100% reset, keyboard shortcuts,
 * mouse wheel zooming, and accessible toolbar state updates.
 */

export interface ZoomController {
  getZoom(): number;
  setZoom(zoom: number, persist?: boolean): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  fitToWidth(): void;
  destroy(): void;
}

export interface ZoomOptions {
  storageKey?: string;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  defaultZoom?: number;
}

export function initZoomController(
  previewPaneId = 'preview-pane',
  previewTargetId = 'resume-preview',
  options: ZoomOptions = {}
): ZoomController {
  const previewPane = document.getElementById(previewPaneId);
  const previewTarget = document.getElementById(previewTargetId);
  const btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement | null;
  const btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement | null;
  const btnZoomLevel = document.getElementById('btn-zoom-level') as HTMLButtonElement | null;
  const btnZoomFit = document.getElementById('btn-zoom-fit') as HTMLButtonElement | null;

  const storageKey = options.storageKey ?? 'resume-studio-preview-zoom';
  const minZoom = options.minZoom ?? 0.4;
  const maxZoom = options.maxZoom ?? 2.0;
  const zoomStep = options.zoomStep ?? 0.1;
  const defaultZoom = options.defaultZoom ?? 1.0;

  let currentZoom = defaultZoom;

  // Restore saved zoom from localStorage if available
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!Number.isNaN(parsed) && parsed >= minZoom && parsed <= maxZoom) {
        currentZoom = parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }

  const applyZoom = (zoom: number, persist = true): void => {
    // Clamp and round to 2 decimal places to avoid floating point imprecision
    currentZoom = Math.min(maxZoom, Math.max(minZoom, Math.round(zoom * 100) / 100));

    if (previewTarget) {
      previewTarget.style.setProperty('--preview-zoom', String(currentZoom));
    }
    if (previewPane) {
      previewPane.style.setProperty('--preview-zoom', String(currentZoom));
    }

    const pctText = `${Math.round(currentZoom * 100)}%`;
    if (btnZoomLevel) {
      btnZoomLevel.textContent = pctText;
      btnZoomLevel.setAttribute('title', `Current zoom: ${pctText} (Click to reset 100%)`);
    }

    if (btnZoomOut) {
      btnZoomOut.disabled = currentZoom <= minZoom;
    }
    if (btnZoomIn) {
      btnZoomIn.disabled = currentZoom >= maxZoom;
    }

    if (persist) {
      try {
        localStorage.setItem(storageKey, String(currentZoom));
      } catch {
        // storage quota / restricted
      }
    }
  };

  const zoomIn = (): void => {
    applyZoom(currentZoom + zoomStep, true);
  };

  const zoomOut = (): void => {
    applyZoom(currentZoom - zoomStep, true);
  };

  const resetZoom = (): void => {
    applyZoom(defaultZoom, true);
  };

  const fitToWidth = (): void => {
    if (!previewPane) return;

    // Available width inside preview pane accounting for side paddings
    const paddingOffset = 48;
    const availableWidth = previewPane.clientWidth - paddingOffset;
    if (availableWidth <= 0) return;

    // Physical A4 width at 96 DPI is 793.7px (~820px including card padding & borders)
    const canonicalA4WidthPx = 820;
    const fitRatio = Math.floor((availableWidth / canonicalA4WidthPx) * 100) / 100;
    const clampedFit = Math.min(1.25, Math.max(minZoom, fitRatio));

    applyZoom(clampedFit, true);
  };

  // Wire UI button listeners
  const onZoomOutClick = (): void => zoomOut();
  const onZoomInClick = (): void => zoomIn();
  const onZoomLevelClick = (): void => {
    if (Math.abs(currentZoom - defaultZoom) > 0.01) {
      resetZoom();
    } else {
      fitToWidth();
    }
  };
  const onZoomFitClick = (): void => fitToWidth();

  btnZoomOut?.addEventListener('click', onZoomOutClick);
  btnZoomIn?.addEventListener('click', onZoomInClick);
  btnZoomLevel?.addEventListener('click', onZoomLevelClick);
  btnZoomFit?.addEventListener('click', onZoomFitClick);

  // Wheel zoom with Ctrl or Meta modifier
  const onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const step = 0.05;
      if (e.deltaY < 0) {
        applyZoom(currentZoom + step, true);
      } else {
        applyZoom(currentZoom - step, true);
      }
    }
  };

  previewPane?.addEventListener('wheel', onWheel, { passive: false });

  // Keyboard shortcut listener
  const onKeyDown = (e: KeyboardEvent): void => {
    const active = document.activeElement;
    const isEditingText =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLElement && active.isContentEditable);

    if (isEditingText) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    }
  };

  // Handle browser native print events to guarantee 100% 1:1 scale during print
  const onBeforePrint = (): void => {
    if (previewTarget) {
      previewTarget.style.setProperty('--preview-zoom', '1');
    }
    if (previewPane) {
      previewPane.style.setProperty('--preview-zoom', '1');
    }
  };

  const onAfterPrint = (): void => {
    applyZoom(currentZoom, false);
  };

  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);

  // Apply initial zoom
  applyZoom(currentZoom, false);

  return {
    getZoom: () => currentZoom,
    setZoom: (z, p) => applyZoom(z, p),
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWidth,
    destroy: () => {
      btnZoomOut?.removeEventListener('click', onZoomOutClick);
      btnZoomIn?.removeEventListener('click', onZoomInClick);
      btnZoomLevel?.removeEventListener('click', onZoomLevelClick);
      btnZoomFit?.removeEventListener('click', onZoomFitClick);
      previewPane?.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    },
  };
}
