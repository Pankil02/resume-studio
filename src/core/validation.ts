import validateSchema from './generated/validator.js';
import type { ResumeV1, SectionId, TemplateId } from './generated/resume.js';
import { FIELD_BOUNDS } from './generated/guidance.js';
import { getContentIssues } from './content.js';

export interface Issue {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export type Validation =
  | { ok: true; value: ResumeV1; issues: Issue[] }
  | { ok: false; issues: Issue[] };

const MAX_BYTES = FIELD_BOUNDS.maxInputBytes; // 131,072 bytes (128 KiB)
const ID_REGEX = /^[a-z][a-z0-9-]{1,47}$/;
const YEAR_MONTH_REGEX = /^[0-9]{4}-(?:0[1-9]|1[0-2])$/;
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const ALL_SECTIONS: readonly SectionId[] = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'certifications',
];

/**
 * Parses and strictly validates a raw resume JSON string.
 * Enforces size limits, UTF-8 parsing, schema rules, and semantic checks.
 */
export function parseResume(text: string): Validation {
  if (typeof text !== 'string') {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_INPUT_TYPE',
          severity: 'error',
          path: '/',
          message: 'Input must be a string.',
        },
      ],
    };
  }

  // 1. Hard UTF-8 byte size limit before parsing
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_BYTES) {
    return {
      ok: false,
      issues: [
        {
          code: 'INPUT_TOO_LARGE',
          severity: 'error',
          path: '/',
          message: `Input size (${byteLength} bytes) exceeds maximum allowed 128 KiB.`,
        },
      ],
    };
  }

  // 2. Parse JSON safely, rejecting prototype pollution
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_JSON',
          severity: 'error',
          path: '/',
          message: 'Input is not valid JSON.',
        },
      ],
    };
  }

  // Check prototype pollution keys
  if (hasForbiddenPropertyKeys(parsed)) {
    return {
      ok: false,
      issues: [
        {
          code: 'FORBIDDEN_PROPERTY',
          severity: 'error',
          path: '/',
          message: 'Input contains forbidden object prototype keys.',
        },
      ],
    };
  }

  return validateResume(parsed);
}

/**
 * Recursively checks for prototype pollution property keys (__proto__, constructor, prototype).
 */
function hasForbiddenPropertyKeys(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }
  if (Array.isArray(obj)) {
    return obj.some(hasForbiddenPropertyKeys);
  }
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (hasForbiddenPropertyKeys((obj as Record<string, unknown>)[key])) {
      return true;
    }
  }
  return false;
}

/**
 * Validates an already-parsed JavaScript object against the canonical resume schema
 * and domain semantic invariants.
 */
export function validateResume(value: unknown): Validation {
  const issues: Issue[] = [];

  // 1. Standalone schema validation
  const valid = validateSchema(value);
  if (!valid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      const path = err.instancePath || '/';
      let message = err.message || 'Schema validation error';
      if (err.keyword === 'additionalProperties') {
        const extraProp = (err.params as { additionalProperty?: string }).additionalProperty;
        message = extraProp
          ? `Disallowed additional property: ${extraProp}`
          : 'Disallowed additional properties';
      }
      issues.push({
        code: `SCHEMA_${err.keyword.toUpperCase()}`,
        severity: 'error',
        path,
        message,
      });
    }
    return { ok: false, issues };
  }

  const resume = value as ResumeV1;

  // 2. Semantic check: sectionOrder uniqueness & exact membership
  const sections = resume.sectionOrder;
  const sectionSet = new Set(sections);
  if (sectionSet.size !== ALL_SECTIONS.length || ALL_SECTIONS.some((s) => !sectionSet.has(s))) {
    issues.push({
      code: 'INVALID_SECTION_ORDER',
      severity: 'error',
      path: '/sectionOrder',
      message: 'sectionOrder must contain exactly all 6 section identifiers once.',
    });
  }

  // 3. Semantic check: global item ID uniqueness & format
  const seenIds = new Map<string, string>(); // id -> path
  function checkId(id: string, path: string): void {
    if (!ID_REGEX.test(id)) {
      issues.push({
        code: 'INVALID_ID_FORMAT',
        severity: 'error',
        path,
        message: 'Item ID must match pattern ^[a-z][a-z0-9-]{1,47}$.',
      });
      return;
    }
    if (seenIds.has(id)) {
      issues.push({
        code: 'DUPLICATE_ID',
        severity: 'error',
        path,
        message: `Duplicate item ID '${id}' (already defined at ${seenIds.get(id)}).`,
      });
    } else {
      seenIds.set(id, path);
    }
  }

  resume.profile.links.forEach((l, i) => checkId(l.id, `/profile/links/${i}/id`));
  resume.experience.forEach((e, i) => checkId(e.id, `/experience/${i}/id`));
  resume.education.forEach((e, i) => checkId(e.id, `/education/${i}/id`));
  resume.projects.forEach((p, i) => checkId(p.id, `/projects/${i}/id`));
  resume.skills.forEach((s, i) => checkId(s.id, `/skills/${i}/id`));
  resume.certifications.forEach((c, i) => checkId(c.id, `/certifications/${i}/id`));

  // 4. Semantic check: string controls, whitespace-only, and Unicode bounds
  checkStrings(resume, issues);

  // 5. Semantic check: URL security (http/https, no credentials)
  checkUrls(resume, issues);

  // 6. Semantic check: Date consistency and current/end constraints
  checkDates(resume, issues);

  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    return { ok: false, issues };
  }

  // 7. Calculate editorial guidance warnings (never fail structural validation)
  const editorialIssues = getContentIssues(resume);
  issues.push(...editorialIssues);

  return { ok: true, value: resume, issues };
}

