import type { ResumeV1, SectionId, TemplateId } from '../core/generated/resume.js';

export type AtomType =
  | 'header'
  | 'section-heading'
  | 'summary-body'
  | 'entry-heading'
  | 'bullet'
  | 'education-detail'
  | 'skill-group'
  | 'certification'
  | 'continuation-label';

export interface SemanticAtom {
  id: string;
  type: AtomType;
  sectionId?: SectionId | 'header' | undefined;
  entryId?: string | undefined;
  sourcePath: string;
  keepWithNext?: boolean | undefined;
  continuationLabel?: string | undefined;
  isSidebarCandidate?: boolean | undefined;

  // Header payload
  headerData?: ResumeV1['profile'] | undefined;

  // Headings and entries payload
  title?: string | undefined;
  subtitle?: string | undefined;
  location?: string | undefined;
  dateRange?: string | undefined;
  url?: string | undefined;
  icon?: string | undefined;

  // Body / bullet payload
  text?: string | undefined;

  // Skills payload
  category?: string | undefined;
  items?: string[] | undefined;

  // Certifications payload
  issuer?: string | undefined;
  date?: string | undefined;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatYearMonth(ym: string): string {
  if (!ym || !ym.includes('-')) return ym || '';
  const parts = ym.split('-');
  const year = parts[0];
  const monthIdx = parseInt(parts[1] || '1', 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || parts[1];
  return `${monthName} ${year}`;
}

export function formatDateRange(
  start?: string,
  end?: string,
  current?: boolean
): string {
  if (current && start) {
    return `${formatYearMonth(start)} - Present`;
  }
  if (start && end) {
    return `${formatYearMonth(start)} - ${formatYearMonth(end)}`;
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
 * Safely renders text with inline bold formatting (**text** or <b>text</b>)
 * into a parent DOM node without using innerHTML.
 */
export function renderFormattedText(container: HTMLElement, text: string): void {
  const regex = /(\*\*(.+?)\*\*|<b>(.+?)<\/b>)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const boldText = match[2] || match[3] || '';
    const strong = document.createElement('strong');
    strong.textContent = boldText;
    container.appendChild(strong);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function createSvgElement(name: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el;
}

export function createPhoneIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    width: '12',
    height: '12',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon-svg icon-phone',
  });
  const path = createSvgElement('path', {
    d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  });
  svg.appendChild(path);
  return svg;
}

export function createEmailIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    width: '12',
    height: '12',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon-svg icon-email',
  });
  const rect = createSvgElement('rect', { width: '20', height: '16', x: '2', y: '4', rx: '2' });
  const path = createSvgElement('path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' });
  svg.appendChild(rect);
  svg.appendChild(path);
  return svg;
}

export function createPinIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    width: '11',
    height: '11',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon-svg icon-pin',
  });
  const path = createSvgElement('path', {
    d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
  });
  const circle = createSvgElement('circle', { cx: '12', cy: '10', r: '3' });
  svg.appendChild(path);
  svg.appendChild(circle);
  return svg;
}

export function createCalendarIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    width: '10',
    height: '10',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon-svg icon-calendar',
  });
  const rect = createSvgElement('rect', { width: '18', height: '18', x: '3', y: '4', rx: '2' });
  const l1 = createSvgElement('line', { x1: '16', x2: '16', y1: '2', y2: '6' });
  const l2 = createSvgElement('line', { x1: '8', x2: '8', y1: '2', y2: '6' });
  const l3 = createSvgElement('line', { x1: '3', x2: '21', y1: '10', y2: '10' });
  svg.appendChild(rect);
  svg.appendChild(l1);
  svg.appendChild(l2);
  svg.appendChild(l3);
  return svg;
}

