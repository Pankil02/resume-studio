/**
 * Core AI prompt builder for Resume Studio.
 * Generates comprehensive, schema-constrained prompts for LLMs (Claude, ChatGPT, Gemini, etc.)
 * that produce valid ResumeV1 JSON documents for seamless import.
 */

import type { ResumeV1, TemplateId, MaxPages, AccentColor } from './generated/resume.js';

export interface AiPromptOptions {
  /** Target page budget ceiling: 1 or 2 pages (default: 1) */
  targetPages?: MaxPages | undefined;
  /** Template identifier: classic (LaTeX / SWE, default: 'classic') */
  template?: TemplateId | undefined;
  /** Restrained accent color: slate, navy, forest (default: 'slate') */
  accent?: AccentColor | undefined;
  /** Optional job description or role focus to tailor for */
  targetRoleOrJobDescription?: string | undefined;
  /** Optional reference resume document to include as context/draft */
  referenceResume?: ResumeV1 | undefined;
}

/**
 * Builds an authoritative, schema-enforcing prompt for any AI assistant.
 * Guides the model on exact JSON structure, data types, date formatting,
 * stable item IDs, character bounds, and output format.
 */
export function buildAiResumePrompt(options: AiPromptOptions = {}): string {
  const targetPages = options.targetPages ?? 1;
  const template = options.template ?? 'classic';
  const accent = options.accent ?? 'slate';
  const targetRole = options.targetRoleOrJobDescription?.trim();
  const reference = options.referenceResume;

  const exampleJson = `{
  "schemaVersion": 1,
  "document": {
    "title": "Jane Doe — Senior Software Engineer",
    "template": "${template}",
    "maxPages": ${targetPages},
    "accent": "${accent}"
  },
  "profile": {
    "name": "Jane Doe",
    "headline": "Senior Software Engineer & Distributed Systems Developer",
    "email": "jane.doe@example.com",
    "phone": "+1-555-0199",
    "location": "San Francisco, CA",
    "links": [
      {
        "id": "link-linkedin",
        "label": "LinkedIn",
        "url": "https://linkedin.com/in/janedoe"
      },
      {
        "id": "link-github",
        "label": "GitHub",
        "url": "https://github.com/janedoe"
      }
    ]
  },
  "summary": "Full-stack engineer with over 6 years of experience architecting resilient cloud services and low-latency APIs. Proven track record leading distributed microservices and improving system reliability.",
  "sectionOrder": [
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "certifications"
  ],
  "experience": [
    {
      "id": "exp-stripe-lead",
      "employer": "Stripe",
      "role": "Senior Software Engineer",
      "location": "San Francisco, CA",
      "start": "2022-03",
      "current": true,
      "bullets": [
        "Architected telemetry processing pipeline handling 15,000 events/second with 99.99% availability.",
        "Refactored query execution caching, reducing p99 API response latency from 380ms to 45ms.",
        "Mentored 4 junior engineers and standardized integration testing across 8 backend repositories."
      ]
    },
    {
      "id": "exp-uber-eng",
      "employer": "Uber Technologies",
      "role": "Software Engineer II",
      "location": "Seattle, WA",
      "start": "2019-06",
      "end": "2022-02",
      "bullets": [
        "Engineered real-time dispatch matching microservice in Go, processing 25,000 requests/minute.",
        "Automated CI/CD deployment pipelines on Kubernetes, shortening release cycle from 3 days to 40 minutes."
      ]
    }
  ],
  "education": [
    {
      "id": "edu-berkeley",
      "institution": "University of California, Berkeley",
      "qualification": "B.S. in Computer Science",
      "location": "Berkeley, CA",
      "start": "2015-08",
      "end": "2019-05",
      "details": [
        "Graduated Magna Cum Laude; Regents' and Chancellor's Scholarship.",
        "Capstone: Distributed consensus engine using Raft protocol."
      ]
    }
  ],
  "projects": [
    {
      "id": "proj-fastkv",
      "name": "FastKV Memory Cache",
      "role": "Lead Maintainer",
      "url": "https://github.com/janedoe/fastkv",
      "bullets": [
        "Built zero-dependency in-memory cache achieving 1.2M operations/sec with lock-free data structures.",
        "Featured in Weekly Go Newsletter and adopted by 3 enterprise production services."
      ]
    }
  ],
  "skills": [
    {
      "id": "sk-languages",
      "category": "Programming Languages",
      "items": ["TypeScript", "Go", "Python", "Rust", "SQL", "HTML/CSS"]
    },
    {
      "id": "sk-infrastructure",
      "category": "Cloud & Infrastructure",
      "items": ["AWS", "Docker", "Kubernetes", "PostgreSQL", "Redis", "Kafka"]
    },
    {
      "id": "sk-practices",
      "category": "Engineering Practices",
      "items": ["Distributed Systems", "TDD", "CI/CD", "REST & gRPC", "System Architecture"]
    }
  ],
  "certifications": [
    {
      "id": "cert-aws-sa",
      "name": "AWS Certified Solutions Architect – Professional",
      "issuer": "Amazon Web Services",
      "date": "2023-05",
      "url": "https://aws.amazon.com/verification"
    }
  ]
}`;

  let targetRoleSection = '';
  if (targetRole) {
    targetRoleSection = `\n## TARGET ROLE / JOB SPECIFICATION FOCUS
Tailor the professional headline, summary, bullet points, and skills to highlight quantifiable achievements, domain keywords, and capabilities specifically relevant to the following role/description:
"""
${targetRole}
"""
`;
  }

  let referenceSection = '';
  if (reference) {
    referenceSection = `\n## EXISTING RESUME DRAFT (SOURCE OF TRUTH)
The user already has an existing resume draft in Resume Studio.
CRITICAL: You must preserve all verified facts, company names, dates, degrees, and existing item IDs. Polish the phrasing, strengthen bullet metrics, improve alignment with the target role, and ensure strict schema compliance:
\`\`\`json
${JSON.stringify(reference, null, 2)}
\`\`\`
`;
  } else {
    referenceSection = `\n## USER BACKGROUND DATA
Below is the raw resume, career history, or LinkedIn profile notes provided by the user. Convert this information into the required JSON structure.
[PASTE YOUR RAW RESUME TEXT, LINKEDIN PROFILE, OR WORK EXPERIENCE HERE]
`;
  }

  return `# TASK: Generate Resume Studio JSON (schemaVersion 1)

You are an expert resume writer, career strategist, and structured data formatter.
Your task is to take the user's professional background and output a strictly valid Resume Studio JSON document.

## CRITICAL OUTPUT CONSTRAINTS
1. Output ONLY a valid JSON object.
2. Enclose the JSON output in a single \`\`\`json ... \`\`\` code block (or return raw JSON without preamble, pleasantries, or follow-up text).
3. Plain text only: Do NOT use Markdown formatting (no bold **, italics *, bullets, or markdown links) and do NOT use HTML tags (<b>, <br>) inside string values.
4. Factual integrity: Never invent companies, dates, qualifications, degrees, metrics, or achievements. If details are missing, omit optional fields or leave empty arrays.
5. All dates must strictly use \`YYYY-MM\` format (e.g. "2023-04"). Never use full dates ("2023-04-15"), month names ("April 2023"), or text like "Present".
6. Current roles: Set \`"current": true\` and OMIT the \`"end"\` property completely.
7. Past roles: \`"current"\` must be false or omitted, and \`"end"\` is REQUIRED (\`YYYY-MM\`). Ensure \`start <= end\`.
8. Item IDs: Every object in \`links\`, \`experience\`, \`education\`, \`projects\`, \`skills\`, and \`certifications\` MUST have an \`id\` matching \`^[a-z][a-z0-9-]{1,47}$\` (lowercase kebab-case, e.g. "exp-google", "edu-mit", "sk-cloud"). Every ID must be unique across the entire document.
9. Section Order: \`"sectionOrder"\` must contain EXACTLY the following 6 section names:
   \`["summary", "experience", "education", "projects", "skills", "certifications"]\`
   (All 6 must be present. If a section has no entries, supply an empty array \`[]\`).
10. URLs: Must start with \`https://\` or \`http://\` and contain no embedded credentials.
11. Page Budget Ceiling: ${targetPages} Page(s).
    - Bullets: 2 to 4 high-impact bullets per role, maximum 360 characters per bullet. Start bullets with strong action verbs and include metrics/impact.
    - Single-line fields (title, employer, role, institution, bullet points) must NOT contain newline characters (\\n).
    - Summary: Optional concise paragraph (recommended 40–75 words, maximum 900 characters).

## JSON SCHEMA STRUCTURE EXAMPLE
Your output must conform to this exact JSON structure:
\`\`\`json
${exampleJson}
\`\`\`
${targetRoleSection}${referenceSection}
## INSTRUCTIONS FOR RESPONSE
Return ONLY the completed JSON object. Double-check that:
- \`schemaVersion\` is 1.
- All 6 sections exist in \`sectionOrder\`.
- All item \`id\` values are unique lowercase kebab-case strings.
- All dates use \`YYYY-MM\` format.
- Output contains no markdown inside string values.`;
}
