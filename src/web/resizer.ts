/**
 * Draggable Splitter for two-pane layout.
 * Provides smooth pointer dragging, persistence in localStorage,
 * keyboard accessibility, and minimum/maximum boundary protection.
 */

export interface PaneResizerOptions {
  storageKey?: string;
  minEditorWidth?: number;
  minPreviewWidth?: number;
  defaultRatio?: number;
}

export function initPaneResizer(
  appBodyId = 'app-body',
  editorPaneId = 'editor-pane',
  resizerId = 'pane-resizer',
  options: PaneResizerOptions = {}
): () => void {
  const appBody = document.getElementById(appBodyId);
  const editorPane = document.getElementById(editorPaneId);
  const resizer = document.getElementById(resizerId);

  if (!appBody || !editorPane || !resizer) {
    return () => {};
  }

  const storageKey = options.storageKey ?? 'resume-studio-editor-width';
  const minEditorWidth = options.minEditorWidth ?? 340;
  const minPreviewWidth = options.minPreviewWidth ?? 340;

  // Restore saved width from localStorage if valid
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseFloat(saved);
      const containerWidth = appBody.getBoundingClientRect().width;
      if (!Number.isNaN(parsed) && parsed >= minEditorWidth && containerWidth > 0 && parsed <= containerWidth - minPreviewWidth) {
        appBody.style.setProperty('--editor-width', `${parsed}px`);
        resizer.setAttribute('aria-valuenow', String(Math.round((parsed / containerWidth) * 100)));
      }
    }
  } catch {
    // localStorage restricted or disabled
  }

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  const clampWidth = (targetWidth: number, containerWidth: number): number => {
    const maxEditorWidth = Math.max(minEditorWidth, containerWidth - minPreviewWidth);
    return Math.round(Math.min(maxEditorWidth, Math.max(minEditorWidth, targetWidth)));
  };

  const applyWidth = (newWidth: number, persist = true): void => {
    const containerWidth = appBody.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    const clamped = clampWidth(newWidth, containerWidth);
    appBody.style.setProperty('--editor-width', `${clamped}px`);
    resizer.setAttribute('aria-valuenow', String(Math.round((clamped / containerWidth) * 100)));

    if (persist) {
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        // storage quota or disabled
      }
    }
  };

  const resetToDefault = (): void => {
    appBody.style.removeProperty('--editor-width');
    resizer.setAttribute('aria-valuenow', '48');
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // storage unavailable
    }
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // Only primary mouse button

    isDragging = true;
    startX = e.clientX;
    startWidth = editorPane.getBoundingClientRect().width;

    try {
      resizer.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture fallback
    }

    document.body.classList.add('is-resizing');
    resizer.classList.add('is-active');
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    applyWidth(startWidth + deltaX, false);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!isDragging) return;

    isDragging = false;
    document.body.classList.remove('is-resizing');
    resizer.classList.remove('is-active');

    try {
      if (resizer.hasPointerCapture(e.pointerId)) {
        resizer.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    const currentWidth = editorPane.getBoundingClientRect().width;
    applyWidth(currentWidth, true);
  };

  const onDblClick = (): void => {
    resetToDefault();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const containerWidth = appBody.getBoundingClientRect().width;
    const currentWidth = editorPane.getBoundingClientRect().width;
    const step = e.shiftKey ? 50 : 20;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      applyWidth(currentWidth - step, true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      applyWidth(currentWidth + step, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      applyWidth(minEditorWidth, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      applyWidth(containerWidth - minPreviewWidth, true);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      resetToDefault();
    }
  };

  resizer.addEventListener('pointerdown', onPointerDown);
  resizer.addEventListener('pointermove', onPointerMove);
  resizer.addEventListener('pointerup', onPointerUp);
  resizer.addEventListener('pointercancel', onPointerUp);
  resizer.addEventListener('dblclick', onDblClick);
  resizer.addEventListener('keydown', onKeyDown);

  return () => {
    resizer.removeEventListener('pointerdown', onPointerDown);
    resizer.removeEventListener('pointermove', onPointerMove);
    resizer.removeEventListener('pointerup', onPointerUp);
    resizer.removeEventListener('pointercancel', onPointerUp);
    resizer.removeEventListener('dblclick', onDblClick);
    resizer.removeEventListener('keydown', onKeyDown);
    document.body.classList.remove('is-resizing');
  };
}