export function createDiamondIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    width: '12',
    height: '12',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon-svg icon-diamond',
  });
  const path = createSvgElement('path', {
    d: 'M6 3h12l4 6-10 12L2 9z',
  });
  const l1 = createSvgElement('path', { d: 'M11 3 8 9l4 12 4-12-3-6' });
  const l2 = createSvgElement('path', { d: 'M2 9h20' });
  svg.appendChild(path);
  svg.appendChild(l1);
  svg.appendChild(l2);
  return svg;
}

export function createGlobeIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    width: '11',
    height: '11',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'icon-svg icon-globe',
  });
  const circle = createSvgElement('circle', { cx: '12', cy: '12', r: '10' });
  const path = createSvgElement('path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' });
  const l = createSvgElement('line', { x1: '2', x2: '22', y1: '12', y2: '12' });
  svg.appendChild(circle);
  svg.appendChild(path);
  svg.appendChild(l);
  return svg;
}

export function getCompanyMonogram(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  if (!firstWord) return '';
  if (words.length === 1) {
    return cleaned.slice(0, 3).toUpperCase();
  }
  const secondWord = words[1];
  if (secondWord && secondWord.length > 0 && firstWord.length > 0) {
    return ((firstWord[0] ?? '') + (secondWord[0] ?? '')).toUpperCase();
  }
  return firstWord.slice(0, 3).toUpperCase();
}

/**
 * Constructs an array of indivisible semantic atoms from a ResumeV1 document.
 * Each atom maps to an exact sourcePath and preserves ordering and keep-with-next metadata.
 */
