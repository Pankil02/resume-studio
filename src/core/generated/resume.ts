/* eslint-disable */
/**
 * Auto-generated from schema/resume.schema.json. Do not edit directly.
 * Run `bun run generate` or `npm run generate` to regenerate.
 */

/**
 * Template layout: classic (single-column LaTeX/SWE format) or executive (two-column modern format matching Enhancv layout).
 *
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "TemplateId".
 */
export type TemplateId = 'classic' | 'executive';
/**
 * Page budget ceiling (1 or 2 pages).
 *
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "MaxPages".
 */
export type MaxPages = 1 | 2;
/**
 * Restrained accent color for section headings and rules.
 *
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "AccentColor".
 */
export type AccentColor = 'slate' | 'navy' | 'forest' | 'ocean';
/**
 * Page margin mode: narrow (10mm, default), normal (14mm), compact/very-narrow (7mm), or custom.
 *
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "MarginMode".
 */
export type MarginMode = 'narrow' | 'normal' | 'compact' | 'very-narrow' | 'custom';
/**
 * Page paper size format: a4 (210 x 297 mm, International standard) or letter (215.9 x 279.4 mm / 8.5 x 11 in, North American standard).
 *
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "PaperSize".
 */
export type PaperSize = 'a4' | 'letter';
/**
 * Unique identifier for top-level resume sections.
 *
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "SectionId".
 */
export type SectionId = 'summary' | 'experience' | 'education' | 'projects' | 'skills' | 'certifications';

/**
 * Canonical schema for Resume Studio document format (version 1).
 */
export interface ResumeV1 {
  /**
   * Resume Studio schema format version. Must be exactly 1.
   */
  schemaVersion: 1;
  document: DocumentConfig;
  profile: ProfileConfig;
  /**
   * Optional professional summary paragraph.
   */
  summary?: string;
  /**
   * Rendering order of sections. Exactly all six section identifiers must appear once.
   *
   * @minItems 6
   * @maxItems 6
   */
  sectionOrder: [SectionId, SectionId, SectionId, SectionId, SectionId, SectionId];
  /**
   * Chronological professional work history.
   *
   * @maxItems 12
   */
  experience:
    | []
    | [ExperienceItem]
    | [ExperienceItem, ExperienceItem]
    | [ExperienceItem, ExperienceItem, ExperienceItem]
    | [ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem]
    | [ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem]
    | [ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem]
    | [ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem, ExperienceItem]
    | [
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem
      ]
    | [
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem
      ]
    | [
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem
      ]
    | [
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem
      ]
    | [
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem,
        ExperienceItem
      ];
  /**
   * Academic qualifications and degrees.
   *
   * @maxItems 6
   */
  education:
    | []
    | [EducationItem]
    | [EducationItem, EducationItem]
    | [EducationItem, EducationItem, EducationItem]
    | [EducationItem, EducationItem, EducationItem, EducationItem]
    | [EducationItem, EducationItem, EducationItem, EducationItem, EducationItem]
    | [EducationItem, EducationItem, EducationItem, EducationItem, EducationItem, EducationItem];
  /**
   * Selected key projects.
   *
   * @maxItems 8
   */
  projects:
    | []
    | [ProjectItem]
    | [ProjectItem, ProjectItem]
    | [ProjectItem, ProjectItem, ProjectItem]
    | [ProjectItem, ProjectItem, ProjectItem, ProjectItem]
    | [ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem]
    | [ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem]
    | [ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem]
    | [ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem, ProjectItem];
  /**
   * Categorized professional proficiencies.
   *
   * @maxItems 12
   */
  skills:
    | []
    | [SkillGroup]
    | [SkillGroup, SkillGroup]
    | [SkillGroup, SkillGroup, SkillGroup]
    | [SkillGroup, SkillGroup, SkillGroup, SkillGroup]
    | [SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup]
    | [SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup]
    | [SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup]
    | [SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup]
    | [SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup, SkillGroup]
    | [
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup
      ]
    | [
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup
      ]
    | [
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup,
        SkillGroup
      ];
  /**
   * Professional certifications and licenses.
   *
   * @maxItems 12
   */
  certifications:
    | []
    | [CertificationItem]
    | [CertificationItem, CertificationItem]
    | [CertificationItem, CertificationItem, CertificationItem]
    | [CertificationItem, CertificationItem, CertificationItem, CertificationItem]
    | [CertificationItem, CertificationItem, CertificationItem, CertificationItem, CertificationItem]
    | [CertificationItem, CertificationItem, CertificationItem, CertificationItem, CertificationItem, CertificationItem]
    | [
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem
      ]
    | [
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem
      ]
    | [
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem
      ]
    | [
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem
      ]
    | [
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem
      ]
    | [
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem,
        CertificationItem
      ];
}
/**
 * Document-level metadata and presentation configuration.
 */
export interface DocumentConfig {
  /**
   * Document title used for editor display and sanitized export filename.
   */
  title: string;
  template: TemplateId;
  maxPages: MaxPages;
  accent: AccentColor;
  margin?: MarginMode;
  paperSize?: PaperSize;
  /**
   * Custom page margin in millimeters when margin mode is custom.
   */
  customMarginMm?: number;
  /**
   * Optional compact margin mode (boolean legacy flag).
   */
  reduceMargin?: boolean;
}
/**
 * Identity and contact details.
 */
