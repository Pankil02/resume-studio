import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { compile } from 'json-schema-to-typescript';

const isCheck = process.argv.includes('--check');

const schemaPath = resolve('schema/resume.schema.json');
const schemaContent = readFileSync(schemaPath, 'utf-8');
const schema = JSON.parse(schemaContent);

// 1. Generate TypeScript interfaces
const banner = `/* eslint-disable */
/**
 * Auto-generated from schema/resume.schema.json. Do not edit directly.
 * Run \`bun run generate\` or \`npm run generate\` to regenerate.
 */
`;

const tsTypes = await compile(schema, 'ResumeV1', {
  bannerComment: banner,
  style: { singleQuote: true, semi: true },
  unreachableDefinitions: true,
});

// 2. Generate Standalone Ajv Validator JS
const ajv = new Ajv({
  code: { source: true, esm: true },
  allErrors: true,
});
ajv.addKeyword('x-guidance');

const validateFn = ajv.compile(schema);
let rawValidatorCode = standaloneCode(ajv, validateFn);

// Inline ucs2length and equal helpers to eliminate runtime `require(...)` calls
// Ensuring pure ESM, zero third-party runtime dependencies, and browser compatibility.
rawValidatorCode = rawValidatorCode.replace(
  /const (func\d+) = require\("ajv\/dist\/runtime\/ucs2length"\)\.default;/g,
  `function ucs2length(str) {
  let length = 0;
  const len = str.length;
  let pos = 0;
  while (pos < len) {
    length++;
    const value = str.charCodeAt(pos++);
    if (value >= 0xd800 && value <= 0xdbff && pos < len) {
      const extra = str.charCodeAt(pos);
      if ((extra & 0xfc00) === 0xdc00) pos++;
    }
  }
  return length;
}
const $1 = ucs2length;`
);

rawValidatorCode = rawValidatorCode.replace(
  /const (func\d+) = require\("ajv\/dist\/runtime\/equal"\)\.default;/g,
  `function deepEqual(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}
const $1 = deepEqual;`
);

const validatorJs = `${banner}\n${rawValidatorCode}\n`;

// 3. Generate Validator Type Declarations
const validatorDts = `${banner}
export interface ValidationError {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: Record<string, unknown>;
  message?: string;
}

export interface ValidateFunction {
  (data: unknown): boolean;
  errors?: ValidationError[] | null;
}

export declare const validate: ValidateFunction;
export default validate;
`;

