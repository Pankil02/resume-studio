/**
 * AI Prompt & JSON Import Modal for Resume Studio.
 * Generates tailor-made structured prompts for LLMs (ChatGPT, Claude, Gemini, DeepSeek)
 * and provides direct copy-to-clipboard along with instant JSON paste import.
 */

import type { EditorStore } from './state.js';
import type { EditorView } from './editor.js';
import { buildAiResumePrompt } from '../core/prompt.js';
import { importDocumentFromText } from './files.js';
import type { MaxPages, TemplateId } from '../core/generated/resume.js';

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function openAiPromptModal(
  store: EditorStore,
  editorView: EditorView,
  onConfirmUnsaved?: (message: string) => Promise<boolean>
): () => void {
  const container = document.getElementById('modals-container');
  if (!container) return () => {};

  const previousActiveElement = document.activeElement as HTMLElement | null;
  const currentDoc = store.getState().document;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog modal-lg';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const titleId = 'modal-title-ai-prompt';
  dialog.setAttribute('aria-labelledby', titleId);

  // Modal Header
  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.alignItems = 'center';
  titleWrap.style.gap = '0.5rem';

  const titleIcon = document.createElement('span');
  titleIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`;
  titleIcon.style.display = 'inline-flex';
  titleIcon.style.color = 'var(--color-ink)';

  const h3 = document.createElement('h3');
  h3.id = titleId;
  h3.textContent = 'AI Resume Prompt & JSON Import';

  titleWrap.appendChild(titleIcon);
  titleWrap.appendChild(h3);

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'btn btn-xs btn-icon';
  btnClose.textContent = '×';
  btnClose.setAttribute('aria-label', 'Close dialog');

  header.appendChild(titleWrap);
  header.appendChild(btnClose);

  // Modal Body
  const body = document.createElement('div');
  body.className = 'modal-body';

  // Description
  const intro = document.createElement('p');
  intro.innerHTML = `Instruct any AI assistant (<strong>ChatGPT, Claude, Gemini, DeepSeek</strong>) to generate or tailor your resume into Resume Studio's exact JSON format. Once generated, paste the JSON below to load it instantly.`;
  body.appendChild(intro);

  // Step 1: Configuration Form
  const configBox = document.createElement('div');
  configBox.className = 'ai-prompt-config-box';

  const configTitle = document.createElement('div');
  configTitle.className = 'ai-step-title';
  configTitle.innerHTML = `<span class="step-badge">Step 1</span> <strong>Configure Prompt Settings</strong>`;
  configBox.appendChild(configTitle);

  const grid = document.createElement('div');
  grid.className = 'form-grid-3';
  grid.style.marginTop = '0.5rem';
  grid.style.marginBottom = '0.5rem';

  // Target Pages
  const pageCol = document.createElement('div');
  const lblPages = document.createElement('label');
  lblPages.htmlFor = 'ai-cfg-pages';
  lblPages.textContent = 'Page Budget:';
  const selPages = document.createElement('select');
  selPages.id = 'ai-cfg-pages';
  selPages.innerHTML = `
    <option value="1">1 Page (Standard)</option>
    <option value="2">2 Pages</option>
  `;
  selPages.value = String(currentDoc.document.maxPages);
  pageCol.appendChild(lblPages);
  pageCol.appendChild(selPages);

  // Template
  const tmplCol = document.createElement('div');
  const lblTmpl = document.createElement('label');
  lblTmpl.htmlFor = 'ai-cfg-template';
  lblTmpl.textContent = 'Layout Template:';
  const selTmpl = document.createElement('select');
  selTmpl.id = 'ai-cfg-template';
  selTmpl.innerHTML = `
    <option value="classic">Classic (LaTeX)</option>
  `;
  selTmpl.value = currentDoc.document.template;
  tmplCol.appendChild(lblTmpl);
  tmplCol.appendChild(selTmpl);

  // Reference Draft Toggle
  const refCol = document.createElement('div');
  refCol.style.display = 'flex';
  refCol.style.alignItems = 'flex-end';
  refCol.style.paddingBottom = '0.25rem';
  const lblRef = document.createElement('label');
  lblRef.className = 'checkbox-label';
  lblRef.style.fontSize = '0.8rem';
  lblRef.style.cursor = 'pointer';
  const chkRef = document.createElement('input');
  chkRef.type = 'checkbox';
  chkRef.id = 'ai-cfg-include-draft';
  chkRef.checked = true;
  lblRef.appendChild(chkRef);
  lblRef.appendChild(document.createTextNode(' Include current draft as baseline'));
  refCol.appendChild(lblRef);

  grid.appendChild(pageCol);
  grid.appendChild(tmplCol);
  grid.appendChild(refCol);
  configBox.appendChild(grid);

  // Optional target role or job description keywords
  const roleRow = document.createElement('div');
  roleRow.style.marginTop = '0.35rem';
  const lblRole = document.createElement('label');
  lblRole.htmlFor = 'ai-cfg-target-role';
  lblRole.textContent = 'Target Role / Job Focus (Optional):';
  const inputRole = document.createElement('input');
  inputRole.type = 'text';
  inputRole.id = 'ai-cfg-target-role';
  inputRole.placeholder = 'e.g. Senior Distributed Systems Engineer (or paste job description requirements)';
  roleRow.appendChild(lblRole);
  roleRow.appendChild(inputRole);
  configBox.appendChild(roleRow);

  body.appendChild(configBox);

  // Step 2: Copy Prompt Box
  const copyBox = document.createElement('div');
  copyBox.className = 'ai-prompt-copy-box';

  const copyHeaderRow = document.createElement('div');
  copyHeaderRow.style.display = 'flex';
  copyHeaderRow.style.justifyContent = 'space-between';
  copyHeaderRow.style.alignItems = 'center';
  copyHeaderRow.style.marginBottom = '0.5rem';

  const copyTitle = document.createElement('div');
  copyTitle.className = 'ai-step-title';
  copyTitle.innerHTML = `<span class="step-badge">Step 2</span> <strong>Copy AI Prompt</strong>`;

  const btnCopyPrompt = document.createElement('button');
  btnCopyPrompt.type = 'button';
  btnCopyPrompt.id = 'btn-copy-ai-prompt-action';
  btnCopyPrompt.className = 'btn btn-primary';
  btnCopyPrompt.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right: 0.35rem;">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy Prompt for AI
  `;

  copyHeaderRow.appendChild(copyTitle);
  copyHeaderRow.appendChild(btnCopyPrompt);
  copyBox.appendChild(copyHeaderRow);

  // Textarea prompt preview
  const previewTextarea = document.createElement('textarea');
  previewTextarea.id = 'ai-prompt-preview-textarea';
  previewTextarea.className = 'ai-prompt-preview-textarea';
  previewTextarea.readOnly = true;
  previewTextarea.rows = 7;
  previewTextarea.setAttribute('aria-label', 'AI prompt preview text');
  copyBox.appendChild(previewTextarea);

  body.appendChild(copyBox);

  // Step 3: Instant Import JSON Box
  const importBox = document.createElement('div');
  importBox.className = 'ai-prompt-import-box';

  const importHeader = document.createElement('div');
  importHeader.className = 'ai-step-title';
  importHeader.innerHTML = `<span class="step-badge">Step 3</span> <strong>Paste & Import AI Response</strong>`;
  importBox.appendChild(importHeader);

  const importSub = document.createElement('p');
  importSub.className = 'field-hint';
  importSub.style.margin = '0.25rem 0 0.5rem 0';
  importSub.textContent = 'Paste the JSON response from your AI chat here to load it directly into the editor and live preview:';
  importBox.appendChild(importSub);

  const pasteTextarea = document.createElement('textarea');
  pasteTextarea.id = 'ai-json-paste-input';
  pasteTextarea.className = 'ai-json-paste-input';
  pasteTextarea.rows = 5;
  pasteTextarea.placeholder = 'Paste AI-generated JSON here (e.g. { "schemaVersion": 1, ... })';
  pasteTextarea.setAttribute('aria-label', 'Paste AI JSON input');
  importBox.appendChild(pasteTextarea);

  const importFeedback = document.createElement('div');
  importFeedback.id = 'ai-json-import-feedback';
  importFeedback.style.display = 'none';
  importFeedback.style.marginTop = '0.5rem';
  importBox.appendChild(importFeedback);

  const importActionRow = document.createElement('div');
  importActionRow.style.display = 'flex';
  importActionRow.style.justifyContent = 'flex-end';
  importActionRow.style.marginTop = '0.5rem';

  const btnImportJson = document.createElement('button');
  btnImportJson.type = 'button';
  btnImportJson.id = 'btn-import-pasted-json';
  btnImportJson.className = 'btn btn-primary';
  btnImportJson.textContent = 'Import Pasted JSON';
  importActionRow.appendChild(btnImportJson);
  importBox.appendChild(importActionRow);

  body.appendChild(importBox);

  // Modal Footer
  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const btnCloseFooter = document.createElement('button');
  btnCloseFooter.type = 'button';
  btnCloseFooter.className = 'btn btn-secondary';
  btnCloseFooter.textContent = 'Close';
  footer.appendChild(btnCloseFooter);

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  container.appendChild(overlay);

  // Dynamic Prompt Updater
  function updateGeneratedPrompt(): string {
    const pages = Number(selPages.value) as MaxPages;
    const tmpl = selTmpl.value as TemplateId;
    const includeDraft = chkRef.checked;
    const targetRole = inputRole.value.trim();

    const prompt = buildAiResumePrompt({
      targetPages: pages,
      template: tmpl,
      accent: currentDoc.document.accent,
      targetRoleOrJobDescription: targetRole || undefined,
      referenceResume: includeDraft ? currentDoc : undefined,
    });

    previewTextarea.value = prompt;
    return prompt;
  }

  // Initial prompt generation
  updateGeneratedPrompt();

  // Re-generate on input changes
  selPages.addEventListener('change', () => updateGeneratedPrompt());
  selTmpl.addEventListener('change', () => updateGeneratedPrompt());
  chkRef.addEventListener('change', () => updateGeneratedPrompt());
  inputRole.addEventListener('input', () => updateGeneratedPrompt());

  // Copy Prompt Click Handler
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  btnCopyPrompt.addEventListener('click', async () => {
    const textToCopy = updateGeneratedPrompt();
    const success = await copyText(textToCopy);

    if (copyResetTimer) clearTimeout(copyResetTimer);
    if (success) {
      btnCopyPrompt.innerHTML = `✓ Copied to Clipboard!`;
      btnCopyPrompt.classList.add('btn-copied');
      copyResetTimer = setTimeout(() => {
        btnCopyPrompt.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right: 0.35rem;">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Prompt for AI
        `;
        btnCopyPrompt.classList.remove('btn-copied');
      }, 2500);
    } else {
      // Fallback selection if copy failed
      previewTextarea.focus();
      previewTextarea.select();
      btnCopyPrompt.textContent = 'Selected (Press Ctrl+C / Cmd+C)';
    }
  });

  // Import JSON Click Handler
  btnImportJson.addEventListener('click', async () => {
    let raw = pasteTextarea.value.trim();
    if (!raw) {
      importFeedback.className = 'notice-box notice-warning';
      importFeedback.textContent = 'Please paste a JSON object before importing.';
      importFeedback.style.display = 'block';
      return;
    }

    // Strip markdown ```json ... ``` codeblock wrappers if present in AI output
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }

    const res = importDocumentFromText(raw);

    if (!res.ok) {
      importFeedback.className = 'notice-box notice-warning';
      const errList = res.issues.map((i) => `<li>[${i.path}]: ${i.message}</li>`).join('');
      importFeedback.innerHTML = `<strong>Validation Failed:</strong> The pasted text contains schema violations:<ul style="margin: 0.25rem 0 0 1rem; padding: 0;">${errList}</ul>`;
      importFeedback.style.display = 'block';
      return;
    }

    // Confirms if existing document is dirty
    if (store.getState().dirty && onConfirmUnsaved) {
      const confirmed = await onConfirmUnsaved('You have unsaved changes in your editor. Discard current changes and load new resume JSON?');
      if (!confirmed) return;
    }

    // Successfully parsed & validated! Load document
    store.loadDocument(res.document, undefined, true);
    editorView.syncFromDocument(res.document);

    close();
  });

  // Modal Close & Cleanup Logic
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
  };

  btnClose.addEventListener('click', close);
  btnCloseFooter.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    // Trap focus inside modal
    if (e.key === 'Tab') {
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (firstEl && lastEl) {
        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Focus the primary copy button initially
  setTimeout(() => {
    btnCopyPrompt.focus();
  }, 20);

  return close;
}
