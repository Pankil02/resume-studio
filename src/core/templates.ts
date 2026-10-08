import { TEMPLATES } from './generated/guidance.js';
import type { TemplateId } from './generated/resume.js';

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  columns: number;
  fontFamily: 'serif' | 'sans-serif';
  readingOrder: string;
  atsOptimized: boolean;
  readingOrderCaveat?: string;
  description: string;
}

export const TEMPLATE_LIST: readonly TemplateDefinition[] = TEMPLATES as unknown as readonly TemplateDefinition[];

export function listTemplates(): readonly TemplateDefinition[] {
  return TEMPLATE_LIST;
}

export function getTemplate(id: TemplateId): TemplateDefinition {
  const tmpl = TEMPLATE_LIST.find((t) => t.id === id);
  if (!tmpl) {
    throw new Error(`Unknown template ID: ${id}`);
  }
  return tmpl;
}