// 4. Extract guidance projection from schema
const guidanceData = {
  hardBounds: {
    maxInputBytes: 128 * 1024,
    maxPages: [1, 2],
    document: {
      title: { minLength: 1, maxLength: 100 },
    },
    profile: {
      name: { minLength: 1, maxLength: 100 },
      headline: { maxLength: 120 },
      email: { minLength: 3, maxLength: 254 },
      phone: { minLength: 1, maxLength: 40 },
      location: { minLength: 1, maxLength: 100 },
      maxLinks: 4,
      link: {
        label: { minLength: 1, maxLength: 40 },
        url: { minLength: 1, maxLength: 2048 },
      },
    },
    summary: { minLength: 1, maxLength: 900 },
    sectionOrder: {
      count: 6,
      sections: ['summary', 'experience', 'education', 'projects', 'skills', 'certifications'],
    },
    experience: {
      maxItems: 12,
      employer: { minLength: 1, maxLength: 100 },
      role: { minLength: 1, maxLength: 100 },
      location: { minLength: 1, maxLength: 100 },
      maxBullets: 8,
      bullet: { minLength: 1, maxLength: 360 },
    },
    education: {
      maxItems: 6,
      institution: { minLength: 1, maxLength: 140 },
      qualification: { minLength: 1, maxLength: 140 },
      location: { minLength: 1, maxLength: 100 },
      maxDetails: 3,
      detail: { minLength: 1, maxLength: 240 },
    },
    projects: {
      maxItems: 8,
      name: { minLength: 1, maxLength: 100 },
      role: { minLength: 1, maxLength: 100 },
      url: { minLength: 1, maxLength: 2048 },
      maxBullets: 6,
      bullet: { minLength: 1, maxLength: 360 },
    },
    skills: {
      maxGroups: 8,
      category: { minLength: 1, maxLength: 60 },
      minItemsPerGroup: 1,
      maxItemsPerGroup: 15,
      item: { minLength: 1, maxLength: 280 },
    },
    certifications: {
      maxItems: 12,
      name: { minLength: 1, maxLength: 140 },
      issuer: { minLength: 1, maxLength: 100 },
      url: { minLength: 1, maxLength: 2048 },
    },
  },
  editorialBudgets: {
    document: {
      title: { recommendedMinChars: 20, recommendedMaxChars: 60 },
    },
    profile: {
      headline: {
        recommendedMinWords: 5,
        recommendedMaxWords: 12,
        recommendedMinChars: 40,
        recommendedMaxChars: 80,
      },
      recommendedLinks: { min: 1, max: 3 },
    },
    summary: {
      recommendedMinWords: 40,
      recommendedMaxWords: 75,
      recommendedMinChars: 250,
      recommendedMaxChars: 500,
      advice: 'Concise factual summary. Omit rather than including generic buzzwords.',
    },
    experience: {
      recommendedRoles: { min: 2, max: 4 },
      recommendedBulletsPerRole: { min: 3, max: 5 },
      bullet: {
        recommendedMinWords: 15,
        recommendedMaxWords: 30,
        recommendedMinChars: 90,
        recommendedMaxChars: 180,
        advice: 'Start with an action verb, provide context, and cite a supported outcome without inventing facts.',
      },
    },
    education: {
      recommendedItems: { min: 1, max: 3 },
    },
    projects: {
      recommendedItems: { min: 1, max: 3 },
      bullet: {
        recommendedMinWords: 15,
        recommendedMaxWords: 30,
        recommendedMinChars: 90,
        recommendedMaxChars: 180,
      },
    },
    skills: {
      recommendedGroups: { min: 3, max: 5 },
      recommendedItemsPerGroup: { min: 4, max: 8 },
    },
    certifications: {
      recommendedItems: { min: 0, max: 4 },
    },
  },
  templates: [
    {
      id: 'classic',
      name: 'Classic (LaTeX)',
      columns: 1,
      fontFamily: 'serif',
      readingOrder: 'single-column-chronological',
      atsOptimized: true,
      description: 'Canonical single-column LaTeX/SWE resume template matching the standard software engineering format.',
    },
    {
      id: 'executive',
      name: 'Executive (Two-Column)',
      columns: 2,
      fontFamily: 'sans-serif',
      readingOrder: 'two-column-sidebar',
      atsOptimized: false,
      readingOrderCaveat: 'Two-column layout places secondary sections in a dedicated right sidebar. Best for human review; some legacy ATS parsers prefer single-column linear order.',
      description: 'Modern two-column layout with prominent left-aligned header, company monogram badges, accent styling, and right sidebar for skills and credentials.',
    },
  ],
  accents: ['slate', 'navy', 'forest', 'ocean'],
};

const guidanceTs = `${banner}
export const FIELD_BOUNDS = ${JSON.stringify(guidanceData.hardBounds, null, 2)} as const;

export const EDITORIAL_GUIDANCE = ${JSON.stringify(guidanceData.editorialBudgets, null, 2)} as const;

export const TEMPLATES = ${JSON.stringify(guidanceData.templates, null, 2)} as const;

export const ACCENTS = ${JSON.stringify(guidanceData.accents, null, 2)} as const;
`;

const generatedDir = resolve('src/core/generated');
const targetFiles = [
  { path: join(generatedDir, 'resume.ts'), content: tsTypes },
  { path: join(generatedDir, 'validator.js'), content: validatorJs },
  { path: join(generatedDir, 'validator.d.ts'), content: validatorDts },
  { path: join(generatedDir, 'guidance.ts'), content: guidanceTs },
];

if (isCheck) {
  let hasDrift = false;
  for (const file of targetFiles) {
    if (!existsSync(file.path)) {
      console.error(`[DRIFT CHECK] Missing generated file: ${file.path}`);
      hasDrift = true;
      continue;
    }
    const current = readFileSync(file.path, 'utf-8');
    if (current !== file.content) {
      console.error(`[DRIFT CHECK] Content mismatch in: ${file.path}`);
      hasDrift = true;
    }
  }

  if (hasDrift) {
    console.error('[DRIFT CHECK] Contract files are out of sync with schema. Run `bun run generate` to update.');
    process.exit(1);
  }

  console.log('[DRIFT CHECK] All generated contracts match schema perfectly.');
  process.exit(0);
}

if (!existsSync(generatedDir)) {
  mkdirSync(generatedDir, { recursive: true });
}

for (const file of targetFiles) {
  writeFileSync(file.path, file.content, 'utf-8');
  console.log(`Generated: ${file.path}`);
}

console.log('Contract generation completed successfully.');
