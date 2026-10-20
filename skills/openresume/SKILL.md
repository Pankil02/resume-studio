---
name: openresume
description: Create, tailor, validate, and compile ATS-optimized single/multi-page A4 resumes with persistent personal profile (~/.openresume/), interactive Classic/Executive template preview, and 1-click PDF export.
---

# openResume Agent Directives

## 1. Persistent Personal Profile Workflow (`~/.openresume/`)
- Check existing profile first: `bunx openresume profile show` (reads `~/.openresume/profile.md` & `resume.json`).
- If user provides a resume file (`.pdf`, `.txt`, `.md`, `.json`), import it: `bunx openresume profile import <path>`.
- If no saved profile exists, interview user for: full name, headline, contact (email, phone, location, links), work history (employer, role, dates, achievements/metrics), education, skills, and projects. Save both `~/.openresume/profile.md` and `~/.openresume/resume.json` so user details persist across all future sessions.
- **Truth Policy**: Never invent companies, dates, metrics, degrees, or links. Ask for missing details or omit optional fields.

## 2. Compact JSON Schema Contract (`schemaVersion: 1`)
```json
{
  "schemaVersion": 1,
  "document": {
    "title": "Full Name — Role",
    "template": "classic" | "executive",
    "maxPages": 1 | 2,
    "accent": "slate" | "navy" | "forest" | "ocean" | "amber",
    "margin": "narrow" | "normal" | "compact",
    "paperSize": "a4" | "letter"
  },
  "profile": {
    "name": "Full Name",
    "headline": "Target Role / Headline",
    "email": "user@example.com",
    "phone": "+1-555-0100",
    "location": "City, ST",
    "links": [{ "id": "link-github", "label": "GitHub", "url": "https://github.com/..." }]
  },
  "summary": "Optional 2-4 sentence career impact overview.",
  "sectionOrder": ["summary", "experience", "education", "projects", "skills", "certifications"],
  "experience": [{
    "id": "exp-1", "employer": "Company", "role": "Title", "location": "City, ST",
    "start": "YYYY-MM", "end": "YYYY-MM", "current": false,
    "bullets": ["**Action verb** + metric + outcome.", "**Led** ... resulting in 30% latency reduction."]
  }],
  "education": [{
    "id": "edu-1", "institution": "University", "qualification": "B.S. in Computer Science",
    "location": "City, ST", "start": "YYYY", "end": "YYYY", "details": ["Honors / GPA / Coursework"]
  }],
  "projects": [{
    "id": "proj-1", "name": "Project Name", "role": "Lead", "url": "https://...",
    "bullets": ["Engineered ... with **TypeScript** and **Node.js**."]
  }],
  "skills": [{ "id": "sk-1", "category": "Languages", "items": ["TypeScript", "Python", "Go"] }],
  "certifications": [{ "id": "cert-1", "name": "AWS Certified Solutions Architect", "issuer": "Amazon Web Services", "date": "YYYY-MM", "url": "https://..." }]
}
```
*Constraints*: All item IDs must match `^[a-z][a-z0-9-]{1,47}$` and be unique across the document. Dates: `YYYY` or `YYYY-MM`. All 6 sections must appear once in `sectionOrder`. Use `**bold**` for key skills/metrics inside bullets.

## 3. Workflow Commands
- **Initialize workspace resume**: `bunx openresume init resume.json` (uses `~/.openresume/resume.json` if available, else starter).
- **Validate after edits**: `bunx openresume validate resume.json`
- **Render interactive HTML**: `bunx openresume render resume.json --open` (includes live Classic/Executive toggle, accent/margin selectors, and PDF print button).
- **Live-reload preview during iteration**: `bunx openresume preview resume.json --open` (SSE auto-refreshes on JSON edit).
- **Export to PDF**: In browser preview, click **Save / Download PDF** (`window.print()`). Print dialog: A4, 100% scale, margins: none.
