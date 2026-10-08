import type { TemplateDefinition } from '../../core/templates.js';

export const EXECUTIVE_TEMPLATE: TemplateDefinition = {
  id: 'executive',
  name: 'Executive (Two-Column)',
  columns: 2,
  fontFamily: 'sans-serif',
  readingOrder: 'two-column-sidebar',
  atsOptimized: false,
  readingOrderCaveat:
    'Two-column layout places secondary sections in a dedicated right sidebar. Best for human review; some legacy ATS parsers prefer single-column linear order.',
  description:
    'Modern two-column layout with prominent left-aligned header, company monogram badges, accent styling, and right sidebar for skills and credentials.',
};