export function buildSemanticAtoms(resume: ResumeV1): SemanticAtom[] {
  const atoms: SemanticAtom[] = [];

  // 1. Identity Header Atom
  atoms.push({
    id: 'atom-header',
    type: 'header',
    sectionId: 'header',
    sourcePath: 'profile',
    keepWithNext: true,
    headerData: resume.profile,
  });

  // 2. Sections in specified sectionOrder
  for (const sectionId of resume.sectionOrder) {
    switch (sectionId) {
      case 'summary': {
        if (resume.summary && resume.summary.trim().length > 0) {
          atoms.push({
            id: 'atom-heading-summary',
            type: 'section-heading',
            sectionId: 'summary',
            sourcePath: 'summary',
            title: 'Summary',
            keepWithNext: true,
          });
          atoms.push({
            id: 'atom-summary-body',
            type: 'summary-body',
            sectionId: 'summary',
            sourcePath: 'summary',
            text: resume.summary.trim(),
            keepWithNext: false,
          });
        }
        break;
      }

      case 'experience': {
        if (resume.experience && resume.experience.length > 0) {
          atoms.push({
            id: 'atom-heading-experience',
            type: 'section-heading',
            sectionId: 'experience',
            sourcePath: 'experience',
            title: 'Work Experience',
            keepWithNext: true,
          });

          resume.experience.forEach((role, rIndex) => {
            const roleContinuationLabel = `${role.employer} (Continued)`;
            atoms.push({
              id: `atom-exp-${role.id}-heading`,
              type: 'entry-heading',
              sectionId: 'experience',
              entryId: role.id,
              sourcePath: `experience[${rIndex}]`,
              title: role.employer,
              subtitle: role.role,
              location: role.location,
              icon: role.icon,
              dateRange: formatDateRange(role.start, role.end, role.current),
              keepWithNext: role.bullets.length > 0,
              continuationLabel: roleContinuationLabel,
            });

            role.bullets.forEach((bullet, bIndex) => {
              atoms.push({
                id: `atom-exp-${role.id}-bullet-${bIndex}`,
                type: 'bullet',
                sectionId: 'experience',
                entryId: role.id,
                sourcePath: `experience[${rIndex}].bullets[${bIndex}]`,
                text: bullet,
                keepWithNext: false,
                continuationLabel: roleContinuationLabel,
              });
            });
          });
        }
        break;
      }

      case 'education': {
        if (resume.education && resume.education.length > 0) {
          atoms.push({
            id: 'atom-heading-education',
            type: 'section-heading',
            sectionId: 'education',
            sourcePath: 'education',
            title: 'Education',
            keepWithNext: true,
            isSidebarCandidate: true,
          });

          resume.education.forEach((edu, eIndex) => {
            const eduContinuationLabel = `${edu.institution} (Continued)`;
            atoms.push({
              id: `atom-edu-${edu.id}-heading`,
              type: 'entry-heading',
              sectionId: 'education',
              entryId: edu.id,
              sourcePath: `education[${eIndex}]`,
              title: edu.institution,
              subtitle: edu.qualification,
              location: edu.location,
              icon: edu.icon,
              dateRange: formatDateRange(edu.start, edu.end),
              keepWithNext: edu.details.length > 0,
              continuationLabel: eduContinuationLabel,
              isSidebarCandidate: true,
            });

            edu.details.forEach((detail, dIndex) => {
              atoms.push({
                id: `atom-edu-${edu.id}-detail-${dIndex}`,
                type: 'education-detail',
                sectionId: 'education',
                entryId: edu.id,
                sourcePath: `education[${eIndex}].details[${dIndex}]`,
                text: detail,
                keepWithNext: false,
                continuationLabel: eduContinuationLabel,
                isSidebarCandidate: true,
              });
            });
          });
        }
        break;
      }

      case 'projects': {
        if (resume.projects && resume.projects.length > 0) {
          atoms.push({
            id: 'atom-heading-projects',
            type: 'section-heading',
            sectionId: 'projects',
            sourcePath: 'projects',
            title: 'Projects',
            keepWithNext: true,
            isSidebarCandidate: true,
          });

          resume.projects.forEach((proj, pIndex) => {
            const projContinuationLabel = `${proj.name} (Continued)`;
            atoms.push({
              id: `atom-proj-${proj.id}-heading`,
              type: 'entry-heading',
              sectionId: 'projects',
              entryId: proj.id,
              sourcePath: `projects[${pIndex}]`,
              title: proj.name,
              subtitle: proj.role,
              url: proj.url,
              keepWithNext: proj.bullets.length > 0,
              continuationLabel: projContinuationLabel,
              isSidebarCandidate: true,
            });

            proj.bullets.forEach((bullet, bIndex) => {
              atoms.push({
                id: `atom-proj-${proj.id}-bullet-${bIndex}`,
                type: 'bullet',
                sectionId: 'projects',
                entryId: proj.id,
                sourcePath: `projects[${pIndex}].bullets[${bIndex}]`,
                text: bullet,
                keepWithNext: false,
                continuationLabel: projContinuationLabel,
                isSidebarCandidate: true,
              });
            });
          });
        }
        break;
      }

      case 'skills': {
        if (resume.skills && resume.skills.length > 0) {
          atoms.push({
            id: 'atom-heading-skills',
            type: 'section-heading',
            sectionId: 'skills',
            sourcePath: 'skills',
            title: 'Technical Skills',
            keepWithNext: true,
            isSidebarCandidate: true,
          });

          resume.skills.forEach((skill, sIndex) => {
            atoms.push({
              id: `atom-skill-${skill.id}`,
              type: 'skill-group',
              sectionId: 'skills',
              entryId: skill.id,
              sourcePath: `skills[${sIndex}]`,
              category: skill.category,
              items: [...skill.items],
              keepWithNext: false,
              isSidebarCandidate: true,
            });
          });
        }
        break;
      }

      case 'certifications': {
        if (resume.certifications && resume.certifications.length > 0) {
          atoms.push({
            id: 'atom-heading-certifications',
            type: 'section-heading',
            sectionId: 'certifications',
            sourcePath: 'certifications',
            title: 'Certifications',
            keepWithNext: true,
            isSidebarCandidate: true,
          });

          resume.certifications.forEach((cert, cIndex) => {
            atoms.push({
              id: `atom-cert-${cert.id}`,
              type: 'certification',
              sectionId: 'certifications',
              entryId: cert.id,
              sourcePath: `certifications[${cIndex}]`,
              title: cert.name,
              issuer: cert.issuer,
              date: cert.date,
              url: cert.url,
              keepWithNext: false,
              isSidebarCandidate: true,
            });
          });
        }
        break;
      }
    }
  }

  return atoms;
}

