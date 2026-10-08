---
name: resume-studio
description: Standalone AI coding agent skill for creating, editing, and validating ATS-optimized professional resumes conforming to Resume Studio format (schemaVersion 1). Works with Pi, Antigravity, and Claude Code on any computer without repository dependencies.
---

# Resume Studio Agent Skill

A self-contained skill for crafting, modifying, and validating ATS-first professional resumes compatible with the [Resume Studio](https://resume-studio.pages.dev) editor and A4 HTML live viewer.

## Core Directives & Truth Policy

1. **Never Invent Facts:**
   - Never fabricate companies, job titles, employment dates, degrees, certifications, metrics, or technologies.
   - If user input lacks specific figures or dates, leave optional fields empty or prompt the user for real factual context.
   - Preserve existing true statements; do not remove verifiable achievements.

2. **Action Verbs & Quantified Metrics:**
   - Start every experience and project bullet with a strong, precise past-tense action verb (*Architected, Spearheaded, Engineered, Optimized, Delivered*).
   - Quantify scope and business impact (*reduced p99 latency by 45%*, *scaled to 120 enterprise tenants*, *cut release cycles from 2 weeks to 2 hours*).
   - Avoid passive voice, conversational filler, and generic corporate buzzwords.

3. **Page Budget & Length Limits:**
   - **1-Page Target (`maxPages: 1`):**
     - Target 2–3 roles.
     - 3–4 concise bullets per role (maximum 5).
     - 1–2 projects or education highlights.
     - Summary: 40–70 words (or omit if space is tight).
   - **2-Page Target (`maxPages: 2`):**
     - Target 3–5 roles.
     - 4–5 bullets for senior/current roles; 2–3 bullets for earlier roles.
     - Summary: 50–75 words.

4. **Preserve Stable Identifiers (`id`):**
   - Each item in `links`, `experience`, `education`, `projects`, `skills`, and `certifications` requires a unique `id` matching `^[a-z][a-z0-9-]{1,47}$` (e.g. `exp-acme-lead`, `edu-ucb-bs`, `proj-engine`).
   - When updating or reordering existing items, preserve their existing IDs to avoid breaking UI state and change tracking.

---

## Document Schema & Structure

A Resume Studio document is a single JSON file (`resume.json`) containing:

```json
{
  "schemaVersion": 1,
  "document": {
    "title": "Full Name — Target Role Title",
    "template": "classic",
    "maxPages": 1,
    "accent": "slate",
    "paperSize": "a4",
    "margin": "narrow"
  },
  "profile": {
    "name": "Full Name",
    "headline": "Target Professional Title / Specialty",
    "email": "user@example.com",
    "phone": "+1-555-0100",
    "location": "City, State",
    "links": [
      { "id": "link-gh", "label": "GitHub", "url": "https://github.com/username" },
      { "id": "link-li", "label": "LinkedIn", "url": "https://linkedin.com/in/username" }
    ]
  },
  "summary": "High-density 2-3 sentence overview of experience, engineering focus, and core technical strengths.",
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
      "id": "exp-company-role",
      "employer": "Company Name",
      "role": "Title",
      "location": "City, State",
      "start": "2021-06",
      "current": true,
      "bullets": [
        "Led team of 6 engineers delivering distributed storage service with 99.99% availability.",
        "Engineered zero-copy streaming pipeline cutting memory footprint by 40% under peak load."
      ]
    }
  ],
  "education": [
    {
      "id": "edu-degree",
      "institution": "University Name",
      "qualification": "B.S. in Computer Science",
      "location": "City, State",
      "start": "2015-09",
      "end": "2019-05",
      "details": ["Honors / Dean's List", "Relevant Focus: Distributed Systems"]
    }
  ],
  "projects": [
    {
      "id": "proj-name",
      "name": "Project Name",
      "role": "Creator & Maintainer",
      "url": "https://github.com/...",
      "bullets": [
        "Open-source TypeScript library with 450+ stars achieving 1.2M monthly npm downloads."
      ]
    }
  ],
  "skills": [
    {
      "id": "skills-languages",
      "category": "Languages",
      "items": ["TypeScript", "Go", "Python", "SQL", "Rust"]
    },
    {
      "id": "skills-cloud",
      "category": "Cloud & Infrastructure",
      "items": ["AWS", "Docker", "Kubernetes", "PostgreSQL", "Redis", "Cloudflare"]
    }
  ],
  "certifications": [
    {
      "id": "cert-aws",
      "name": "AWS Certified Solutions Architect – Associate",
      "issuer": "Amazon Web Services",
      "date": "2023-05",
      "url": "https://example.com/cert"
    }
  ]
}
```

### Supported Templates
- `classic`: Single-column serif layout with LaTeX-style horizontal dividing rules. Highest ATS compatibility.
- `modern`: Single-column clean sans-serif layout with subtle section accents.
- `executive`: Two-column layout with a compact sidebar on Page 1 for skills and certifications.

### Supported Accents
- `slate` (default warm neutral)
- `ocean` (deep slate navy blue)
- `forest` (subtle dark spruce green)
- `amber` (warm earthen amber)
- `navy` (refined midnight navy)

### Supported Margins & Paper Sizes
- Margins: `normal` (18mm), `narrow` (14mm), `compact` (10mm). Default is `narrow`.
- Paper Sizes: `a4` (210 × 297 mm) or `letter` (8.5 × 11 in).

---

## Validation Workflow

Always validate the JSON file after making edits:

```bash
# Using bun
bun skills/resume-studio/validate.mjs resume.json

# Using node
node skills/resume-studio/validate.mjs resume.json
```

If validation fails, the script will output the exact JSON path and error reason. Fix all reported errors before concluding.

---

## Standalone Installation

To use this skill independently in your personal environment without this repository:

```bash
# For Pi agent:
mkdir -p ~/.pi/skills/resume-studio
cp -r skills/resume-studio/* ~/.pi/skills/resume-studio/

# For Claude Code / Antigravity:
mkdir -p ~/.agents/skills/resume-studio
cp -r skills/resume-studio/* ~/.agents/skills/resume-studio/
```
