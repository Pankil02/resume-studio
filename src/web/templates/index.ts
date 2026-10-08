import type { TemplateId } from '../../core/generated/resume.js';
import type { TemplateDefinition } from '../../core/templates.js';
import { CLASSIC_TEMPLATE } from './classic.js';
import { EXECUTIVE_TEMPLATE } from './executive.js';

export { CLASSIC_TEMPLATE, EXECUTIVE_TEMPLATE };

export const WEB_TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  classic: CLASSIC_TEMPLATE,
  executive: EXECUTIVE_TEMPLATE,
};

export function getWebTemplate(id: TemplateId): TemplateDefinition {
  const tmpl = WEB_TEMPLATES[id];
  if (!tmpl) {
    throw new Error(`Unknown template: ${id}`);
  }
  return tmpl;
}