/**
 * Creates a continuation label atom for an entry that split across a page boundary.
 */
export function createContinuationAtom(
  parentAtom: SemanticAtom,
  pageNumber: number
): SemanticAtom {
  const entryId = parentAtom.entryId || 'entry';
  const labelText = parentAtom.continuationLabel || 'Continued';
  return {
    id: `atom-cont-${entryId}-p${pageNumber}`,
    type: 'continuation-label',
    sectionId: parentAtom.sectionId,
    entryId,
    sourcePath: parentAtom.sourcePath,
    text: labelText,
    keepWithNext: true,
  };
}

/**
 * Creates a safe DOM HTMLElement from a SemanticAtom.
 * Employs document.createElement and textContent to prevent HTML injection vulnerabilities.
 */
export function createAtomElement(
  atom: SemanticAtom,
  template: TemplateId
): HTMLElement {
  const el = document.createElement('div');
  el.className = `resume-atom atom-${atom.type}`;
  el.setAttribute('data-atom-id', atom.id);
  el.setAttribute('data-atom-type', atom.type);
  el.setAttribute('data-source-path', atom.sourcePath);

  switch (atom.type) {
    case 'header': {
      const header = document.createElement('header');
      header.className = `header-content${template === 'executive' ? ' executive-header' : ''}`;

      const nameEl = document.createElement('h1');
      nameEl.className = 'profile-name';
      nameEl.textContent = atom.headerData?.name || '';
      header.appendChild(nameEl);

      if (atom.headerData?.headline && atom.headerData.headline.trim().length > 0) {
        const headlineEl = document.createElement('div');
        headlineEl.className = 'profile-headline';
        headlineEl.textContent = atom.headerData.headline.trim();
        header.appendChild(headlineEl);
      }

      const metaRow = document.createElement('div');
      metaRow.className = `profile-meta-row${template === 'executive' ? ' executive-meta-row' : ''}`;

      if (template === 'executive') {
        if (atom.headerData?.phone) {
          const phoneSpan = document.createElement('span');
          phoneSpan.className = 'meta-item meta-phone';
          phoneSpan.appendChild(createPhoneIcon());
          const txt = document.createElement('span');
          txt.textContent = atom.headerData.phone;
          phoneSpan.appendChild(txt);
          metaRow.appendChild(phoneSpan);
        }

        if (atom.headerData?.email) {
          const emailA = document.createElement('a');
          emailA.className = 'meta-item meta-email meta-link';
          emailA.href = `mailto:${atom.headerData.email}`;
          emailA.rel = 'noopener noreferrer';
          emailA.appendChild(createEmailIcon());
          const txt = document.createElement('span');
          txt.textContent = atom.headerData.email;
          emailA.appendChild(txt);
          metaRow.appendChild(emailA);
        }

        if (atom.headerData?.location) {
          const locSpan = document.createElement('span');
          locSpan.className = 'meta-item meta-location';
          locSpan.appendChild(createPinIcon());
          const txt = document.createElement('span');
          txt.textContent = atom.headerData.location;
          locSpan.appendChild(txt);
          metaRow.appendChild(locSpan);
        }

        if (atom.headerData?.links && atom.headerData.links.length > 0) {
          for (const link of atom.headerData.links) {
            const linkA = document.createElement('a');
            linkA.className = 'meta-item meta-link';
            linkA.href = link.url;
            linkA.target = '_blank';
            linkA.rel = 'noopener noreferrer';
            linkA.appendChild(createGlobeIcon());
            const txt = document.createElement('span');
            txt.textContent = link.label;
            linkA.appendChild(txt);
            metaRow.appendChild(linkA);
          }
        }
      } else {
        const metaItems: HTMLElement[] = [];

        if (atom.headerData?.location) {
          const locSpan = document.createElement('span');
          locSpan.className = 'meta-item meta-location';
          locSpan.textContent = atom.headerData.location;
          metaItems.push(locSpan);
        }

        if (atom.headerData?.phone) {
          const phoneSpan = document.createElement('span');
          phoneSpan.className = 'meta-item meta-phone';
          phoneSpan.textContent = atom.headerData.phone;
          metaItems.push(phoneSpan);
        }

        if (atom.headerData?.email) {
          const emailA = document.createElement('a');
          emailA.className = 'meta-item meta-email meta-link';
          emailA.href = `mailto:${atom.headerData.email}`;
          emailA.textContent = atom.headerData.email;
          emailA.rel = 'noopener noreferrer';
          metaItems.push(emailA);
        }

        if (atom.headerData?.links && atom.headerData.links.length > 0) {
          for (const link of atom.headerData.links) {
            const linkA = document.createElement('a');
            linkA.className = 'meta-item meta-link';
            linkA.href = link.url;
            linkA.textContent = link.label;
            linkA.target = '_blank';
            linkA.rel = 'noopener noreferrer';
            metaItems.push(linkA);
          }
        }

        metaItems.forEach((item, index) => {
          if (index > 0) {
            const sep = document.createElement('span');
            sep.className = 'meta-sep';
            sep.textContent = ' | ';
            sep.setAttribute('aria-hidden', 'true');
            metaRow.appendChild(sep);
          }
          metaRow.appendChild(item);
        });
      }

      if (metaRow.childNodes.length > 0) {
        header.appendChild(metaRow);
      }

      el.appendChild(header);
      break;
    }

    case 'section-heading': {
      const h2 = document.createElement('h2');
      h2.className = 'section-heading-title';
      if (template === 'executive') {
        if (atom.sectionId === 'experience') {
          h2.textContent = 'EXPERIENCE';
        } else if (atom.sectionId === 'skills') {
          h2.textContent = 'SKILLS';
        } else if (atom.sectionId === 'projects') {
          h2.textContent = 'KEY ACHIEVEMENTS';
        } else if (atom.sectionId === 'education') {
          h2.textContent = 'EDUCATION';
        } else if (atom.sectionId === 'certifications') {
          h2.textContent = 'CERTIFICATES';
        } else if (atom.sectionId === 'summary') {
          h2.textContent = 'SUMMARY';
        } else {
          h2.textContent = atom.title?.toUpperCase() || '';
        }
      } else {
        h2.textContent = atom.title || '';
      }
      el.appendChild(h2);

      const rule = document.createElement('div');
      rule.className = 'section-heading-rule';
      el.appendChild(rule);
      break;
    }

    case 'summary-body': {
      const p = document.createElement('p');
      p.className = 'summary-body-text';
      renderFormattedText(p, atom.text || '');
      el.appendChild(p);
      break;
    }

    case 'entry-heading': {
      if (template === 'executive') {
        if (atom.sectionId === 'experience') {
          const entryWrapper = document.createElement('div');
          entryWrapper.className = 'executive-entry-wrapper';

          const badge = document.createElement('div');
          badge.className = `entry-company-badge${atom.icon ? ' has-icon' : ''}`;
          badge.setAttribute('aria-hidden', 'true');
          if (atom.icon && (atom.icon.startsWith('data:image/') || atom.icon.startsWith('https://') || atom.icon.startsWith('http://'))) {
            const img = document.createElement('img');
            img.className = 'company-badge-img';
            img.src = atom.icon;
            img.alt = atom.title || 'Company icon';
            badge.appendChild(img);
          } else {
            badge.textContent = getCompanyMonogram(atom.title || '');
          }
          entryWrapper.appendChild(badge);

          const textGroup = document.createElement('div');
          textGroup.className = 'executive-entry-text-group';

          const roleEl = document.createElement('div');
          roleEl.className = 'entry-role-title';
          roleEl.textContent = atom.subtitle || atom.title || '';
          textGroup.appendChild(roleEl);

          if (atom.title && atom.subtitle) {
            const companyEl = document.createElement('div');
            companyEl.className = 'entry-company-name';
            companyEl.textContent = atom.title;
            textGroup.appendChild(companyEl);
          }

          const metaRow = document.createElement('div');
          metaRow.className = 'entry-date-location-row';

          if (atom.dateRange) {
            const dateSpan = document.createElement('span');
            dateSpan.className = 'entry-date-item';
            dateSpan.appendChild(createCalendarIcon());
            const dtText = document.createElement('span');
            dtText.textContent = atom.dateRange;
            dateSpan.appendChild(dtText);
            metaRow.appendChild(dateSpan);
          }

          if (atom.location) {
            const locSpan = document.createElement('span');
            locSpan.className = 'entry-loc-item';
            locSpan.appendChild(createPinIcon());
            const locText = document.createElement('span');
            locText.textContent = atom.location;
            locSpan.appendChild(locText);
            metaRow.appendChild(locSpan);
          }

          textGroup.appendChild(metaRow);
          entryWrapper.appendChild(textGroup);
          el.appendChild(entryWrapper);
          break;
        }

        if (atom.sectionId === 'projects') {
          const projWrapper = document.createElement('div');
          projWrapper.className = 'executive-achievement-header';

          const icon = createDiamondIcon();
          projWrapper.appendChild(icon);

          const titleSpan = document.createElement('div');
          titleSpan.className = 'achievement-title';
          titleSpan.textContent = atom.title || '';
          projWrapper.appendChild(titleSpan);

          el.appendChild(projWrapper);
          break;
        }

        if (atom.sectionId === 'education') {
          const eduWrapper = document.createElement('div');
          eduWrapper.className = 'executive-edu-header';

          const qualEl = document.createElement('div');
          qualEl.className = 'edu-qual-title';
          qualEl.textContent = atom.subtitle || atom.title || '';
          eduWrapper.appendChild(qualEl);

          if (atom.title && atom.subtitle) {
            const instEl = document.createElement('div');
            instEl.className = 'edu-inst-name';
            instEl.textContent = atom.title;
            eduWrapper.appendChild(instEl);
          }

          if (atom.location) {
            const locRow = document.createElement('div');
            locRow.className = 'edu-loc-row';
            locRow.appendChild(createPinIcon());
            const locSpan = document.createElement('span');
            locSpan.textContent = atom.location;
            locRow.appendChild(locSpan);
            eduWrapper.appendChild(locRow);
          }

          el.appendChild(eduWrapper);
          break;
        }
      }

      const topRow = document.createElement('div');
      topRow.className = 'entry-top-row';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'entry-title-group';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'entry-title';
      titleSpan.textContent = atom.title || '';
      titleGroup.appendChild(titleSpan);

      if (atom.subtitle) {
        const sep = document.createElement('span');
        sep.className = 'entry-sep';
        sep.textContent = ' | ';
        sep.setAttribute('aria-hidden', 'true');
        titleGroup.appendChild(sep);

        const subSpan = document.createElement('span');
        subSpan.className = 'entry-subtitle';
        subSpan.textContent = atom.subtitle;
        titleGroup.appendChild(subSpan);
      }

      if (atom.url) {
        const sep = document.createElement('span');
        sep.className = 'entry-sep';
        sep.textContent = ' | ';
        sep.setAttribute('aria-hidden', 'true');
        titleGroup.appendChild(sep);

        const urlA = document.createElement('a');
        urlA.className = 'entry-url-link meta-link';
        urlA.href = atom.url;
        urlA.textContent = atom.url.replace(/^https?:\/\//, '');
        urlA.target = '_blank';
        urlA.rel = 'noopener noreferrer';
        titleGroup.appendChild(urlA);
      }

      topRow.appendChild(titleGroup);

      const metaGroup = document.createElement('div');
      metaGroup.className = 'entry-meta-group';

      if (atom.sectionId === 'education' && atom.location && atom.dateRange) {
        const combined = document.createElement('span');
        combined.className = 'entry-date';
        combined.textContent = `${atom.location} ${atom.dateRange}`;
        metaGroup.appendChild(combined);
      } else if (atom.dateRange) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'entry-date';
        dateSpan.textContent = atom.dateRange;
        metaGroup.appendChild(dateSpan);
      } else if (atom.location) {
        const locSpan = document.createElement('span');
        locSpan.className = 'entry-date';
        locSpan.textContent = atom.location;
        metaGroup.appendChild(locSpan);
      }

      topRow.appendChild(metaGroup);
      el.appendChild(topRow);

      if (atom.sectionId === 'experience' && atom.location) {
        const subRow = document.createElement('div');
        subRow.className = 'entry-subline';
        subRow.textContent = atom.location;
        el.appendChild(subRow);
      }
      break;
    }

    case 'bullet': {
      if (template === 'executive' && atom.sectionId === 'projects') {
        const textSpan = document.createElement('div');
        textSpan.className = 'achievement-desc';
        renderFormattedText(textSpan, atom.text || '');
        el.appendChild(textSpan);
        break;
      }

      const marker = document.createElement('span');
      marker.className = 'bullet-marker';
      marker.textContent = '•';
      marker.setAttribute('aria-hidden', 'true');
      el.appendChild(marker);

      const textSpan = document.createElement('span');
      textSpan.className = 'bullet-text';
      renderFormattedText(textSpan, atom.text || '');
      el.appendChild(textSpan);
      break;
    }

    case 'education-detail': {
      const marker = document.createElement('span');
      marker.className = 'bullet-marker';
      marker.textContent = '•';
      marker.setAttribute('aria-hidden', 'true');
      el.appendChild(marker);

      const textSpan = document.createElement('span');
      textSpan.className = 'bullet-text';
      renderFormattedText(textSpan, atom.text || '');
      el.appendChild(textSpan);
      break;
    }

    case 'skill-group': {
      if (template === 'executive') {
        const hasDetailedDescriptions = atom.items && atom.items.some((it) => it.includes(':') && it.length > 50);
        if (hasDetailedDescriptions) {
          const groupWrapper = document.createElement('div');
          groupWrapper.className = 'executive-skill-group';

          if (atom.category) {
            const catTitle = document.createElement('div');
            catTitle.className = 'skill-group-heading';
            catTitle.textContent = atom.category;
            groupWrapper.appendChild(catTitle);
          }

          if (atom.items && atom.items.length > 0) {
            const list = document.createElement('div');
            list.className = 'skill-items-list';
            for (const item of atom.items) {
              const itemRow = document.createElement('div');
              itemRow.className = 'executive-skill-item';

              const marker = document.createElement('span');
              marker.className = 'bullet-marker';
              marker.textContent = '•';
              marker.setAttribute('aria-hidden', 'true');
              itemRow.appendChild(marker);

              const textSpan = document.createElement('span');
              textSpan.className = 'bullet-text';
              if (item.includes(':')) {
                const colonIdx = item.indexOf(':');
                const prefix = item.slice(0, colonIdx + 1);
                const suffix = item.slice(colonIdx + 1);
                const strong = document.createElement('strong');
                strong.className = 'skill-item-prefix';
                strong.textContent = prefix;
                textSpan.appendChild(strong);
                renderFormattedText(textSpan, suffix);
              } else {
                renderFormattedText(textSpan, item);
              }
              itemRow.appendChild(textSpan);
              list.appendChild(itemRow);
            }
            groupWrapper.appendChild(list);
          }
          el.appendChild(groupWrapper);
          break;
        }

        // Best practice inline single-line layout
        const marker = document.createElement('span');
        marker.className = 'bullet-marker';
        marker.textContent = '•';
        marker.setAttribute('aria-hidden', 'true');
        el.appendChild(marker);

        const textSpan = document.createElement('span');
        textSpan.className = 'bullet-text skill-group-text';

        if (atom.category) {
          const catSpan = document.createElement('strong');
          catSpan.className = 'skill-category';
          catSpan.textContent = `${atom.category}: `;
          textSpan.appendChild(catSpan);
        }

        const itemsSpan = document.createElement('span');
        itemsSpan.className = 'skill-items';
        itemsSpan.textContent = (atom.items || []).join(', ');
        textSpan.appendChild(itemsSpan);

        el.appendChild(textSpan);
        break;
      }

      const marker = document.createElement('span');
      marker.className = 'bullet-marker';
      marker.textContent = '•';
      marker.setAttribute('aria-hidden', 'true');
      el.appendChild(marker);

      const textSpan = document.createElement('span');
      textSpan.className = 'bullet-text skill-group-text';

      const catSpan = document.createElement('strong');
      catSpan.className = 'skill-category';
      catSpan.textContent = `${atom.category}: `;
      textSpan.appendChild(catSpan);

      const itemsSpan = document.createElement('span');
      itemsSpan.className = 'skill-items';
      itemsSpan.textContent = (atom.items || []).join(', ');
      textSpan.appendChild(itemsSpan);

      el.appendChild(textSpan);
      break;
    }

    case 'certification': {
      if (template === 'executive') {
        const certEl = document.createElement('div');
        certEl.className = 'executive-cert-item';

        const nameSpan = document.createElement('div');
        nameSpan.className = 'cert-name';
        nameSpan.textContent = atom.title || '';
        certEl.appendChild(nameSpan);

        if (atom.issuer || atom.date) {
          const sub = document.createElement('div');
          sub.className = 'cert-subline';
          sub.textContent = [atom.issuer, atom.date ? formatYearMonth(atom.date) : ''].filter(Boolean).join(' • ');
          certEl.appendChild(sub);
        }

        el.appendChild(certEl);
        break;
      }

      const marker = document.createElement('span');
      marker.className = 'bullet-marker';
      marker.textContent = '•';
      marker.setAttribute('aria-hidden', 'true');
      el.appendChild(marker);

      const textSpan = document.createElement('span');
      textSpan.className = 'bullet-text';

      const nameSpan = document.createElement('strong');
      nameSpan.className = 'cert-name';
      nameSpan.textContent = atom.title || '';
      textSpan.appendChild(nameSpan);

      if (atom.issuer) {
        const issuerSpan = document.createElement('span');
        issuerSpan.className = 'cert-issuer';
        issuerSpan.textContent = ` — ${atom.issuer}`;
        textSpan.appendChild(issuerSpan);
      }

      if (atom.date) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'cert-date';
        dateSpan.textContent = ` (${formatYearMonth(atom.date)})`;
        textSpan.appendChild(dateSpan);
      }

      if (atom.url) {
        const urlA = document.createElement('a');
        urlA.className = 'meta-link cert-link';
        urlA.href = atom.url;
        urlA.textContent = ' [Verify]';
        urlA.target = '_blank';
        urlA.rel = 'noopener noreferrer';
        textSpan.appendChild(urlA);
      }

      el.appendChild(textSpan);
      break;
    }

    case 'continuation-label': {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'continuation-label-text';
      labelSpan.textContent = atom.text || 'Continued';
      el.appendChild(labelSpan);
      break;
    }
  }

  return el;
}
