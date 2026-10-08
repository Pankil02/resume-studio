import type {
  ResumeV1,
  TemplateId,
  MaxPages,
  AccentColor,
  MarginMode,
  PaperSize,
  SectionId,
} from './generated/resume.js';

export const DEFAULT_SECTION_ORDER: [
  SectionId,
  SectionId,
  SectionId,
  SectionId,
  SectionId,
  SectionId
] = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'certifications',
];

/**
 * Creates a minimal valid blank resume document.
 */
export function createBlankResume(
  template: TemplateId = 'classic',
  maxPages: MaxPages = 1,
  accent: AccentColor = 'slate',
  margin: MarginMode = 'narrow',
  paperSize: PaperSize = 'a4'
): ResumeV1 {
  return {
    schemaVersion: 1,
    document: {
      title: 'Blank Resume',
      template,
      maxPages,
      accent,
      margin,
      paperSize,
    },
    profile: {
      name: 'Full Name',
      links: [],
    },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
  };
}

/**
 * Creates a fully valid synthetic starter resume document with fictional demonstration data.
 */
export function createFictionalStarter(
  template: TemplateId = 'classic',
  maxPages: MaxPages = 1,
  accent: AccentColor = 'slate',
  margin: MarginMode = 'narrow',
  paperSize: PaperSize = 'a4'
): ResumeV1 {
  return {
    schemaVersion: 1,
    document: {
      title: 'Fictional Software Engineer Resume',
      template,
      maxPages,
      accent,
      margin,
      paperSize,
    },
    profile: {
      name: 'Jordan Sample',
      headline: 'Senior Systems & Full-Stack Software Engineer',
      email: 'jordan.sample@example.invalid',
      phone: '+1-555-0199',
      location: 'Seattle, WA',
      links: [
        {
          id: 'link-portfolio',
          label: 'Portfolio',
          url: 'https://example.com/jordansample',
        },
        {
          id: 'link-github',
          label: 'GitHub',
          url: 'https://example.com/github-sample',
        },
      ],
    },
    summary:
      'Demonstration resume profile for software engineering roles. Highlights experience in high-throughput distributed systems, reproducible frontend architecture, and automated test pipelines. Fictional sample data.',
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    experience: [
      {
        id: 'exp-principal-eng',
        employer: 'Nimbus Distributed Systems',
        role: 'Staff Software Engineer',
        location: 'Seattle, WA',
        start: '2022-04',
        current: true,
        bullets: [
          'Architected high-throughput message routing service processing 45,000 events/second with sub-10ms p99 latency.',
          'Migrated legacy monolithic workflow orchestration to typed, event-driven pipelines, eliminating redundant background workers.',
          'Mentored eight engineers on distributed consensus, deterministic replay testing, and observable telemetry architectures.',
        ],
      },
      {
        id: 'exp-senior-eng',
        employer: 'Cascade Data Labs',
        role: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        start: '2019-06',
        end: '2022-03',
        bullets: [
          'Engineered streaming data ingestion microservice handling 12 TB daily across multi-region object storage.',
          'Decreased automated end-to-end regression test suite execution time by 58% through isolated containerized fixtures.',
          'Authored comprehensive RFCs and system boundary guidelines for developer tooling platform adopted company-wide.',
        ],
      },
    ],
    education: [
      {
        id: 'edu-university',
        institution: 'Pacific Northwest University',
        qualification: 'B.S. in Computer Science',
        location: 'Seattle, WA',
        start: '2015-09',
        end: '2019-05',
        details: [
          'Graduated Magna Cum Laude with departmental honors.',
          'Focus on distributed systems and compiler design.',
        ],
      },
    ],
    projects: [
      {
        id: 'proj-resumed',
        name: 'Deterministic Test Pipeline Engine',
        role: 'Creator & Maintainer',
        url: 'https://example.com/projects/test-engine',
        bullets: [
          'Designed open-source reproducible containerized testing framework with over 1,200 stars on demonstration repository.',
          'Reduced CI pipeline flakiness to under 0.1% across 10,000 monthly builds by eliminating network flakiness.',
        ],
      },
    ],
    skills: [
      {
        id: 'skills-languages',
        category: 'Languages & Core',
        items: ['TypeScript', 'Node.js', 'Go', 'Rust', 'Python', 'SQL'],
      },
      {
        id: 'skills-infrastructure',
        category: 'Infrastructure & Tools',
        items: ['Docker', 'Kubernetes', 'Linux', 'Vite', 'Git', 'CI/CD Pipelines'],
      },
      {
        id: 'skills-architecture',
        category: 'Architecture & Practices',
        items: ['Distributed Systems', 'Domain-Driven Design', 'Event-Driven Systems', 'Performance Profiling'],
      },
    ],
    certifications: [
      {
        id: 'cert-cloud-architect',
        name: 'Certified Cloud Solutions Architect',
        issuer: 'Cloud Standards Institute',
        date: '2023-08',
        url: 'https://example.com/certs/cloud-arch-sample',
      },
    ],
  };
}
