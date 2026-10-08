import type { ResumeV1 } from './generated/resume.js';
import type { Issue } from './validation.js';
import { EDITORIAL_GUIDANCE, TEMPLATES } from './generated/guidance.js';

export interface ContentMetrics {
  totalWords: number;
  totalCodePoints: number;
  roleCount: number;
  bulletCount: number;
  skillGroupCount: number;
  projectCount: number;
  educationCount: number;
  certificationCount: number;
}

/**
 * Counts whitespace-separated words in a string.
 */
export function countWords(str: string): number {
  if (!str) return 0;
  const words = str.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Counts Unicode code points (properly handling surrogate pairs and emoji).
 */
export function countCodePoints(str: string): number {
  if (!str) return 0;
  return [...str].length;
}

/**
 * Calculates aggregate content metrics for a resume document.
 */
export function getContentMetrics(resume: ResumeV1): ContentMetrics {
  let totalWords = 0;
  let totalCodePoints = 0;
  let bulletCount = 0;

  function tally(str?: string): void {
    if (!str) return;
    totalWords += countWords(str);
    totalCodePoints += countCodePoints(str);
  }

  tally(resume.document.title);
  tally(resume.profile.name);
  tally(resume.profile.headline);
  tally(resume.profile.location);
  resume.profile.links.forEach((l) => tally(l.label));
  tally(resume.summary);

  resume.experience.forEach((e) => {
    tally(e.employer);
    tally(e.role);
    tally(e.location);
    e.bullets.forEach((b) => {
      tally(b);
      bulletCount += 1;
    });
  });

  resume.education.forEach((e) => {
    tally(e.institution);
    tally(e.qualification);
    tally(e.location);
    e.details.forEach(tally);
  });

  resume.projects.forEach((p) => {
    tally(p.name);
    tally(p.role);
    p.bullets.forEach((b) => {
      tally(b);
      bulletCount += 1;
    });
  });

  resume.skills.forEach((s) => {
    tally(s.category);
    s.items.forEach(tally);
  });

  resume.certifications.forEach((c) => {
    tally(c.name);
    tally(c.issuer);
  });

  return {
    totalWords,
    totalCodePoints,
    roleCount: resume.experience.length,
    bulletCount,
    skillGroupCount: resume.skills.length,
    projectCount: resume.projects.length,
    educationCount: resume.education.length,
    certificationCount: resume.certifications.length,
  };
}

/**
 * Computes non-blocking editorial guidance warnings against recommended writing budgets.
 * Invariant: Warnings never cause structural schema validation to fail.
 */
export function getContentIssues(resume: ResumeV1): Issue[] {
  const issues: Issue[] = [];
  const budgets = EDITORIAL_GUIDANCE;

  // Document title
  const titleChars = countCodePoints(resume.document.title);
  if (titleChars < budgets.document.title.recommendedMinChars || titleChars > budgets.document.title.recommendedMaxChars) {
    issues.push({
      code: 'GUIDANCE_TITLE_LENGTH',
      severity: 'warning',
      path: '/document/title',
      message: `Document title is ${titleChars} characters (recommended: ${budgets.document.title.recommendedMinChars}–${budgets.document.title.recommendedMaxChars}).`,
    });
  }

  // Profile headline
  if (resume.profile.headline) {
    const hlWords = countWords(resume.profile.headline);
    const hlChars = countCodePoints(resume.profile.headline);
    if (hlWords < budgets.profile.headline.recommendedMinWords || hlWords > budgets.profile.headline.recommendedMaxWords) {
      issues.push({
        code: 'GUIDANCE_HEADLINE_WORD_COUNT',
        severity: 'warning',
        path: '/profile/headline',
        message: `Headline has ${hlWords} words (recommended: ${budgets.profile.headline.recommendedMinWords}–${budgets.profile.headline.recommendedMaxWords} words).`,
      });
    }
    if (hlChars < budgets.profile.headline.recommendedMinChars || hlChars > budgets.profile.headline.recommendedMaxChars) {
      issues.push({
        code: 'GUIDANCE_HEADLINE_CHAR_COUNT',
        severity: 'warning',
        path: '/profile/headline',
        message: `Headline is ${hlChars} characters (recommended: ${budgets.profile.headline.recommendedMinChars}–${budgets.profile.headline.recommendedMaxChars}).`,
      });
    }
  }

  // Profile links
  const linkCount = resume.profile.links.length;
  if (linkCount > budgets.profile.recommendedLinks.max) {
    issues.push({
      code: 'GUIDANCE_EXCESSIVE_LINKS',
      severity: 'warning',
      path: '/profile/links',
      message: `Profile includes ${linkCount} links (recommended: ${budgets.profile.recommendedLinks.min}–${budgets.profile.recommendedLinks.max}).`,
    });
  }

  // Summary
  if (resume.summary) {
    const sumWords = countWords(resume.summary);
    const sumChars = countCodePoints(resume.summary);
    if (sumWords < budgets.summary.recommendedMinWords || sumWords > budgets.summary.recommendedMaxWords) {
      issues.push({
        code: 'GUIDANCE_SUMMARY_WORD_COUNT',
        severity: 'warning',
        path: '/summary',
        message: `Summary has ${sumWords} words (recommended: ${budgets.summary.recommendedMinWords}–${budgets.summary.recommendedMaxWords} words).`,
      });
    }
    if (sumChars < budgets.summary.recommendedMinChars || sumChars > budgets.summary.recommendedMaxChars) {
      issues.push({
        code: 'GUIDANCE_SUMMARY_CHAR_COUNT',
        severity: 'warning',
        path: '/summary',
        message: `Summary is ${sumChars} characters (recommended: ${budgets.summary.recommendedMinChars}–${budgets.summary.recommendedMaxChars}).`,
      });
    }
  }

  // Experience roles count
  const expCount = resume.experience.length;
  if (expCount < budgets.experience.recommendedRoles.min || expCount > budgets.experience.recommendedRoles.max) {
    issues.push({
      code: 'GUIDANCE_EXPERIENCE_ROLE_COUNT',
      severity: 'warning',
      path: '/experience',
      message: `Experience lists ${expCount} roles (recommended: ${budgets.experience.recommendedRoles.min}–${budgets.experience.recommendedRoles.max} roles).`,
    });
  }

  // Experience bullets
  resume.experience.forEach((e, i) => {
    const bCount = e.bullets.length;
    if (bCount < budgets.experience.recommendedBulletsPerRole.min || bCount > budgets.experience.recommendedBulletsPerRole.max) {
      issues.push({
        code: 'GUIDANCE_ROLE_BULLET_COUNT',
        severity: 'warning',
        path: `/experience/${i}/bullets`,
        message: `Role '${e.role}' has ${bCount} bullets (recommended: ${budgets.experience.recommendedBulletsPerRole.min}–${budgets.experience.recommendedBulletsPerRole.max}).`,
      });
    }

    e.bullets.forEach((bullet, bi) => {
      const bWords = countWords(bullet);
      const bChars = countCodePoints(bullet);
      if (bWords < budgets.experience.bullet.recommendedMinWords || bWords > budgets.experience.bullet.recommendedMaxWords) {
        issues.push({
          code: 'GUIDANCE_BULLET_WORD_COUNT',
          severity: 'warning',
          path: `/experience/${i}/bullets/${bi}`,
          message: `Bullet has ${bWords} words (recommended: ${budgets.experience.bullet.recommendedMinWords}–${budgets.experience.bullet.recommendedMaxWords} words).`,
        });
      }
      if (bChars < budgets.experience.bullet.recommendedMinChars || bChars > budgets.experience.bullet.recommendedMaxChars) {
        issues.push({
          code: 'GUIDANCE_BULLET_CHAR_COUNT',
          severity: 'warning',
          path: `/experience/${i}/bullets/${bi}`,
          message: `Bullet is ${bChars} characters (recommended: ${budgets.experience.bullet.recommendedMinChars}–${budgets.experience.bullet.recommendedMaxChars}).`,
        });
      }
    });
  });

  // Project bullets
  resume.projects.forEach((p, i) => {
    p.bullets.forEach((bullet, bi) => {
      const bWords = countWords(bullet);
      const bChars = countCodePoints(bullet);
      if (bWords < budgets.projects.bullet.recommendedMinWords || bWords > budgets.projects.bullet.recommendedMaxWords) {
        issues.push({
          code: 'GUIDANCE_PROJECT_BULLET_WORD_COUNT',
          severity: 'warning',
          path: `/projects/${i}/bullets/${bi}`,
          message: `Project bullet has ${bWords} words (recommended: ${budgets.projects.bullet.recommendedMinWords}–${budgets.projects.bullet.recommendedMaxWords} words).`,
        });
      }
      if (bChars < budgets.projects.bullet.recommendedMinChars || bChars > budgets.projects.bullet.recommendedMaxChars) {
        issues.push({
          code: 'GUIDANCE_PROJECT_BULLET_CHAR_COUNT',
          severity: 'warning',
          path: `/projects/${i}/bullets/${bi}`,
          message: `Project bullet is ${bChars} characters (recommended: ${budgets.projects.bullet.recommendedMinChars}–${budgets.projects.bullet.recommendedMaxChars}).`,
        });
      }
    });
  });

  // Skills
  const skillCount = resume.skills.length;
  if (skillCount > 0 && (skillCount < budgets.skills.recommendedGroups.min || skillCount > budgets.skills.recommendedGroups.max)) {
    issues.push({
      code: 'GUIDANCE_SKILL_GROUP_COUNT',
      severity: 'warning',
      path: '/skills',
      message: `Skills list has ${skillCount} categories (recommended: ${budgets.skills.recommendedGroups.min}–${budgets.skills.recommendedGroups.max}).`,
    });
  }

  resume.skills.forEach((s, i) => {
    const itemCount = s.items.length;
    if (itemCount < budgets.skills.recommendedItemsPerGroup.min || itemCount > budgets.skills.recommendedItemsPerGroup.max) {
      issues.push({
        code: 'GUIDANCE_SKILL_ITEM_COUNT',
        severity: 'warning',
        path: `/skills/${i}/items`,
        message: `Category '${s.category}' has ${itemCount} items (recommended: ${budgets.skills.recommendedItemsPerGroup.min}–${budgets.skills.recommendedItemsPerGroup.max}).`,
      });
    }
  });

  return issues;
}
