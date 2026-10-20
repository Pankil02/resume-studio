# Content Guide — Resume Studio

This guide outlines the hard schema constraints, recommended writing budgets, ATS readability guidelines, and editorial advice for Resume Studio documents.

---

## 1. Hard Bounds & Editorial Budgets

Counts are measured in Unicode code points (astral planes and emoji are treated safely as single code points). Word budgets are whitespace-separated words.

| Field / Group | Hard Schema Bounds | Recommended Editorial Budget | Purpose / Advice |
| :--- | :--- | :--- | :--- |
| **Whole Document** | 128 KiB UTF-8; Version 1 | 5–30 KiB | Strict security and memory limit. |
| **Document Title** | 1–100 characters | 20–60 characters | Descriptive title used for filename and header. |
| **Name** | 1–100 characters | Full legal or preferred name | Plain text name; no honorary prefixes. |
| **Headline** | 1–120 characters | 40–80 chars (5–12 words) | Target job title or core engineering discipline. |
| **Email** | 3–254 characters | Clean professional address | Standard RFC-compliant email; no `mailto:` prefix. |
| **Phone** | 1–40 characters | Standard international format | e.g. `+1-555-0199`. |
| **Location** | 1–100 characters | City, State / Country | General metropolitan area; avoid street addresses. |
| **Profile Links** | Max 4 links | 1–3 links | Short labels (≤40 chars) and clean HTTPS URLs. |
| **Summary** | Max 900 characters | 250–500 chars (40–75 words) | Factual summary; omit rather than generic fluff. |
| **Experience Roles** | Max 12 positions | 2–4 recent positions | Focus on high-relevance roles. |
| **Role / Employer** | 1–100 characters each | Official title and organization | Accurate names without acronym ambiguity. |
| **Experience Bullets** | Max 8 bullets per role | 3–5 bullets for recent role | Action verb + technical context + measurable result. |
| **Bullet Content** | 1–360 characters | 90–180 chars (15–30 words) | One strong bullet per accomplishment. |
| **Education Entries** | Max 6 entries | 1–3 degrees | Higher education degrees and institutions. |
| **Institution / Degree** | 1–140 characters each | Formal university & title | Official institution name and degree title. |
| **Education Details** | Max 3 per entry (≤240 chars) | 0–2 details | Honors, GPA, thesis topic, or notable awards. |
| **Projects** | Max 8 projects | 1–3 high-signal projects | Key open-source software or engineering artifacts. |
| **Project Bullets** | Max 6 bullets per project | 1–3 bullets | Architecture, tools used, and impact. |
| **Skill Categories** | Max 8 categories | 3–5 categories | Logical clusters (e.g. Languages, Cloud, Data). |
| **Skills per Group** | 1–15 items (≤60 chars each) | 4–8 items | High-signal keywords. No subjective rating bars. |
| **Certifications** | Max 12 credentials | 0–4 credentials | Active, verifiable credentials and issuer. |

---

## 2. Writing High-Impact Bullets

Resume Studio emphasizes **factual, measurable engineering achievements**:

- **Strong Action Verbs:** Start each bullet with a direct past-tense action verb (e.g. *Architected*, *Engineered*, *Led*, *Refactored*, *Optimized*, *Automated*, *Designed*).
- **The Google XYZ Formula:** *"Accomplished [X], as measured by [Y], by doing [Z]."*
  - *Weak:* "Worked on backend microservices using Node.js and improved performance."
  - *Strong:* "Refactored legacy serialization pipeline to Protocol Buffers, reducing p99 latency by 35% across 14 internal microservices."
- **Context & Constraints:** Mention real engineering trade-offs, scale, and tools.
- **Never Invent Facts:** Do not inflate numbers, fabricate percentages, or introduce unverified claims.

---

## 3. Template Selection & ATS Reading Order

### Classic Template (`classic`)
- **Layout:** Traditional single-column layout.
- **Typography:** System serif (`Georgia`, `"Times New Roman"`, `Times`, `serif`).
- **ATS Compatibility:** **Optimal (ATS-First).** Linear top-to-bottom reading order strictly follows document `sectionOrder`. Best for conservative industries, academia, and traditional corporate recruiters.

### Executive Template (`executive`)
- **Layout:**
  - **Page 1:** Full-width identity header, followed by a two-column body containing a primary chronological column (120 mm) and a compact sidebar (54 mm) containing Skills and Certifications.
  - **Page 2:** Full-width continuation (182 mm) containing remaining primary sections, followed by any spilled sidebar items.
- **ATS & Reading Order Caveat:**
  - Because Skills and Certifications are rendered in a physical sidebar on Page 1, some legacy text-extraction engines may extract sidebar content out of chronological sequence.
  - The DOM order is strictly defined as: `Header → Primary Column → Sidebar Column → Page 2 Continuation`.

---

## 4. Formatting Invariants

1. **No Markdown or HTML:** Do not use bold (`**`), italics (`*`), bullet markers (`-`, `•`), or inline links (`[text](url)`). The renderer automatically structures headings, bullets, and typography.
2. **Absolute URLs Only:** External links must be valid `https://` or `http://` URLs. Schemes like `javascript:`, `data:`, and `file:` are strictly rejected. Embedded credentials (`user:pass@`) are forbidden.
3. **No Empty Strings:** Omit optional keys rather than assigning empty strings (`""`) or whitespace. The form editor and CLI validate that all populated string fields contain non-whitespace characters.