/**
 * Checks all strings for unsafe control characters, whitespace-only content,
 * and Unicode code-point lengths.
 */
function checkStrings(resume: ResumeV1, issues: Issue[]): void {
  function inspectString(str: string, path: string, allowNewlines: boolean, maxCodePoints?: number): void {
    if (str.length === 0) return;

    if (str.includes('\0')) {
      issues.push({
        code: 'NUL_CHARACTER_FORBIDDEN',
        severity: 'error',
        path,
        message: 'String contains forbidden NUL character.',
      });
    }

    if (CONTROL_CHAR_REGEX.test(str)) {
      issues.push({
        code: 'CONTROL_CHARACTERS_FORBIDDEN',
        severity: 'error',
        path,
        message: 'String contains forbidden control characters.',
      });
    }

    if (!allowNewlines && (/[\r\n]/.test(str))) {
      issues.push({
        code: 'NEWLINES_FORBIDDEN',
        severity: 'error',
        path,
        message: 'Single-line field cannot contain newline characters.',
      });
    }

    if (str.trim().length === 0) {
      issues.push({
        code: 'WHITESPACE_ONLY',
        severity: 'error',
        path,
        message: 'Field cannot consist solely of whitespace.',
      });
    }

    if (maxCodePoints !== undefined) {
      const codePoints = [...str].length;
      if (codePoints > maxCodePoints) {
        issues.push({
          code: 'CODE_POINTS_EXCEEDED',
          severity: 'error',
          path,
          message: `Length of ${codePoints} code points exceeds maximum allowed ${maxCodePoints}.`,
        });
      }
    }
  }

  inspectString(resume.document.title, '/document/title', false, 100);
  inspectString(resume.profile.name, '/profile/name', false, 100);
  if (resume.profile.headline) inspectString(resume.profile.headline, '/profile/headline', false, 120);
  if (resume.profile.email) inspectString(resume.profile.email, '/profile/email', false, 254);
  if (resume.profile.phone) inspectString(resume.profile.phone, '/profile/phone', false, 40);
  if (resume.profile.location) inspectString(resume.profile.location, '/profile/location', false, 100);

  resume.profile.links.forEach((l, i) => {
    inspectString(l.label, `/profile/links/${i}/label`, false, 40);
    inspectString(l.url, `/profile/links/${i}/url`, false, 2048);
  });

  if (resume.summary) {
    inspectString(resume.summary, '/summary', true, 900);
  }

  resume.experience.forEach((e, i) => {
    inspectString(e.employer, `/experience/${i}/employer`, false, 100);
    inspectString(e.role, `/experience/${i}/role`, false, 100);
    if (e.location) inspectString(e.location, `/experience/${i}/location`, false, 100);
    if (e.icon) {
      inspectString(e.icon, `/experience/${i}/icon`, false, 65536);
    }
    e.bullets.forEach((b, bi) => {
      inspectString(b, `/experience/${i}/bullets/${bi}`, false, 360);
    });
  });

  resume.education.forEach((e, i) => {
    inspectString(e.institution, `/education/${i}/institution`, false, 140);
    inspectString(e.qualification, `/education/${i}/qualification`, false, 140);
    if (e.location) inspectString(e.location, `/education/${i}/location`, false, 100);
    if (e.icon) {
      inspectString(e.icon, `/education/${i}/icon`, false, 65536);
    }
    e.details.forEach((d, di) => {
      inspectString(d, `/education/${i}/details/${di}`, false, 240);
    });
  });

  resume.projects.forEach((p, i) => {
    inspectString(p.name, `/projects/${i}/name`, false, 100);
    if (p.role) inspectString(p.role, `/projects/${i}/role`, false, 100);
    if (p.url) inspectString(p.url, `/projects/${i}/url`, false, 2048);
    p.bullets.forEach((b, bi) => {
      inspectString(b, `/projects/${i}/bullets/${bi}`, false, 360);
    });
  });

  resume.skills.forEach((s, i) => {
    inspectString(s.category, `/skills/${i}/category`, false, 60);
    s.items.forEach((item, ii) => {
      inspectString(item, `/skills/${i}/items/${ii}`, false, 280);
    });
  });

  resume.certifications.forEach((c, i) => {
    inspectString(c.name, `/certifications/${i}/name`, false, 140);
    if (c.issuer) inspectString(c.issuer, `/certifications/${i}/issuer`, false, 100);
    if (c.url) inspectString(c.url, `/certifications/${i}/url`, false, 2048);
  });
}