export interface ProfileConfig {
  /**
   * Candidate full name.
   */
  name: string;
  /**
   * Professional headline or target role.
   */
  headline?: string;
  /**
   * Contact email address.
   */
  email?: string;
  /**
   * Contact phone number.
   */
  phone?: string;
  /**
   * Geographic location (city, state/region, country).
   */
  location?: string;
  /**
   * Up to 4 professional web links.
   *
   * @maxItems 4
   */
  links:
    | []
    | [ProfileLink]
    | [ProfileLink, ProfileLink]
    | [ProfileLink, ProfileLink, ProfileLink]
    | [ProfileLink, ProfileLink, ProfileLink, ProfileLink];
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "ProfileLink".
 */
export interface ProfileLink {
  /**
   * Stable item identifier.
   */
  id: string;
  /**
   * Human-readable label for the link.
   */
  label: string;
  /**
   * Absolute web URL.
   */
  url: string;
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "ExperienceItem".
 */
export interface ExperienceItem {
  /**
   * Stable item identifier.
   */
  id: string;
  /**
   * Name of employer or organization.
   */
  employer: string;
  /**
   * Job title or role.
   */
  role: string;
  /**
   * Role location.
   */
  location?: string;
  /**
   * Start date in YYYY-MM format.
   */
  start: string;
  /**
   * End date in YYYY-MM format. Forbidden when current is true.
   */
  end?: string;
  /**
   * True if this is the current active role.
   */
  current?: boolean;
  /**
   * Optional company logo image (safe data URL or URL).
   */
  icon?: string;
  /**
   * Achievement bullet points.
   *
   * @maxItems 8
   */
  bullets:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string];
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "EducationItem".
 */
export interface EducationItem {
  /**
   * Stable item identifier.
   */
  id: string;
  /**
   * University, college, or school.
   */
  institution: string;
  /**
   * Degree, diploma, or field of study.
   */
  qualification: string;
  /**
   * Institution location.
   */
  location?: string;
  /**
   * Start date in YYYY-MM format.
   */
  start?: string;
  /**
   * End date in YYYY-MM format.
   */
  end?: string;
  /**
   * Optional institution logo image (safe data URL or URL).
   */
  icon?: string;
  /**
   * Honors, GPA, coursework, or activities.
   *
   * @maxItems 3
   */
  details: [] | [string] | [string, string] | [string, string, string];
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "ProjectItem".
 */
export interface ProjectItem {
  /**
   * Stable item identifier.
   */
  id: string;
  /**
   * Project title.
   */
  name: string;
  /**
   * Role in project (e.g. Creator, Lead).
   */
  role?: string;
  /**
   * Project link or repository.
   */
  url?: string;
  /**
   * Project achievement bullets.
   *
   * @maxItems 6
   */
  bullets:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string];
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "SkillGroup".
 */
export interface SkillGroup {
  /**
   * Stable item identifier.
   */
  id: string;
  /**
   * Skill category name (e.g. Languages, Frameworks, Cloud).
   */
  category: string;
  /**
   * Individual skills in this category.
   *
   * @minItems 1
   * @maxItems 15
   */
  items:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
      ];
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "CertificationItem".
 */
export interface CertificationItem {
  /**
   * Stable item identifier.
   */
  id: string;
  /**
   * Certification name.
   */
  name: string;
  /**
   * Issuing organization.
   */
  issuer?: string;
  /**
   * Issue date in YYYY-MM format.
   */
  date?: string;
  /**
   * Verification or credential URL.
   */
  url?: string;
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "DocumentConfig".
 */
export interface DocumentConfig1 {
  /**
   * Document title used for editor display and sanitized export filename.
   */
  title: string;
  template: TemplateId;
  maxPages: MaxPages;
  accent: AccentColor;
  margin?: MarginMode;
  paperSize?: PaperSize;
  /**
   * Custom page margin in millimeters when margin mode is custom.
   */
  customMarginMm?: number;
  /**
   * Optional compact margin mode (boolean legacy flag).
   */
  reduceMargin?: boolean;
}
/**
 * This interface was referenced by `ResumeV1`'s JSON-Schema
 * via the `definition` "ProfileConfig".
 */
export interface ProfileConfig1 {
  /**
   * Candidate full name.
   */
  name: string;
  /**
   * Professional headline or target role.
   */
  headline?: string;
  /**
   * Contact email address.
   */
  email?: string;
  /**
   * Contact phone number.
   */
  phone?: string;
  /**
   * Geographic location (city, state/region, country).
   */
  location?: string;
  /**
   * Up to 4 professional web links.
   *
   * @maxItems 4
   */
  links:
    | []
    | [ProfileLink]
    | [ProfileLink, ProfileLink]
    | [ProfileLink, ProfileLink, ProfileLink]
    | [ProfileLink, ProfileLink, ProfileLink, ProfileLink];
}
