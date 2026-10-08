import type {
  ResumeV1,
  SectionId,
  TemplateId,
  MaxPages,
  AccentColor,
  MarginMode,
  PaperSize,
} from '../core/generated/resume.js';
import { EditorStore, generateItemId } from './state.js';
import { getTemplate } from '../core/templates.js';

export interface EditorView {
  syncFromDocument(doc: ResumeV1): void;
  focusField(path: string): void;
}

export function createEditorView(
  container: HTMLElement,
  store: EditorStore
): EditorView {
  container.innerHTML = `
    <div class="editor-accordion">
      <!-- Document Settings Section -->
      <details class="editor-section" open id="sec-document">
        <summary class="editor-section-header"><h2>Document Settings</h2></summary>
        <div class="editor-section-body">
          <div class="form-group">
            <label for="field-doc-title">Document Title</label>
            <input type="text" id="field-doc-title" maxlength="100" required />
            <small class="field-hint">Used for internal reference and exported JSON filename.</small>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="field-doc-template">Template</label>
              <select id="field-doc-template">
                <option value="classic">Classic (LaTeX / SWE)</option>
                <option value="executive">Executive (Two-Column)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="field-doc-paper-size">Paper Size</label>
              <select id="field-doc-paper-size" aria-label="Paper size format">
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">US Letter (8.5 × 11 in)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="field-doc-max-pages">Page Limit</label>
              <select id="field-doc-max-pages">
                <option value="1">1 Page</option>
                <option value="2">2 Pages</option>
              </select>
            </div>
            <div class="form-group">
              <label for="field-doc-accent">Accent Color</label>
              <select id="field-doc-accent">
                <option value="slate">Slate</option>
                <option value="navy">Navy</option>
                <option value="forest">Forest</option>
                <option value="ocean">Ocean Blue</option>
              </select>
            </div>
          </div>

          <!-- Unified Page Margins Control -->
          <div class="margin-setting-card">
            <div class="margin-setting-header">
              <label for="field-doc-margin" class="margin-setting-label">Page Margins</label>
              <div class="margin-custom-box">
                <input type="number" id="field-doc-margin-custom" min="4" max="25" step="1" value="10" aria-label="Custom margin in millimeters" />
                <span class="margin-unit-label">mm</span>
              </div>
            </div>
            <div class="margin-setting-controls">
              <div class="margin-select-wrapper">
                <select id="field-doc-margin" aria-label="Margin preset">
                  <option value="normal">Normal (14mm)</option>
                  <option value="narrow">Narrow (10mm · Default)</option>
                  <option value="compact">Very Narrow (7mm)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div class="margin-slider-wrapper">
                <input type="range" id="field-doc-margin-slider" min="4" max="20" step="1" value="10" aria-label="Margin width slider" />
              </div>
            </div>
            <span id="margin-mode-badge" style="display: none;">Narrow (10mm)</span>
            <input type="checkbox" id="field-doc-reduce-margin" aria-label="Reduce margins for compact single page fit" style="display: none;" />
          </div>

          <!-- Device Autosave -->
          <div class="editor-autosave-row">
            <label class="checkbox-label" for="chk-autosave">
              <input type="checkbox" id="chk-autosave" />
              <span>Device Autosave (unencrypted localStorage)</span>
            </label>
            <div id="autosave-actions" class="autosave-actions">
              <button type="button" id="btn-restore-autosave" class="btn btn-xs btn-secondary" style="display: none;">Restore Draft</button>
              <button type="button" id="btn-clear-autosave" class="btn btn-xs btn-secondary" style="display: none;">Clear Stored</button>
            </div>
          </div>

          <div id="template-caveat-banner" class="notice-box notice-warning" style="display: none;">
            <strong>Executive Layout Notice:</strong> Uses a compact Page 1 sidebar for Skills and Certifications. Spilled items continue on Page 2 full-width. Spatial sidebar order differs from strict linear ATS reading order.
          </div>
        </div>
      </details>

      <!-- Profile Section -->
      <details class="editor-section" id="sec-profile">
        <summary class="editor-section-header"><h2>Profile & Contact</h2></summary>
        <div class="editor-section-body">
          <div class="form-group">
            <label for="field-profile-name">Full Name *</label>
            <input type="text" id="field-profile-name" maxlength="100" required />
          </div>
          <div class="form-group">
            <label for="field-profile-headline">Professional Headline</label>
            <input type="text" id="field-profile-headline" maxlength="120" />
            <small class="field-hint">Recommended: 40–80 characters (5–12 words).</small>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="field-profile-email">Email Address</label>
              <input type="email" id="field-profile-email" maxlength="254" />
            </div>
            <div class="form-group">
              <label for="field-profile-phone">Phone Number</label>
              <input type="tel" id="field-profile-phone" maxlength="40" />
            </div>
          </div>
          <div class="form-group">
            <label for="field-profile-location">Location</label>
            <input type="text" id="field-profile-location" maxlength="100" placeholder="e.g. San Francisco, CA" />
          </div>

          <div class="sub-section">
            <div class="sub-section-header">
              <h3>Profile Links (Max 4)</h3>
              <button type="button" id="btn-add-link" class="btn btn-sm btn-secondary">+ Add Link</button>
            </div>
            <div id="links-container" class="item-list"></div>
          </div>
        </div>
      </details>

      <!-- Summary Section -->
      <details class="editor-section" id="sec-summary">
        <summary class="editor-section-header"><h2>Professional Summary</h2></summary>
        <div class="editor-section-body">
          <div class="form-group">
            <div class="label-with-counter">
              <label for="field-summary">Summary Paragraph</label>
              <span id="summary-counter" class="char-counter">0 / 900</span>
            </div>
            <textarea id="field-summary" rows="4" maxlength="900" placeholder="Concise overview of your career and strengths..."></textarea>
            <small class="field-hint">Recommended: 250–500 characters (40–75 words). Leave blank to omit.</small>
          </div>
        </div>
      </details>

      <!-- Section Order -->
      <details class="editor-section" id="sec-section-order">
        <summary class="editor-section-header"><h2>Section Order</h2></summary>
        <div class="editor-section-body">
          <p class="field-hint">Reorder top-level sections on the rendered resume. Empty sections are omitted automatically.</p>
          <div id="section-order-container" class="item-list"></div>
        </div>
      </details>

      <!-- Experience Section -->
      <details class="editor-section" id="sec-experience">
        <summary class="editor-section-header"><h2>Work Experience</h2></summary>
        <div class="editor-section-body">
          <div class="sub-section-header">
            <p class="field-hint">List relevant positions in reverse chronological order (max 12).</p>
            <button type="button" id="btn-add-experience" class="btn btn-sm btn-secondary">+ Add Experience</button>
          </div>
          <div id="experience-container" class="item-list"></div>
        </div>
      </details>

      <!-- Education Section -->
      <details class="editor-section" id="sec-education">
        <summary class="editor-section-header"><h2>Education</h2></summary>
        <div class="editor-section-body">
          <div class="sub-section-header">
            <p class="field-hint">Degrees and credentials (max 6).</p>
            <button type="button" id="btn-add-education" class="btn btn-sm btn-secondary">+ Add Education</button>
          </div>
          <div id="education-container" class="item-list"></div>
        </div>
      </details>

      <!-- Projects Section -->
      <details class="editor-section" id="sec-projects">
        <summary class="editor-section-header"><h2>Projects</h2></summary>
        <div class="editor-section-body">
          <div class="sub-section-header">
            <p class="field-hint">Key personal or open-source projects (max 8).</p>
            <button type="button" id="btn-add-project" class="btn btn-sm btn-secondary">+ Add Project</button>
          </div>
          <div id="projects-container" class="item-list"></div>
        </div>
      </details>

      <!-- Skills Section -->
      <details class="editor-section" id="sec-skills">
        <summary class="editor-section-header"><h2>Skills</h2></summary>
        <div class="editor-section-body">
          <div class="sub-section-header">
            <p class="field-hint">Categorized technical and functional proficiencies (max 8 groups).</p>
            <button type="button" id="btn-add-skill-group" class="btn btn-sm btn-secondary">+ Add Skill Group</button>
          </div>
          <div id="skills-container" class="item-list"></div>
        </div>
      </details>

      <!-- Certifications Section -->
      <details class="editor-section" id="sec-certifications">
        <summary class="editor-section-header"><h2>Certifications</h2></summary>
        <div class="editor-section-body">
          <div class="sub-section-header">
            <p class="field-hint">Relevant professional credentials and licenses (max 12).</p>
            <button type="button" id="btn-add-certification" class="btn btn-sm btn-secondary">+ Add Certification</button>
          </div>
          <div id="certifications-container" class="item-list"></div>
        </div>
      </details>
    </div>
  `;

  // Grab static input elements
  const inputTitle = container.querySelector('#field-doc-title') as HTMLInputElement;
  const selectTemplate = container.querySelector('#field-doc-template') as HTMLSelectElement;
  const selectPaperSize = container.querySelector('#field-doc-paper-size') as HTMLSelectElement;
  const selectMaxPages = container.querySelector('#field-doc-max-pages') as HTMLSelectElement;
  const selectAccent = container.querySelector('#field-doc-accent') as HTMLSelectElement;
  const selectMargin = container.querySelector('#field-doc-margin') as HTMLSelectElement;
  const sliderMargin = container.querySelector('#field-doc-margin-slider') as HTMLInputElement | null;
  const inputMarginCustom = container.querySelector('#field-doc-margin-custom') as HTMLInputElement | null;
  const badgeMargin = container.querySelector('#margin-mode-badge') as HTMLElement | null;
  const chkReduceMargin = container.querySelector('#field-doc-reduce-margin') as HTMLInputElement | null;
  const templateCaveatBanner = container.querySelector('#template-caveat-banner') as HTMLElement;

  const inputName = container.querySelector('#field-profile-name') as HTMLInputElement;
  const inputHeadline = container.querySelector('#field-profile-headline') as HTMLInputElement;
  const inputEmail = container.querySelector('#field-profile-email') as HTMLInputElement;
  const inputPhone = container.querySelector('#field-profile-phone') as HTMLInputElement;
  const inputLocation = container.querySelector('#field-profile-location') as HTMLInputElement;
  const inputSummary = container.querySelector('#field-summary') as HTMLTextAreaElement;
  const summaryCounter = container.querySelector('#summary-counter') as HTMLElement;

  const linksContainer = container.querySelector('#links-container') as HTMLElement;
  const sectionOrderContainer = container.querySelector('#section-order-container') as HTMLElement;
  const experienceContainer = container.querySelector('#experience-container') as HTMLElement;
  const educationContainer = container.querySelector('#education-container') as HTMLElement;
  const projectsContainer = container.querySelector('#projects-container') as HTMLElement;
  const skillsContainer = container.querySelector('#skills-container') as HTMLElement;
  const certificationsContainer = container.querySelector('#certifications-container') as HTMLElement;

  const btnAddLink = container.querySelector('#btn-add-link') as HTMLButtonElement;
  const btnAddExp = container.querySelector('#btn-add-experience') as HTMLButtonElement;
  const btnAddEdu = container.querySelector('#btn-add-education') as HTMLButtonElement;
  const btnAddProj = container.querySelector('#btn-add-project') as HTMLButtonElement;
  const btnAddSkill = container.querySelector('#btn-add-skill-group') as HTMLButtonElement;
  const btnAddCert = container.querySelector('#btn-add-certification') as HTMLButtonElement;

  function updateSummaryCounter(text: string): void {
    summaryCounter.textContent = `${text.length} / 900`;
    if (text.length > 900) {
      summaryCounter.className = 'char-counter text-error';
    } else {
      summaryCounter.className = 'char-counter';
    }
  }

  // --- Document listeners ---
  inputTitle.addEventListener('input', () => {
    store.updateDocument((doc) => {
      doc.document.title = inputTitle.value;
    });
  });

  selectTemplate.addEventListener('change', () => {
    const val = selectTemplate.value as TemplateId;
    if (val === 'executive') {
      templateCaveatBanner.style.display = 'block';
      templateCaveatBanner.textContent = 'Notice: Executive template uses a two-column layout (skills and credentials in a right sidebar). Reading order is optimized for human review; some older ATS systems prefer single-column linear order.';
      if (selectAccent.value === 'slate') {
        selectAccent.value = 'ocean';
      }
    } else {
      templateCaveatBanner.style.display = 'none';
    }
    store.updateDocument((doc) => {
      doc.document.template = val;
      if (val === 'executive' && doc.document.accent === 'slate') {
        doc.document.accent = 'ocean';
      }
    });
  });

  selectPaperSize.addEventListener('change', () => {
    const val = selectPaperSize.value as PaperSize;
    store.updateDocument((doc) => {
      doc.document.paperSize = val;
    });
  });

  selectMaxPages.addEventListener('change', () => {
    const val = parseInt(selectMaxPages.value, 10) as MaxPages;
    store.updateDocument((doc) => {
      doc.document.maxPages = val;
    });
  });

  selectAccent.addEventListener('change', () => {
    const val = selectAccent.value as AccentColor;
    store.updateDocument((doc) => {
      doc.document.accent = val;
    });
  });

  function updateMarginBadgeAndInputs(mm: number, mode: MarginMode): void {
    if (sliderMargin) {
      sliderMargin.value = String(Math.min(20, Math.max(4, mm)));
    }
    if (inputMarginCustom) {
      inputMarginCustom.value = String(mm);
    }
    if (badgeMargin) {
      if (mode === 'normal') {
        badgeMargin.textContent = 'Normal (14mm)';
      } else if (mode === 'narrow') {
        badgeMargin.textContent = 'Narrow (10mm)';
      } else if (mode === 'compact' || mode === 'very-narrow') {
        badgeMargin.textContent = 'Very Narrow (7mm)';
      } else {
        badgeMargin.textContent = `Custom (${mm}mm)`;
      }
    }
  }

  selectMargin.addEventListener('change', () => {
    const val = selectMargin.value as MarginMode;
    let mm = 10;
    if (val === 'normal') mm = 14;
    else if (val === 'compact' || val === 'very-narrow') mm = 7;
    else if (val === 'custom') {
      mm = inputMarginCustom ? parseInt(inputMarginCustom.value, 10) || 10 : 10;
    }

    updateMarginBadgeAndInputs(mm, val);

    store.updateDocument((doc) => {
      doc.document.margin = val;
      if (val === 'custom') {
        doc.document.customMarginMm = mm;
      } else {
        delete doc.document.customMarginMm;
      }
      doc.document.reduceMargin = val !== 'normal';
    });
    if (chkReduceMargin) {
      chkReduceMargin.checked = val !== 'normal';
    }
  });

  const handleCustomMarginInput = (rawMm: number): void => {
    const mm = Math.max(4, Math.min(25, Math.round(rawMm)));
    let mode: MarginMode = 'custom';
    if (mm === 14) mode = 'normal';
    else if (mm === 10) mode = 'narrow';
    else if (mm === 7) mode = 'compact';

    selectMargin.value = mode;
    updateMarginBadgeAndInputs(mm, mode);

    store.updateDocument((doc) => {
      doc.document.margin = mode;
      if (mode === 'custom') {
        doc.document.customMarginMm = mm;
      } else {
        delete doc.document.customMarginMm;
      }
      doc.document.reduceMargin = mode !== 'normal';
    });
    if (chkReduceMargin) {
      chkReduceMargin.checked = mode !== 'normal';
    }
  };

  if (sliderMargin) {
    sliderMargin.addEventListener('input', () => {
      handleCustomMarginInput(parseFloat(sliderMargin.value));
    });
  }

  if (inputMarginCustom) {
    inputMarginCustom.addEventListener('input', () => {
      const val = parseFloat(inputMarginCustom.value);
      if (!Number.isNaN(val) && val >= 4 && val <= 25) {
        handleCustomMarginInput(val);
      }
    });
  }

  // --- Profile listeners ---
  inputName.addEventListener('input', () => {
    store.updateDocument((doc) => {
      doc.profile.name = inputName.value;
    });
  });

  inputHeadline.addEventListener('input', () => {
    store.updateDocument((doc) => {
      const val = inputHeadline.value;
      if (val === '') {
        delete doc.profile.headline;
      } else {
        doc.profile.headline = val;
      }
    });
  });

  inputEmail.addEventListener('input', () => {
    store.updateDocument((doc) => {
      const val = inputEmail.value;
      if (val === '') {
        delete doc.profile.email;
      } else {
        doc.profile.email = val;
      }
    });
  });

  inputPhone.addEventListener('input', () => {
    store.updateDocument((doc) => {
      const val = inputPhone.value;
      if (val === '') {
        delete doc.profile.phone;
      } else {
        doc.profile.phone = val;
      }
    });
  });

  inputLocation.addEventListener('input', () => {
    store.updateDocument((doc) => {
      const val = inputLocation.value;
      if (val === '') {
        delete doc.profile.location;
      } else {
        doc.profile.location = val;
      }
    });
  });

  // --- Summary listener ---
  inputSummary.addEventListener('input', () => {
    const val = inputSummary.value;
    updateSummaryCounter(val);
    store.updateDocument((doc) => {
      if (val === '') {
        delete doc.summary;
      } else {
        doc.summary = val;
      }
    });
  });

  // --- Dynamic array builders with keyboard focus preservation ---

  function renderLinks(doc: ResumeV1): void {
    linksContainer.innerHTML = '';
    const links = doc.profile.links;
    btnAddLink.disabled = links.length >= 4;

    links.forEach((link, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `link-item-${link.id}`;

      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-id-badge">Link #${idx + 1}</span>
          <div class="item-actions">
            <button type="button" class="btn btn-xs btn-icon btn-move-up" aria-label="Move link up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-xs btn-icon btn-move-down" aria-label="Move link down" ${idx === links.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-xs btn-danger btn-delete" aria-label="Delete link">×</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="link-label-${link.id}">Label</label>
            <input type="text" id="link-label-${link.id}" maxlength="40" value="${escapeHtml(link.label)}" placeholder="e.g. GitHub" />
          </div>
          <div class="form-group flex-2">
            <label for="link-url-${link.id}">URL</label>
            <input type="url" id="link-url-${link.id}" maxlength="2048" value="${escapeHtml(link.url)}" placeholder="https://..." />
          </div>
        </div>
      `;

      // Event bindings
      const labelInput = card.querySelector(`#link-label-${link.id}`) as HTMLInputElement;
      const urlInput = card.querySelector(`#link-url-${link.id}`) as HTMLInputElement;
      const btnUp = card.querySelector('.btn-move-up') as HTMLButtonElement;
      const btnDown = card.querySelector('.btn-move-down') as HTMLButtonElement;
      const btnDel = card.querySelector('.btn-delete') as HTMLButtonElement;

      labelInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const target = d.profile.links.find((l) => l.id === link.id);
          if (target) target.label = labelInput.value;
        });
      });

      urlInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const target = d.profile.links.find((l) => l.id === link.id);
          if (target) target.url = urlInput.value;
        });
      });

      btnUp.addEventListener('click', () => {
        store.updateDocument((d) => {
          if (idx > 0) {
            const temp = d.profile.links[idx - 1]!;
            d.profile.links[idx - 1] = d.profile.links[idx]!;
            d.profile.links[idx] = temp;
          }
        });
        renderLinks(store.getState().document);
      });

      btnDown.addEventListener('click', () => {
        store.updateDocument((d) => {
          if (idx < d.profile.links.length - 1) {
            const temp = d.profile.links[idx + 1]!;
            d.profile.links[idx + 1] = d.profile.links[idx]!;
            d.profile.links[idx] = temp;
          }
        });
        renderLinks(store.getState().document);
      });

      btnDel.addEventListener('click', () => {
        store.updateDocument((d) => {
          (d.profile.links as any) = d.profile.links.filter((l) => l.id !== link.id);
        });
        renderLinks(store.getState().document);
      });

      linksContainer.appendChild(card);
    });
  }

  btnAddLink.addEventListener('click', () => {
    store.updateDocument((doc) => {
      if (doc.profile.links.length < 4) {
        (doc.profile.links as any).push({
          id: generateItemId('link'),
          label: 'Portfolio',
          url: 'https://example.com',
        });
      }
    });
    renderLinks(store.getState().document);
  });

  // --- Section Order builder ---
  function renderSectionOrder(doc: ResumeV1): void {
    sectionOrderContainer.innerHTML = '';
    const order = doc.sectionOrder;

    order.forEach((sec, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card item-card-compact';
      const label = sec.charAt(0).toUpperCase() + sec.slice(1);

      card.innerHTML = `
        <span class="section-order-title">${idx + 1}. ${label}</span>
        <div class="item-actions">
          <button type="button" class="btn btn-xs btn-icon btn-sec-up" aria-label="Move ${label} section up" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn-xs btn-icon btn-sec-down" aria-label="Move ${label} section down" ${idx === order.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
      `;

      const btnUp = card.querySelector('.btn-sec-up') as HTMLButtonElement;
      const btnDown = card.querySelector('.btn-sec-down') as HTMLButtonElement;

      btnUp.addEventListener('click', () => {
        if (idx > 0) {
          store.updateDocument((d) => {
            const temp = d.sectionOrder[idx - 1]!;
            d.sectionOrder[idx - 1] = d.sectionOrder[idx]!;
            d.sectionOrder[idx] = temp;
          });
          renderSectionOrder(store.getState().document);
        }
      });

      btnDown.addEventListener('click', () => {
        if (idx < order.length - 1) {
          store.updateDocument((d) => {
            const temp = d.sectionOrder[idx + 1]!;
            d.sectionOrder[idx + 1] = d.sectionOrder[idx]!;
            d.sectionOrder[idx] = temp;
          });
          renderSectionOrder(store.getState().document);
        }
      });

      sectionOrderContainer.appendChild(card);
    });
  }

  // --- Experience builder ---
  function renderExperience(doc: ResumeV1): void {
    experienceContainer.innerHTML = '';
    const exps = doc.experience;
    btnAddExp.disabled = exps.length >= 12;

    exps.forEach((exp, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `exp-item-${exp.id}`;

      card.innerHTML = `
        <div class="item-card-header">
          <strong>Role #${idx + 1}: ${escapeHtml(exp.role || 'New Role')}</strong>
          <div class="item-actions">
            <button type="button" class="btn btn-xs btn-icon btn-exp-up" aria-label="Move experience up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-xs btn-icon btn-exp-down" aria-label="Move experience down" ${idx === exps.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-xs btn-danger btn-exp-del" aria-label="Delete experience">×</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="exp-employer-${exp.id}">Employer *</label>
            <input type="text" id="exp-employer-${exp.id}" maxlength="100" value="${escapeHtml(exp.employer)}" required />
          </div>
          <div class="form-group flex-2">
            <label for="exp-role-${exp.id}">Role / Title *</label>
            <input type="text" id="exp-role-${exp.id}" maxlength="100" value="${escapeHtml(exp.role)}" required />
          </div>
          <div class="form-group">
            <label for="exp-location-${exp.id}">Location</label>
            <input type="text" id="exp-location-${exp.id}" maxlength="100" value="${escapeHtml(exp.location || '')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="exp-start-${exp.id}">Start (YYYY-MM) *</label>
            <input type="text" id="exp-start-${exp.id}" pattern="^[0-9]{4}-(0[1-9]|1[0-2])$" placeholder="YYYY-MM" value="${escapeHtml(exp.start)}" required />
          </div>
          <div class="form-group checkbox-group">
            <label for="exp-current-${exp.id}" class="checkbox-label">
              <input type="checkbox" id="exp-current-${exp.id}" ${exp.current ? 'checked' : ''} />
              Current Role
            </label>
          </div>
          <div class="form-group" id="exp-end-container-${exp.id}" style="${exp.current ? 'display: none;' : ''}">
            <label for="exp-end-${exp.id}">End (YYYY-MM) *</label>
            <input type="text" id="exp-end-${exp.id}" pattern="^[0-9]{4}-(0[1-9]|1[0-2])$" placeholder="YYYY-MM" value="${escapeHtml(exp.end || '')}" ${exp.current ? 'disabled' : ''} />
          </div>
        </div>
        <div class="form-row form-row-icon">
          <div class="form-group flex-2">
            <label for="exp-icon-file-${exp.id}">Company Icon / Logo (Optional)</label>
            <div class="icon-upload-wrapper">
              <label class="btn btn-xs btn-secondary btn-upload-icon" for="exp-icon-file-${exp.id}">
                ${exp.icon ? 'Change Icon' : 'Upload Icon'}
              </label>
              <input type="file" id="exp-icon-file-${exp.id}" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="visually-hidden" />
              ${exp.icon ? `
                <div class="icon-preview-badge">
                  <img src="${escapeHtml(exp.icon)}" alt="Company logo preview" class="icon-preview-thumb" />
                </div>
                <button type="button" class="btn btn-xs btn-outline btn-remove-icon" aria-label="Remove icon">✕ Remove</button>
              ` : `
                <span class="field-hint icon-upload-hint">Upload PNG, JPG, WebP, or SVG logo</span>
              `}
            </div>
          </div>
        </div>

        <!-- Bullets -->
        <div class="sub-section">
          <div class="sub-section-header">
            <h4>Accomplishment Bullets (Max 8)</h4>
            <button type="button" class="btn btn-xs btn-secondary btn-add-bullet" ${exp.bullets.length >= 8 ? 'disabled' : ''}>+ Add Bullet</button>
          </div>
          <div class="bullets-container" id="bullets-for-${exp.id}"></div>
        </div>
      `;

      // Inputs
      const employerInput = card.querySelector(`#exp-employer-${exp.id}`) as HTMLInputElement;
      const roleInput = card.querySelector(`#exp-role-${exp.id}`) as HTMLInputElement;
      const locInput = card.querySelector(`#exp-location-${exp.id}`) as HTMLInputElement;
      const startInput = card.querySelector(`#exp-start-${exp.id}`) as HTMLInputElement;
      const currentCheck = card.querySelector(`#exp-current-${exp.id}`) as HTMLInputElement;
      const endContainer = card.querySelector(`#exp-end-container-${exp.id}`) as HTMLElement;
      const endInput = card.querySelector(`#exp-end-${exp.id}`) as HTMLInputElement;

      employerInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const target = d.experience.find((e) => e.id === exp.id);
          if (target) target.employer = employerInput.value;
        });
      });

      roleInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const target = d.experience.find((e) => e.id === exp.id);
          if (target) target.role = roleInput.value;
        });
      });

      locInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const target = d.experience.find((e) => e.id === exp.id);
          if (target) {
            const v = locInput.value;
            if (v === '') delete target.location;
            else target.location = v;
          }
        });
      });

      startInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const target = d.experience.find((e) => e.id === exp.id);
          if (target) target.start = startInput.value;
        });
      });

      currentCheck.addEventListener('change', () => {
        const isCurrent = currentCheck.checked;
        endContainer.style.display = isCurrent ? 'none' : 'block';
        endInput.disabled = isCurrent;

        store.updateDocument((d) => {
          const target = d.experience.find((e) => e.id === exp.id);
          if (target) {
            if (isCurrent) {
              target.current = true;
              delete target.end;
            } else {
              delete target.current;
              target.end = endInput.value || '2023-12';
            }
          }
        });
      });

      endInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const target = d.experience.find((e) => e.id === exp.id);
          if (target && !target.current) {
            target.end = endInput.value;
          }
        });
      });

      const iconFileInput = card.querySelector(`#exp-icon-file-${exp.id}`) as HTMLInputElement | null;
      if (iconFileInput) {
        iconFileInput.addEventListener('change', async () => {
          const file = iconFileInput.files?.[0];
          if (!file) return;

          if (file.type === 'image/svg+xml') {
            const text = await file.text();
            if (!/<script/i.test(text) && !/javascript:/i.test(text)) {
              const base64 = btoa(unescape(encodeURIComponent(text)));
              const dataUrl = `data:image/svg+xml;base64,${base64}`;
              store.updateDocument((d) => {
                const target = d.experience.find((e) => e.id === exp.id);
                if (target) target.icon = dataUrl;
              });
              renderExperience(store.getState().document);
            }
          } else {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 96;
                const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, w, h);
                  const dataUrl = canvas.toDataURL('image/png');
                  store.updateDocument((d) => {
                    const target = d.experience.find((e) => e.id === exp.id);
                    if (target) target.icon = dataUrl;
                  });
                  renderExperience(store.getState().document);
                }
              };
              img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
          }
        });
      }

      const btnRemoveIcon = card.querySelector('.btn-remove-icon') as HTMLButtonElement | null;
      if (btnRemoveIcon) {
        btnRemoveIcon.addEventListener('click', () => {
          store.updateDocument((d) => {
            const target = d.experience.find((e) => e.id === exp.id);
            if (target) delete target.icon;
          });
          renderExperience(store.getState().document);
        });
      }

      // Bullets rendering
      const bulletsList = card.querySelector(`#bullets-for-${exp.id}`) as HTMLElement;
      const btnAddBullet = card.querySelector('.btn-add-bullet') as HTMLButtonElement;

      function renderBullets(): void {
        bulletsList.innerHTML = '';
        const currentExp = store.getState().document.experience.find((e) => e.id === exp.id);
        if (!currentExp) return;

        btnAddBullet.disabled = currentExp.bullets.length >= 8;

        currentExp.bullets.forEach((bulletText, bIdx) => {
          const bRow = document.createElement('div');
          bRow.className = 'bullet-item';

          bRow.innerHTML = `
            <div class="bullet-inputs">
              <div class="label-with-counter">
                <span class="field-hint">Bullet #${bIdx + 1}</span>
                <span class="char-counter b-counter">${bulletText.length} / 360</span>
              </div>
              <textarea class="bullet-text" rows="2" maxlength="360" aria-label="Experience bullet #${bIdx + 1}">${escapeHtml(bulletText)}</textarea>
            </div>
            <div class="item-actions">
              <button type="button" class="btn btn-xs btn-icon btn-b-up" aria-label="Move bullet up" ${bIdx === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="btn btn-xs btn-icon btn-b-down" aria-label="Move bullet down" ${bIdx === currentExp.bullets.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="btn btn-xs btn-danger btn-b-del" aria-label="Delete bullet">×</button>
            </div>
          `;

          const bTextarea = bRow.querySelector('.bullet-text') as HTMLTextAreaElement;
          const bCounter = bRow.querySelector('.b-counter') as HTMLElement;
          const bUp = bRow.querySelector('.btn-b-up') as HTMLButtonElement;
          const bDown = bRow.querySelector('.btn-b-down') as HTMLButtonElement;
          const bDel = bRow.querySelector('.btn-b-del') as HTMLButtonElement;

          bTextarea.addEventListener('input', () => {
            const v = bTextarea.value;
            bCounter.textContent = `${v.length} / 360`;
            store.updateDocument((d) => {
              const e = d.experience.find((item) => item.id === exp.id);
              if (e && e.bullets[bIdx] !== undefined) {
                e.bullets[bIdx] = v;
              }
            });
          });

          bUp.addEventListener('click', () => {
            if (bIdx > 0) {
              store.updateDocument((d) => {
                const e = d.experience.find((item) => item.id === exp.id);
                if (e) {
                  const t = e.bullets[bIdx - 1]!;
                  e.bullets[bIdx - 1] = e.bullets[bIdx]!;
                  e.bullets[bIdx] = t;
                }
              });
              renderBullets();
            }
          });

          bDown.addEventListener('click', () => {
            if (bIdx < currentExp.bullets.length - 1) {
              store.updateDocument((d) => {
                const e = d.experience.find((item) => item.id === exp.id);
                if (e) {
                  const t = e.bullets[bIdx + 1]!;
                  e.bullets[bIdx + 1] = e.bullets[bIdx]!;
                  e.bullets[bIdx] = t;
                }
              });
              renderBullets();
            }
          });

          bDel.addEventListener('click', () => {
            store.updateDocument((d) => {
              const e = d.experience.find((item) => item.id === exp.id);
              if (e) {
                e.bullets.splice(bIdx, 1);
              }
            });
            renderBullets();
          });

          bulletsList.appendChild(bRow);
        });
      }

      btnAddBullet.addEventListener('click', () => {
        store.updateDocument((d) => {
          const e = d.experience.find((item) => item.id === exp.id);
          if (e && e.bullets.length < 8) {
            (e.bullets as any).push('Delivered key project improvements and contributed to team deliverables.');
          }
        });
        renderBullets();
      });

      renderBullets();

      // Exp Move / Delete
      const btnExpUp = card.querySelector('.btn-exp-up') as HTMLButtonElement;
      const btnExpDown = card.querySelector('.btn-exp-down') as HTMLButtonElement;
      const btnExpDel = card.querySelector('.btn-exp-del') as HTMLButtonElement;

      btnExpUp.addEventListener('click', () => {
        if (idx > 0) {
          store.updateDocument((d) => {
            const t = d.experience[idx - 1]!;
            d.experience[idx - 1] = d.experience[idx]!;
            d.experience[idx] = t;
          });
          renderExperience(store.getState().document);
        }
      });

      btnExpDown.addEventListener('click', () => {
        if (idx < exps.length - 1) {
          store.updateDocument((d) => {
            const t = d.experience[idx + 1]!;
            d.experience[idx + 1] = d.experience[idx]!;
            d.experience[idx] = t;
          });
          renderExperience(store.getState().document);
        }
      });

      btnExpDel.addEventListener('click', () => {
        store.updateDocument((d) => {
          (d.experience as any) = d.experience.filter((e) => e.id !== exp.id);
        });
        renderExperience(store.getState().document);
      });

      experienceContainer.appendChild(card);
    });
  }

  btnAddExp.addEventListener('click', () => {
    store.updateDocument((doc) => {
      if (doc.experience.length < 12) {
        (doc.experience as any).push({
          id: generateItemId('role'),
          employer: 'Company Name',
          role: 'Job Title',
          start: '2023-01',
          current: true,
          bullets: ['Built scalable systems and improved code quality across products.'],
        });
      }
    });
    renderExperience(store.getState().document);
  });

  // --- Education builder ---
  function renderEducation(doc: ResumeV1): void {
    educationContainer.innerHTML = '';
    const edus = doc.education;
    btnAddEdu.disabled = edus.length >= 6;

    edus.forEach((edu, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `edu-item-${edu.id}`;

      card.innerHTML = `
        <div class="item-card-header">
          <strong>Education #${idx + 1}: ${escapeHtml(edu.qualification || 'Degree')}</strong>
          <div class="item-actions">
            <button type="button" class="btn btn-xs btn-icon btn-edu-up" aria-label="Move education up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-xs btn-icon btn-edu-down" aria-label="Move education down" ${idx === edus.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-xs btn-danger btn-edu-del" aria-label="Delete education">×</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="edu-institution-${edu.id}">Institution *</label>
            <input type="text" id="edu-institution-${edu.id}" maxlength="140" value="${escapeHtml(edu.institution)}" required />
          </div>
          <div class="form-group flex-2">
            <label for="edu-qual-${edu.id}">Qualification *</label>
            <input type="text" id="edu-qual-${edu.id}" maxlength="140" value="${escapeHtml(edu.qualification)}" required />
          </div>
          <div class="form-group">
            <label for="edu-loc-${edu.id}">Location</label>
            <input type="text" id="edu-loc-${edu.id}" maxlength="100" value="${escapeHtml(edu.location || '')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edu-start-${edu.id}">Start (YYYY-MM)</label>
            <input type="text" id="edu-start-${edu.id}" pattern="^[0-9]{4}-(0[1-9]|1[0-2])$" placeholder="YYYY-MM" value="${escapeHtml(edu.start || '')}" />
          </div>
          <div class="form-group">
            <label for="edu-end-${edu.id}">End / Graduation (YYYY-MM)</label>
            <input type="text" id="edu-end-${edu.id}" pattern="^[0-9]{4}-(0[1-9]|1[0-2])$" placeholder="YYYY-MM" value="${escapeHtml(edu.end || '')}" />
          </div>
        </div>

        <!-- Details -->
        <div class="sub-section">
          <div class="sub-section-header">
            <h4>Highlights / Details (Max 3)</h4>
            <button type="button" class="btn btn-xs btn-secondary btn-add-detail" ${edu.details.length >= 3 ? 'disabled' : ''}>+ Add Detail</button>
          </div>
          <div class="details-container" id="details-for-${edu.id}"></div>
        </div>
      `;

      const instInput = card.querySelector(`#edu-institution-${edu.id}`) as HTMLInputElement;
      const qualInput = card.querySelector(`#edu-qual-${edu.id}`) as HTMLInputElement;
      const locInput = card.querySelector(`#edu-loc-${edu.id}`) as HTMLInputElement;
      const startInput = card.querySelector(`#edu-start-${edu.id}`) as HTMLInputElement;
      const endInput = card.querySelector(`#edu-end-${edu.id}`) as HTMLInputElement;

      instInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.education.find((e) => e.id === edu.id);
          if (t) t.institution = instInput.value;
        });
      });

      qualInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.education.find((e) => e.id === edu.id);
          if (t) t.qualification = qualInput.value;
        });
      });

      locInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.education.find((e) => e.id === edu.id);
          if (t) {
            const v = locInput.value;
            if (v === '') delete t.location;
            else t.location = v;
          }
        });
      });

      startInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.education.find((e) => e.id === edu.id);
          if (t) {
            const v = startInput.value;
            if (v === '') delete t.start;
            else t.start = v;
          }
        });
      });

      endInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.education.find((e) => e.id === edu.id);
          if (t) {
            const v = endInput.value;
            if (v === '') delete t.end;
            else t.end = v;
          }
        });
      });

      // Details rendering
      const detailsList = card.querySelector(`#details-for-${edu.id}`) as HTMLElement;
      const btnAddDetail = card.querySelector('.btn-add-detail') as HTMLButtonElement;

      function renderDetails(): void {
        detailsList.innerHTML = '';
        const currentEdu = store.getState().document.education.find((e) => e.id === edu.id);
        if (!currentEdu) return;

        btnAddDetail.disabled = currentEdu.details.length >= 3;

        currentEdu.details.forEach((detailText, dIdx) => {
          const dRow = document.createElement('div');
          dRow.className = 'bullet-item';

          dRow.innerHTML = `
            <input type="text" class="detail-text" maxlength="240" aria-label="Education detail #${dIdx + 1}" value="${escapeHtml(detailText)}" placeholder="e.g. GPA 3.9 / Magna Cum Laude" />
            <button type="button" class="btn btn-xs btn-danger btn-d-del" aria-label="Delete detail">×</button>
          `;

          const dInput = dRow.querySelector('.detail-text') as HTMLInputElement;
          const dDel = dRow.querySelector('.btn-d-del') as HTMLButtonElement;

          dInput.addEventListener('input', () => {
            store.updateDocument((d) => {
              const e = d.education.find((item) => item.id === edu.id);
              if (e && e.details[dIdx] !== undefined) {
                e.details[dIdx] = dInput.value;
              }
            });
          });

          dDel.addEventListener('click', () => {
            store.updateDocument((d) => {
              const e = d.education.find((item) => item.id === edu.id);
              if (e) {
                e.details.splice(dIdx, 1);
              }
            });
            renderDetails();
          });

          detailsList.appendChild(dRow);
        });
      }

      btnAddDetail.addEventListener('click', () => {
        store.updateDocument((d) => {
          const e = d.education.find((item) => item.id === edu.id);
          if (e && e.details.length < 3) {
            (e.details as any).push('Academic Honors / Relevant Coursework');
          }
        });
        renderDetails();
      });

      renderDetails();

      const btnEduUp = card.querySelector('.btn-edu-up') as HTMLButtonElement;
      const btnEduDown = card.querySelector('.btn-edu-down') as HTMLButtonElement;
      const btnEduDel = card.querySelector('.btn-edu-del') as HTMLButtonElement;

      btnEduUp.addEventListener('click', () => {
        if (idx > 0) {
          store.updateDocument((d) => {
            const t = d.education[idx - 1]!;
            d.education[idx - 1] = d.education[idx]!;
            d.education[idx] = t;
          });
          renderEducation(store.getState().document);
        }
      });

      btnEduDown.addEventListener('click', () => {
        if (idx < edus.length - 1) {
          store.updateDocument((d) => {
            const t = d.education[idx + 1]!;
            d.education[idx + 1] = d.education[idx]!;
            d.education[idx] = t;
          });
          renderEducation(store.getState().document);
        }
      });

      btnEduDel.addEventListener('click', () => {
        store.updateDocument((d) => {
          (d.education as any) = d.education.filter((e) => e.id !== edu.id);
        });
        renderEducation(store.getState().document);
      });

      educationContainer.appendChild(card);
    });
  }

  btnAddEdu.addEventListener('click', () => {
    store.updateDocument((doc) => {
      if (doc.education.length < 6) {
        (doc.education as any).push({
          id: generateItemId('edu'),
          institution: 'University Name',
          qualification: 'B.S. in Computer Science',
          end: '2022-05',
          details: [],
        });
      }
    });
    renderEducation(store.getState().document);
  });

  // --- Projects builder ---
  function renderProjects(doc: ResumeV1): void {
    projectsContainer.innerHTML = '';
    const projs = doc.projects;
    btnAddProj.disabled = projs.length >= 8;

    projs.forEach((proj, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `proj-item-${proj.id}`;

      card.innerHTML = `
        <div class="item-card-header">
          <strong>Project #${idx + 1}: ${escapeHtml(proj.name || 'New Project')}</strong>
          <div class="item-actions">
            <button type="button" class="btn btn-xs btn-icon btn-proj-up" aria-label="Move project up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-xs btn-icon btn-proj-down" aria-label="Move project down" ${idx === projs.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-xs btn-danger btn-proj-del" aria-label="Delete project">×</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="proj-name-${proj.id}">Project Name *</label>
            <input type="text" id="proj-name-${proj.id}" maxlength="100" value="${escapeHtml(proj.name)}" required />
          </div>
          <div class="form-group flex-2">
            <label for="proj-role-${proj.id}">Role / Contribution</label>
            <input type="text" id="proj-role-${proj.id}" maxlength="100" value="${escapeHtml(proj.role || '')}" />
          </div>
          <div class="form-group flex-2">
            <label for="proj-url-${proj.id}">URL</label>
            <input type="url" id="proj-url-${proj.id}" maxlength="2048" value="${escapeHtml(proj.url || '')}" placeholder="https://..." />
          </div>
        </div>

        <!-- Bullets -->
        <div class="sub-section">
          <div class="sub-section-header">
            <h4>Project Highlights (Max 6)</h4>
            <button type="button" class="btn btn-xs btn-secondary btn-add-proj-bullet" ${proj.bullets.length >= 6 ? 'disabled' : ''}>+ Add Bullet</button>
          </div>
          <div class="bullets-container" id="proj-bullets-for-${proj.id}"></div>
        </div>
      `;

      const nameInput = card.querySelector(`#proj-name-${proj.id}`) as HTMLInputElement;
      const roleInput = card.querySelector(`#proj-role-${proj.id}`) as HTMLInputElement;
      const urlInput = card.querySelector(`#proj-url-${proj.id}`) as HTMLInputElement;

      nameInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.projects.find((p) => p.id === proj.id);
          if (t) t.name = nameInput.value;
        });
      });

      roleInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.projects.find((p) => p.id === proj.id);
          if (t) {
            const v = roleInput.value;
            if (v === '') delete t.role;
            else t.role = v;
          }
        });
      });

      urlInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.projects.find((p) => p.id === proj.id);
          if (t) {
            const v = urlInput.value;
            if (v === '') delete t.url;
            else t.url = v;
          }
        });
      });

      // Bullets
      const pBulletsList = card.querySelector(`#proj-bullets-for-${proj.id}`) as HTMLElement;
      const btnAddPBullet = card.querySelector('.btn-add-proj-bullet') as HTMLButtonElement;

      function renderProjBullets(): void {
        pBulletsList.innerHTML = '';
        const currentP = store.getState().document.projects.find((p) => p.id === proj.id);
        if (!currentP) return;

        btnAddPBullet.disabled = currentP.bullets.length >= 6;

        currentP.bullets.forEach((bText, bIdx) => {
          const bRow = document.createElement('div');
          bRow.className = 'bullet-item';

          bRow.innerHTML = `
            <textarea class="bullet-text" rows="2" maxlength="360" aria-label="Project bullet #${bIdx + 1}">${escapeHtml(bText)}</textarea>
            <div class="item-actions">
              <button type="button" class="btn btn-xs btn-icon btn-pb-up" aria-label="Move bullet up" ${bIdx === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="btn btn-xs btn-icon btn-pb-down" aria-label="Move bullet down" ${bIdx === currentP.bullets.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="btn btn-xs btn-danger btn-pb-del" aria-label="Delete bullet">×</button>
            </div>
          `;

          const bTextarea = bRow.querySelector('.bullet-text') as HTMLTextAreaElement;
          const bUp = bRow.querySelector('.btn-pb-up') as HTMLButtonElement;
          const bDown = bRow.querySelector('.btn-pb-down') as HTMLButtonElement;
          const bDel = bRow.querySelector('.btn-pb-del') as HTMLButtonElement;

          bTextarea.addEventListener('input', () => {
            store.updateDocument((d) => {
              const p = d.projects.find((item) => item.id === proj.id);
              if (p && p.bullets[bIdx] !== undefined) {
                p.bullets[bIdx] = bTextarea.value;
              }
            });
          });

          bUp.addEventListener('click', () => {
            if (bIdx > 0) {
              store.updateDocument((d) => {
                const p = d.projects.find((item) => item.id === proj.id);
                if (p) {
                  const t = p.bullets[bIdx - 1]!;
                  p.bullets[bIdx - 1] = p.bullets[bIdx]!;
                  p.bullets[bIdx] = t;
                }
              });
              renderProjBullets();
            }
          });

          bDown.addEventListener('click', () => {
            if (bIdx < currentP.bullets.length - 1) {
              store.updateDocument((d) => {
                const p = d.projects.find((item) => item.id === proj.id);
                if (p) {
                  const t = p.bullets[bIdx + 1]!;
                  p.bullets[bIdx + 1] = p.bullets[bIdx]!;
                  p.bullets[bIdx] = t;
                }
              });
              renderProjBullets();
            }
          });

          bDel.addEventListener('click', () => {
            store.updateDocument((d) => {
              const p = d.projects.find((item) => item.id === proj.id);
              if (p) {
                p.bullets.splice(bIdx, 1);
              }
            });
            renderProjBullets();
          });

          pBulletsList.appendChild(bRow);
        });
      }

      btnAddPBullet.addEventListener('click', () => {
        store.updateDocument((d) => {
          const p = d.projects.find((item) => item.id === proj.id);
          if (p && p.bullets.length < 6) {
            (p.bullets as any).push('Architected and released key project feature with automated testing.');
          }
        });
        renderProjBullets();
      });

      renderProjBullets();

      const btnProjUp = card.querySelector('.btn-proj-up') as HTMLButtonElement;
      const btnProjDown = card.querySelector('.btn-proj-down') as HTMLButtonElement;
      const btnProjDel = card.querySelector('.btn-proj-del') as HTMLButtonElement;

      btnProjUp.addEventListener('click', () => {
        if (idx > 0) {
          store.updateDocument((d) => {
            const t = d.projects[idx - 1]!;
            d.projects[idx - 1] = d.projects[idx]!;
            d.projects[idx] = t;
          });
          renderProjects(store.getState().document);
        }
      });

      btnProjDown.addEventListener('click', () => {
        if (idx < projs.length - 1) {
          store.updateDocument((d) => {
            const t = d.projects[idx + 1]!;
            d.projects[idx + 1] = d.projects[idx]!;
            d.projects[idx] = t;
          });
          renderProjects(store.getState().document);
        }
      });

      btnProjDel.addEventListener('click', () => {
        store.updateDocument((d) => {
          (d.projects as any) = d.projects.filter((p) => p.id !== proj.id);
        });
        renderProjects(store.getState().document);
      });

      projectsContainer.appendChild(card);
    });
  }

  btnAddProj.addEventListener('click', () => {
    store.updateDocument((doc) => {
      if (doc.projects.length < 8) {
        (doc.projects as any).push({
          id: generateItemId('proj'),
          name: 'Project Title',
          role: 'Lead Developer',
          bullets: ['Engineered key workflows and released open-source repository.'],
        });
      }
    });
    renderProjects(store.getState().document);
  });

  // --- Skills builder ---
  function renderSkills(doc: ResumeV1): void {
    skillsContainer.innerHTML = '';
    const skills = doc.skills;
    btnAddSkill.disabled = skills.length >= 8;

    skills.forEach((skill, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `skill-item-${skill.id}`;

      card.innerHTML = `
        <div class="item-card-header">
          <strong>Skill Group #${idx + 1}: ${escapeHtml(skill.category || 'Category')}</strong>
          <div class="item-actions">
            <button type="button" class="btn btn-xs btn-icon btn-sk-up" aria-label="Move skill group up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-xs btn-icon btn-sk-down" aria-label="Move skill group down" ${idx === skills.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-xs btn-danger btn-sk-del" aria-label="Delete skill group">×</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="sk-cat-${skill.id}">Category Name *</label>
            <input type="text" id="sk-cat-${skill.id}" maxlength="60" value="${escapeHtml(skill.category)}" required placeholder="e.g. Languages" />
          </div>
          <div class="form-group flex-2">
            <label for="sk-items-${skill.id}">Items (comma-separated, max 15) *</label>
            <input type="text" id="sk-items-${skill.id}" value="${escapeHtml(skill.items.join(', '))}" placeholder="TypeScript, Python, Go" />
            <small class="field-hint">${skill.items.length} / 15 items</small>
          </div>
        </div>
      `;

      const catInput = card.querySelector(`#sk-cat-${skill.id}`) as HTMLInputElement;
      const itemsInput = card.querySelector(`#sk-items-${skill.id}`) as HTMLInputElement;

      catInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.skills.find((s) => s.id === skill.id);
          if (t) t.category = catInput.value;
        });
      });

      itemsInput.addEventListener('input', () => {
        const raw = itemsInput.value;
        const items = raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .slice(0, 15);

        store.updateDocument((d) => {
          const t = d.skills.find((s) => s.id === skill.id);
          if (t) (t.items as any) = items;
        });
      });

      const btnSkUp = card.querySelector('.btn-sk-up') as HTMLButtonElement;
      const btnSkDown = card.querySelector('.btn-sk-down') as HTMLButtonElement;
      const btnSkDel = card.querySelector('.btn-sk-del') as HTMLButtonElement;

      btnSkUp.addEventListener('click', () => {
        if (idx > 0) {
          store.updateDocument((d) => {
            const t = d.skills[idx - 1]!;
            d.skills[idx - 1] = d.skills[idx]!;
            d.skills[idx] = t;
          });
          renderSkills(store.getState().document);
        }
      });

      btnSkDown.addEventListener('click', () => {
        if (idx < skills.length - 1) {
          store.updateDocument((d) => {
            const t = d.skills[idx + 1]!;
            d.skills[idx + 1] = d.skills[idx]!;
            d.skills[idx] = t;
          });
          renderSkills(store.getState().document);
        }
      });

      btnSkDel.addEventListener('click', () => {
        store.updateDocument((d) => {
          (d.skills as any) = d.skills.filter((s) => s.id !== skill.id);
        });
        renderSkills(store.getState().document);
      });

      skillsContainer.appendChild(card);
    });
  }

  btnAddSkill.addEventListener('click', () => {
    store.updateDocument((doc) => {
      if (doc.skills.length < 8) {
        (doc.skills as any).push({
          id: generateItemId('skills'),
          category: 'Tools & Platforms',
          items: ['Git', 'Docker', 'Linux'],
        });
      }
    });
    renderSkills(store.getState().document);
  });

  // --- Certifications builder ---
  function renderCertifications(doc: ResumeV1): void {
    certificationsContainer.innerHTML = '';
    const certs = doc.certifications;
    btnAddCert.disabled = certs.length >= 12;

    certs.forEach((cert, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `cert-item-${cert.id}`;

      card.innerHTML = `
        <div class="item-card-header">
          <strong>Certification #${idx + 1}: ${escapeHtml(cert.name || 'Credential')}</strong>
          <div class="item-actions">
            <button type="button" class="btn btn-xs btn-icon btn-cert-up" aria-label="Move certification up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-xs btn-icon btn-cert-down" aria-label="Move certification down" ${idx === certs.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-xs btn-danger btn-cert-del" aria-label="Delete certification">×</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="cert-name-${cert.id}">Certification Name *</label>
            <input type="text" id="cert-name-${cert.id}" maxlength="140" value="${escapeHtml(cert.name)}" required />
          </div>
          <div class="form-group flex-2">
            <label for="cert-issuer-${cert.id}">Issuer</label>
            <input type="text" id="cert-issuer-${cert.id}" maxlength="100" value="${escapeHtml(cert.issuer || '')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="cert-date-${cert.id}">Date (YYYY-MM)</label>
            <input type="text" id="cert-date-${cert.id}" pattern="^[0-9]{4}-(0[1-9]|1[0-2])$" placeholder="YYYY-MM" value="${escapeHtml(cert.date || '')}" />
          </div>
          <div class="form-group flex-2">
            <label for="cert-url-${cert.id}">Verification URL</label>
            <input type="url" id="cert-url-${cert.id}" maxlength="2048" value="${escapeHtml(cert.url || '')}" placeholder="https://..." />
          </div>
        </div>
      `;

      const nameInput = card.querySelector(`#cert-name-${cert.id}`) as HTMLInputElement;
      const issuerInput = card.querySelector(`#cert-issuer-${cert.id}`) as HTMLInputElement;
      const dateInput = card.querySelector(`#cert-date-${cert.id}`) as HTMLInputElement;
      const urlInput = card.querySelector(`#cert-url-${cert.id}`) as HTMLInputElement;

      nameInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.certifications.find((c) => c.id === cert.id);
          if (t) t.name = nameInput.value;
        });
      });

      issuerInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.certifications.find((c) => c.id === cert.id);
          if (t) {
            const v = issuerInput.value;
            if (v === '') delete t.issuer;
            else t.issuer = v;
          }
        });
      });

      dateInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.certifications.find((c) => c.id === cert.id);
          if (t) {
            const v = dateInput.value;
            if (v === '') delete t.date;
            else t.date = v;
          }
        });
      });

      urlInput.addEventListener('input', () => {
        store.updateDocument((d) => {
          const t = d.certifications.find((c) => c.id === cert.id);
          if (t) {
            const v = urlInput.value;
            if (v === '') delete t.url;
            else t.url = v;
          }
        });
      });

      const btnCertUp = card.querySelector('.btn-cert-up') as HTMLButtonElement;
      const btnCertDown = card.querySelector('.btn-cert-down') as HTMLButtonElement;
      const btnCertDel = card.querySelector('.btn-cert-del') as HTMLButtonElement;

      btnCertUp.addEventListener('click', () => {
        if (idx > 0) {
          store.updateDocument((d) => {
            const t = d.certifications[idx - 1]!;
            d.certifications[idx - 1] = d.certifications[idx]!;
            d.certifications[idx] = t;
          });
          renderCertifications(store.getState().document);
        }
      });

      btnCertDown.addEventListener('click', () => {
        if (idx < certs.length - 1) {
          store.updateDocument((d) => {
            const t = d.certifications[idx + 1]!;
            d.certifications[idx + 1] = d.certifications[idx]!;
            d.certifications[idx] = t;
          });
          renderCertifications(store.getState().document);
        }
      });

      btnCertDel.addEventListener('click', () => {
        store.updateDocument((d) => {
          (d.certifications as any) = d.certifications.filter((c) => c.id !== cert.id);
        });
        renderCertifications(store.getState().document);
      });

      certificationsContainer.appendChild(card);
    });
  }

  btnAddCert.addEventListener('click', () => {
    store.updateDocument((doc) => {
      if (doc.certifications.length < 12) {
        (doc.certifications as any).push({
          id: generateItemId('cert'),
          name: 'Certification Title',
          issuer: 'Certifying Organization',
          date: '2023-06',
        });
      }
    });
    renderCertifications(store.getState().document);
  });

  // --- Master sync function ---
  function syncFromDocument(doc: ResumeV1): void {
    inputTitle.value = doc.document.title;
    selectTemplate.value = doc.document.template;
    if (selectPaperSize) {
      selectPaperSize.value = doc.document.paperSize || 'a4';
    }
    if (doc.document.template === 'executive') {
      templateCaveatBanner.style.display = 'block';
      templateCaveatBanner.textContent = 'Notice: Executive template uses a two-column layout (skills and credentials in a right sidebar). Reading order is optimized for human review; some older ATS systems prefer single-column linear order.';
    } else {
      templateCaveatBanner.style.display = 'none';
    }
    selectMaxPages.value = String(doc.document.maxPages);
    selectAccent.value = doc.document.accent;
    const marginMode = doc.document.margin || (doc.document.reduceMargin ? 'compact' : 'narrow');
    let marginMm = 10;
    if (marginMode === 'custom' && typeof doc.document.customMarginMm === 'number') {
      marginMm = doc.document.customMarginMm;
    } else if (marginMode === 'normal') {
      marginMm = 14;
    } else if (marginMode === 'compact' || marginMode === 'very-narrow') {
      marginMm = 7;
    }

    if (selectMargin) {
      selectMargin.value = marginMode;
    }
    updateMarginBadgeAndInputs(marginMm, marginMode);

    if (chkReduceMargin) {
      chkReduceMargin.checked = marginMode !== 'normal';
    }

    inputName.value = doc.profile.name;
    inputHeadline.value = doc.profile.headline || '';
    inputEmail.value = doc.profile.email || '';
    inputPhone.value = doc.profile.phone || '';
    inputLocation.value = doc.profile.location || '';

    inputSummary.value = doc.summary || '';
    updateSummaryCounter(doc.summary || '');

    renderLinks(doc);
    renderSectionOrder(doc);
    renderExperience(doc);
    renderEducation(doc);
    renderProjects(doc);
    renderSkills(doc);
    renderCertifications(doc);
  }

  function focusField(path: string): void {
    // Attempt matching target element by path prefix or ID
    const pathClean = path.replace(/^\//, '');
    let targetEl: HTMLElement | null = null;

    if (pathClean.startsWith('profile/name')) targetEl = inputName;
    else if (pathClean.startsWith('profile/headline')) targetEl = inputHeadline;
    else if (pathClean.startsWith('profile/email')) targetEl = inputEmail;
    else if (pathClean.startsWith('profile/phone')) targetEl = inputPhone;
    else if (pathClean.startsWith('profile/location')) targetEl = inputLocation;
    else if (pathClean.startsWith('summary')) targetEl = inputSummary;
    else if (pathClean.startsWith('document/title')) targetEl = inputTitle;

    if (!targetEl) {
      // Find matching item card
      const parts = pathClean.split('/');
      const section = parts[0];
      const sectionEl = document.getElementById(`sec-${section}`);
      if (sectionEl instanceof HTMLDetailsElement) {
        sectionEl.open = true;
      }
      targetEl = sectionEl;
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if ('focus' in targetEl && typeof targetEl.focus === 'function') {
        targetEl.focus();
      }
    }
  }

  // Initial sync
  syncFromDocument(store.getState().document);

  return {
    syncFromDocument,
    focusField,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