/**
 * Validates URLs for safe protocol and absence of credentials.
 */
function checkUrls(resume: ResumeV1, issues: Issue[]): void {
  function validateUrl(urlStr: string, path: string): void {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      issues.push({
        code: 'INVALID_URL',
        severity: 'error',
        path,
        message: 'Malformed URL.',
      });
      return;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      issues.push({
        code: 'UNSAFE_URL_PROTOCOL',
        severity: 'error',
        path,
        message: `Unsafe URL protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
      });
      return;
    }

    if (parsed.username || parsed.password) {
      issues.push({
        code: 'URL_CREDENTIALS_FORBIDDEN',
        severity: 'error',
        path,
        message: 'URL must not contain embedded username or password credentials.',
      });
    }

    if (parsed.protocol === 'http:') {
      issues.push({
        code: 'INSECURE_HTTP_URL',
        severity: 'warning',
        path,
        message: 'URL uses insecure HTTP protocol. HTTPS is recommended.',
      });
    }
  }

  function validateIcon(iconStr: string, path: string): void {
    if (iconStr.startsWith('data:image/')) {
      const validMimes = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 'data:image/webp', 'data:image/svg+xml', 'data:image/gif'];
      const hasValidMime = validMimes.some((m) => iconStr.startsWith(m));
      if (!hasValidMime) {
        issues.push({
          code: 'UNSAFE_IMAGE_MIME',
          severity: 'error',
          path,
          message: 'Image data URL must have a supported image MIME type (png, jpeg, webp, svg+xml, gif).',
        });
      }
      if (/<script/i.test(iconStr) || /javascript:/i.test(iconStr)) {
        issues.push({
          code: 'UNSAFE_IMAGE_CONTENT',
          severity: 'error',
          path,
          message: 'Image data contains forbidden script content.',
        });
      }
      return;
    }

    if (iconStr.startsWith('https://') || iconStr.startsWith('http://')) {
      try {
        const parsed = new URL(iconStr);
        if (parsed.username || parsed.password) {
          issues.push({
            code: 'URL_CREDENTIALS_FORBIDDEN',
            severity: 'error',
            path,
            message: 'Icon URL must not contain embedded username or password credentials.',
          });
        }
      } catch {
        issues.push({
          code: 'INVALID_URL',
          severity: 'error',
          path,
          message: 'Malformed icon URL.',
        });
      }
      return;
    }

    issues.push({
      code: 'UNSAFE_IMAGE_PROTOCOL',
      severity: 'error',
      path,
      message: "Icon must be a safe data URL ('data:image/...') or HTTP/HTTPS URL.",
    });
  }

  resume.profile.links.forEach((l, i) => validateUrl(l.url, `/profile/links/${i}/url`));
  resume.projects.forEach((p, i) => {
    if (p.url) validateUrl(p.url, `/projects/${i}/url`);
  });
  resume.certifications.forEach((c, i) => {
    if (c.url) validateUrl(c.url, `/certifications/${i}/url`);
  });
  resume.experience.forEach((e, i) => {
    if (e.icon) validateIcon(e.icon, `/experience/${i}/icon`);
  });
  resume.education.forEach((e, i) => {
    if (e.icon) validateIcon(e.icon, `/education/${i}/icon`);
  });
}

/**
 * Validates chronological date consistency and current/end constraints.
 */
function checkDates(resume: ResumeV1, issues: Issue[]): void {
  // Experience roles
  resume.experience.forEach((e, i) => {
    const isCurrent = e.current === true;

    if (isCurrent && e.end !== undefined) {
      issues.push({
        code: 'CURRENT_ROLE_HAS_END_DATE',
        severity: 'error',
        path: `/experience/${i}/end`,
        message: 'A current role must not specify an end date.',
      });
    }

    if (!isCurrent && e.end === undefined) {
      issues.push({
        code: 'NON_CURRENT_ROLE_MISSING_END_DATE',
        severity: 'error',
        path: `/experience/${i}/end`,
        message: 'A non-current role must specify an end date.',
      });
    }

    if (e.start && e.end) {
      if (e.start > e.end) {
        issues.push({
          code: 'INVALID_DATE_RANGE',
          severity: 'error',
          path: `/experience/${i}/end`,
          message: `End date (${e.end}) must be on or after start date (${e.start}).`,
        });
      }
    }
  });

  // Education
  resume.education.forEach((e, i) => {
    if (e.start && e.end) {
      if (e.start > e.end) {
        issues.push({
          code: 'INVALID_DATE_RANGE',
          severity: 'error',
          path: `/education/${i}/end`,
          message: `End date (${e.end}) must be on or after start date (${e.start}).`,
        });
      }
    }
  });
}
