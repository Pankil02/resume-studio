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
- **Interactive in-place browser editing**: In preview, click **Edit Resume** to visually modify text directly on page. Click **Save** to atomically persist changes back to `resume.json`.
- **Export to PDF**: In browser preview, click **Save / Download PDF** (`window.print()`). Print dialog: A4, 100% scale, margins: none.
- **Update / replace skill files**: Run `bunx github:Pankil02/resume-studio update --yes` (or `bunx openresume update --yes`) to safely replace installed skill files (`.agents/skills/openresume/`, `.pi/skills/openresume/`, or global skills) with the latest release without modifying personal profile or existing resumes.

## 4. Brevity & Scannability Directives ("Less Text, Easy to Read" Policy)
Recruiters review resumes in under 6 seconds. Heavy text blocks, wordy paragraphs, and laundry lists are rejected. When creating, editing, or tailoring resumes, agents MUST enforce these brevity directives:
- **Strict 1-Page Default**: Ensure resumes fit comfortably on 1 page with natural breathing room. Never shrink font size below 9.5pt to compensate for excess text.
- **Concise Summary**: Exactly 2 to 3 sentences maximum (30 to 45 words max). Focus solely on primary specialty, years of experience, and top core strengths. Zero generic filler ("passionate", "detail-oriented").
- **Bullet Count Limit**: 3 to 4 bullets per role maximum. Earlier roles should have 2 to 3 bullets. Never exceed 4 bullets.
- **Bullet Length**: 1 to 2 lines per bullet (15 to 25 words max). Keep sentences crisp, tight, and punchy.
- **Action-Metric-Outcome**: Always start with a strong action verb (e.g., *Built*, *Optimized*, *Reduced*, *Automated*, *Engineered*) and include quantifiable metrics (%, numbers, scale).
- **Key Achievements (Executive)**: Exactly 1 to 2 standout highlights, 1 crisp sentence each with specific quantified results (e.g., "*Reduced waste by 30% through inventory optimization*").
- **Skills Categorization**: 3 to 5 clear categories with relevant tools. Avoid kitchen-sink keyword stuffing.
- **Vertical Rhythm & Whitespace**: Preserve clean line heights, consistent section margins, and comfortable whitespace so the document is immediately effortless to scan.

