/**
 * Templates Gallery View
 * Displays the canonical single-column LaTeX/SWE resume template in card view
 * with large, crisp A4 preview image matching the standard Software Engineering layout.
 */

import { listTemplates, type TemplateDefinition } from '../core/templates.js';
import type { TemplateId } from '../core/generated/resume.js';

/**
 * Generates a high-definition vector SVG representation of the LaTeX/SWE template.
 * Ratio 210:297 (canonical A4).
 */
function getClassicPreviewSvg(): string {
  return `
<svg viewBox="0 0 420 594" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="LaTeX/SWE Template Preview">
  <defs>
    <filter id="classic-shadow" x="-4%" y="-2%" width="108%" height="106%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- A4 Paper Base -->
  <rect x="10" y="10" width="400" height="574" rx="3" fill="#ffffff" filter="url(#classic-shadow)" stroke="#cbd5e1" stroke-width="1"/>

  <!-- Content: Margins ~12.7mm (28px) -->
  <g transform="translate(36, 30)" font-family="'Times New Roman', Times, serif">
    <!-- Header: Centered -->
    <text x="174" y="20" text-anchor="middle" font-size="20" font-weight="bold" fill="#000000" letter-spacing="0.5">PANKIL PANKIL</text>
    <text x="174" y="34" text-anchor="middle" font-size="7.5" fill="#000000">
      Canada  |  +1 (613)-869-7353  |  <tspan text-decoration="underline">Pankil1702@gmail.com</tspan>  |  <tspan text-decoration="underline">linkedin.com/in/pankil</tspan>  |  <tspan text-decoration="underline">github.com/Pankil02</tspan>  |  <tspan text-decoration="underline">Pankil.dev</tspan>
    </text>

    <!-- Section: Summary -->
    <text x="0" y="52" font-size="8.8" font-weight="bold" fill="#000000" letter-spacing="0.5">SUMMARY</text>
    <line x1="0" y1="55" x2="348" y2="55" stroke="#000000" stroke-width="0.8"/>
    <text x="0" y="66" font-size="7" fill="#000000">
      Software Engineer with internship experience building scalable full-stack, backend, and AI systems using TypeScript, Python,
    </text>
    <text x="0" y="76" font-size="7" fill="#000000">
      Java, SQL, React, Next.js, PostgreSQL, Docker, and CI/CD. Strong foundation in <tspan font-weight="bold">data structures</tspan>, <tspan font-weight="bold">algorithms</tspan>, and distributed systems.
    </text>

    <!-- Section: Experience -->
    <text x="0" y="96" font-size="8.8" font-weight="bold" fill="#000000" letter-spacing="0.5">WORK EXPERIENCE</text>
    <line x1="0" y1="99" x2="348" y2="99" stroke="#000000" stroke-width="0.8"/>

    <!-- Role 1 -->
    <text x="0" y="111" font-size="8" font-weight="bold" fill="#000000">Solution <tspan font-weight="normal">|</tspan> <tspan font-style="italic">Software Developer Intern</tspan></text>
    <text x="348" y="111" text-anchor="end" font-size="7.5" font-weight="bold" fill="#000000">Jan 2026 - Present</text>
    <text x="0" y="121" font-size="7" font-style="italic" fill="#000000">Next.js, Bun, ElysiaJS, PostgreSQL, Drizzle, Turborepo, Stripe, Clerk, shadcn-ui</text>
    <text x="8" y="131" font-size="6.8" fill="#000000">• Built scalable full-stack features using <tspan font-weight="bold">Next.js</tspan>, streaming SSR, TanStack Query, and Bun, reducing load times to <tspan font-weight="bold">under 500 ms</tspan>.</text>
    <text x="8" y="140" font-size="6.8" fill="#000000">• Designed backend services using <tspan font-weight="bold">domain-driven design</tspan>, type-safe API contracts, reducing development time by <tspan font-weight="bold">25%</tspan>.</text>
    <text x="8" y="149" font-size="6.8" fill="#000000">• Optimized database queries using row-level locking and indexing, improving insert speed by <tspan font-weight="bold">40%</tspan>.</text>

    <!-- Role 2 -->
    <text x="0" y="165" font-size="8" font-weight="bold" fill="#000000">Landseed <tspan font-weight="normal">|</tspan> <tspan font-style="italic">AI Implementation Intern</tspan></text>
    <text x="348" y="165" text-anchor="end" font-size="7.5" font-weight="bold" fill="#000000">Mar 2025 - Dec 2025</text>
    <text x="0" y="175" font-size="7" font-style="italic" fill="#000000">PyTorch, Python, Hugging Face Diffusers, LoRA, bf16</text>
    <text x="8" y="185" font-size="6.8" fill="#000000">• Fine-tuned LoRA adapters on the FLUX diffusion model using ComfyUI, PyTorch, and Hugging Face Diffusers.</text>
    <text x="8" y="194" font-size="6.8" fill="#000000">• Optimized GPU training with bf16 mixed precision, gradient checkpointing, and dynamic batching.</text>

    <!-- Section: Projects -->
    <text x="0" y="214" font-size="8.8" font-weight="bold" fill="#000000" letter-spacing="0.5">PROJECTS</text>
    <line x1="0" y1="217" x2="348" y2="217" stroke="#000000" stroke-width="0.8"/>

    <text x="0" y="229" font-size="8" font-weight="bold" fill="#000000">Data Structures &amp; Algorithms Library <tspan font-weight="normal">|</tspan> <tspan font-style="italic">Java</tspan></text>
    <text x="8" y="239" font-size="6.8" fill="#000000">• Implemented 80+ data structures and algorithms in <tspan font-weight="bold">Java</tspan>, covering linked lists, trees, graphs, and dynamic programming.</text>

    <text x="0" y="253" font-size="8" font-weight="bold" fill="#000000">Technical Side Projects <tspan font-weight="normal">|</tspan> <tspan text-decoration="underline">github.com/Pankil02</tspan></text>
    <text x="348" y="253" text-anchor="end" font-size="7.5" font-weight="bold" fill="#000000">Present</text>
    <text x="8" y="263" font-size="6.8" fill="#000000">• <tspan font-weight="bold">AI Chatbot:</tspan> Built an agentic PDF RAG chatbot using LangChain and LlamaIndex for intelligent document querying.</text>
    <text x="8" y="272" font-size="6.8" fill="#000000">• <tspan font-weight="bold">Campscape Platform:</tspan> Full-stack JavaScript application for discovering camping destinations.</text>

    <!-- Section: Skills -->
    <text x="0" y="292" font-size="8.8" font-weight="bold" fill="#000000" letter-spacing="0.5">TECHNICAL SKILLS</text>
    <line x1="0" y1="295" x2="348" y2="295" stroke="#000000" stroke-width="0.8"/>
    <text x="8" y="306" font-size="6.8" fill="#000000">• <tspan font-weight="bold">Languages:</tspan> Java, Python, TypeScript, JavaScript, SQL, C++</text>
    <text x="8" y="315" font-size="6.8" fill="#000000">• <tspan font-weight="bold">Frontend &amp; UI:</tspan> Next.js, React, React Native, TanStack Query, Tailwind, HTML, CSS</text>
    <text x="8" y="324" font-size="6.8" fill="#000000">• <tspan font-weight="bold">Backend &amp; APIs:</tspan> Node.js, Bun, ElysiaJS, REST APIs, Microservices, LangChain, Zod</text>
    <text x="8" y="333" font-size="6.8" fill="#000000">• <tspan font-weight="bold">Cloud &amp; DevOps:</tspan> Docker, GitHub Actions, CI/CD, Cloudflare, CDN, Serverless, Linux, Git</text>

    <!-- Section: Education -->
    <text x="0" y="353" font-size="8.8" font-weight="bold" fill="#000000" letter-spacing="0.5">EDUCATION</text>
    <line x1="0" y1="356" x2="348" y2="356" stroke="#000000" stroke-width="0.8"/>
    <text x="0" y="368" font-size="8" font-weight="bold" fill="#000000">University of the People <tspan font-weight="normal">|</tspan> <tspan font-style="italic">Bachelor's, Computer Science</tspan></text>
    <text x="348" y="368" text-anchor="end" font-size="7.5" font-weight="bold" fill="#000000">Pasadena, CA 2024 - 2026</text>
    <text x="0" y="380" font-size="8" font-weight="bold" fill="#000000">Algonquin College <tspan font-weight="normal">|</tspan> <tspan font-style="italic">Diploma, Computer Programming [GPA: 3.93/4]</tspan></text>
    <text x="348" y="380" text-anchor="end" font-size="7.5" font-weight="bold" fill="#000000">Ottawa, ON 2022 - 2024</text>
  </g>
</svg>
  `.trim();
}

function getExecutivePreviewSvg(): string {
  return `
<svg viewBox="0 0 420 594" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Executive Template Preview">
  <defs>
    <filter id="exec-shadow" x="-4%" y="-2%" width="108%" height="106%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- A4 Paper Base -->
  <rect x="10" y="10" width="400" height="574" rx="3" fill="#ffffff" filter="url(#exec-shadow)" stroke="#cbd5e1" stroke-width="1"/>

  <!-- Content: Margins ~10mm (28px) -->
  <g transform="translate(32, 28)" font-family="system-ui, -apple-system, sans-serif">
    <!-- Header: Left-aligned -->
    <text x="0" y="20" font-size="22" font-weight="800" fill="#000000" letter-spacing="0.5">PANKIL</text>
    <text x="0" y="34" font-size="8.8" font-weight="600" fill="#1e90ff">Experienced Pastry Chef | Baker | Lead Chef</text>
    <text x="0" y="47" font-size="7" fill="#111827">
      <tspan fill="#1e90ff">📞</tspan> +1 613-869-7353   <tspan fill="#1e90ff">✉</tspan> Pankil1702@gmail.com   <tspan fill="#1e90ff">📍</tspan> Ottawa, ON
    </text>

    <!-- Two-Column Layout -->
    <!-- LEFT COLUMN (~60%): x: 0 to 215 -->
    <g transform="translate(0, 62)">
      <!-- Section: Summary -->
      <text x="0" y="10" font-size="8.5" font-weight="bold" fill="#000000" letter-spacing="0.5">SUMMARY</text>
      <line x1="0" y1="13" x2="210" y2="13" stroke="#000000" stroke-width="1.2"/>
      <text x="0" y="24" font-size="6.5" fill="#1f2937">Accomplished pastry chef with 4 years of experience in high-volume</text>
      <text x="0" y="33" font-size="6.5" fill="#1f2937">artisan bakeries. Expert in French pastry techniques, complete bakery</text>
      <text x="0" y="42" font-size="6.5" fill="#1f2937">operations, and team leadership. Proven success in production planning.</text>

      <!-- Section: Experience -->
      <text x="0" y="62" font-size="8.5" font-weight="bold" fill="#000000" letter-spacing="0.5">EXPERIENCE</text>
      <line x1="0" y1="65" x2="210" y2="65" stroke="#000000" stroke-width="1.2"/>

      <!-- Role 1 -->
      <circle cx="9" cy="79" r="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.8"/>
      <text x="9" y="82" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#1e90ff">LM</text>
      <text x="22" y="77" font-size="7.5" font-weight="bold" fill="#000000">Pastry Chef Supervisor</text>
      <text x="22" y="86" font-size="7" font-weight="600" fill="#1e90ff">La Maison du Kouign-amann</text>
      <text x="22" y="95" font-size="6" fill="#4b5563">📅 06/2025 - Present   📍 Ottawa, Canada</text>
      <text x="26" y="105" font-size="6" fill="#1f2937">• Produce full range of French pastries from scratch: cakes, tarts, croissants</text>
      <text x="26" y="114" font-size="6" fill="#1f2937">• Develop and refine recipes based on seasonal ingredients</text>

      <!-- Role 2 -->
      <circle cx="9" cy="133" r="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.8"/>
      <text x="9" y="136" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#1e90ff">T</text>
      <text x="22" y="131" font-size="7.5" font-weight="bold" fill="#000000">Pastry Chef &amp; Baker</text>
      <text x="22" y="140" font-size="7" font-weight="600" fill="#1e90ff">Tartelette Bakery &amp; Cafe</text>
      <text x="22" y="149" font-size="6" fill="#4b5563">📅 01/2025 - 07/2025   📍 Ottawa, Canada</text>
      <text x="26" y="159" font-size="6" fill="#1f2937">• Created laminated pastries daily: croissants, pain au chocolat</text>
      <text x="26" y="168" font-size="6" fill="#1f2937">• Coordinate team scheduling and lead operations in absence of head chef</text>

      <!-- Role 3 -->
      <circle cx="9" cy="187" r="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.8"/>
      <text x="9" y="190" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#1e90ff">CB</text>
      <text x="22" y="185" font-size="7.5" font-weight="bold" fill="#000000">Baker</text>
      <text x="22" y="194" font-size="7" font-weight="600" fill="#1e90ff">COBS Bread</text>
      <text x="22" y="203" font-size="6" fill="#4b5563">📅 09/2023 - 01/2025   📍 Ottawa, Canada</text>
      <text x="26" y="213" font-size="6" fill="#1f2937">• Produced a wide variety of breads, rolls, and pastries for retail sales</text>

      <!-- Role 4 -->
      <circle cx="9" cy="232" r="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.8"/>
      <text x="9" y="235" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#1e90ff">TH</text>
      <text x="22" y="230" font-size="7.5" font-weight="bold" fill="#000000">Early Morning Baker</text>
      <text x="22" y="239" font-size="7" font-weight="600" fill="#1e90ff">Tim Hortons</text>
      <text x="22" y="248" font-size="6" fill="#4b5563">📅 09/2022 - 03/2023   📍 Ottawa, Canada</text>
      <text x="26" y="258" font-size="6" fill="#1f2937">• Prepared fresh batches of baked goods including bagels, muffins, cookies</text>
    </g>

    <!-- RIGHT COLUMN (~40%): x: 226 to 356 -->
    <g transform="translate(226, 62)">
      <!-- Section: Skills -->
      <text x="0" y="10" font-size="8.5" font-weight="bold" fill="#000000" letter-spacing="0.5">SKILLS</text>
      <line x1="0" y1="13" x2="130" y2="13" stroke="#000000" stroke-width="1.2"/>
      <text x="0" y="24" font-size="7" font-weight="bold" fill="#000000">Soft Skills</text>
      <text x="4" y="34" font-size="6" fill="#1f2937">• <tspan font-weight="bold" text-decoration="underline">Advanced Pastry &amp; Baking:</tspan> Expert</text>
      <text x="10" y="42" font-size="6" fill="#1f2937">in laminated doughs, tarts, and cakes.</text>
      <text x="4" y="52" font-size="6" fill="#1f2937">• <tspan font-weight="bold" text-decoration="underline">Production Management:</tspan> Daily &amp;</text>
      <text x="10" y="60" font-size="6" fill="#1f2937">weekly planning based on demand.</text>
      <text x="4" y="70" font-size="6" fill="#1f2937">• <tspan font-weight="bold" text-decoration="underline">Team Leadership:</tspan> Scheduling,</text>
      <text x="10" y="78" font-size="6" fill="#1f2937">workflow, and chef supervision.</text>
      <text x="4" y="88" font-size="6" fill="#1f2937">• <tspan font-weight="bold" text-decoration="underline">Customer Satisfaction:</tspan> Delivering</text>
      <text x="10" y="96" font-size="6" fill="#1f2937">consistent, high-quality products.</text>

      <!-- Section: Key Achievements -->
      <text x="0" y="116" font-size="8.5" font-weight="bold" fill="#000000" letter-spacing="0.5">KEY ACHIEVEMENTS</text>
      <line x1="0" y1="119" x2="130" y2="119" stroke="#000000" stroke-width="1.2"/>
      <text x="0" y="130" font-size="7" fill="#1e90ff">💎 <tspan font-weight="bold" fill="#000000">Operational Efficiency</tspan></text>
      <text x="12" y="139" font-size="5.8" fill="#4b5563">Reduced waste by 30% through stock rotation.</text>
      <text x="0" y="152" font-size="7" fill="#1e90ff">💎 <tspan font-weight="bold" fill="#000000">Production Excellence</tspan></text>
      <text x="12" y="161" font-size="5.8" fill="#4b5563">Baked 200+ items daily, enhancing appeal.</text>

      <!-- Section: Education -->
      <text x="0" y="181" font-size="8.5" font-weight="bold" fill="#000000" letter-spacing="0.5">EDUCATION</text>
      <line x1="0" y1="184" x2="130" y2="184" stroke="#000000" stroke-width="1.2"/>
      <text x="0" y="195" font-size="7" font-weight="bold" fill="#000000">Baking &amp; Pastry Arts</text>
      <text x="0" y="204" font-size="6.8" font-weight="600" fill="#1e90ff">Algonquin College</text>
      <text x="0" y="213" font-size="6" fill="#4b5563">📍 Ottawa, Canada</text>

      <!-- Section: Certificates -->
      <text x="0" y="233" font-size="8.5" font-weight="bold" fill="#000000" letter-spacing="0.5">CERTIFICATES</text>
      <line x1="0" y1="236" x2="130" y2="236" stroke="#000000" stroke-width="1.2"/>
      <text x="0" y="247" font-size="6.8" font-weight="bold" fill="#000000">Smart Serve</text>
      <text x="0" y="258" font-size="6.8" font-weight="bold" fill="#000000">WHMIS</text>
      <text x="0" y="269" font-size="6.8" font-weight="bold" fill="#000000">AODA Compliance</text>
    </g>
  </g>
</svg>
  `.trim();
}

/**
 * Returns the SVG string for a given template ID.
 */
export function getTemplatePreviewSvg(templateId: TemplateId): string {
  if (templateId === 'executive') {
    return getExecutivePreviewSvg();
  }
  return getClassicPreviewSvg();
}

export interface TemplatesViewCallbacks {
  onSelectTemplate: (id: TemplateId) => void;
  onNavigateToEditor: () => void;
}

/**
 * Renders the full templates gallery card view into container.
 */
export function renderTemplatesGallery(
  container: HTMLElement,
  currentTemplateId: TemplateId,
  callbacks: TemplatesViewCallbacks
): void {
  const templates = listTemplates();

  container.innerHTML = `
    <div class="templates-view-inner">
      <div class="templates-header-band">
        <div class="templates-header-content">
          <span class="templates-eyebrow">A4 LAYOUT SYSTEM</span>
          <h2 class="templates-title">Resume Templates</h2>
          <p class="templates-subtitle">
            Professional A4 resume templates engineered for strict physical page budgets, authentic typography, and verified ATS scannability.
          </p>
        </div>
      </div>

      <div class="templates-cards-grid" role="region" aria-label="Available resume templates">
        ${templates
          .map((tmpl) => renderTemplateCardHtml(tmpl, tmpl.id === currentTemplateId))
          .join('')}
      </div>
    </div>
  `;

  // Attach event handlers
  for (const tmpl of templates) {
    const btnSelect = container.querySelector<HTMLButtonElement>(`#btn-select-template-${tmpl.id}`);
    if (btnSelect) {
      btnSelect.addEventListener('click', () => {
        callbacks.onSelectTemplate(tmpl.id);
        callbacks.onNavigateToEditor();
      });
    }

    const btnPreview = container.querySelector<HTMLButtonElement>(`#btn-preview-template-${tmpl.id}`);
    if (btnPreview) {
      btnPreview.addEventListener('click', () => {
        callbacks.onSelectTemplate(tmpl.id);
        callbacks.onNavigateToEditor();
      });
    }
  }
}

/**
 * Helper to generate HTML for an individual template card.
 */
function renderTemplateCardHtml(tmpl: TemplateDefinition, isActive: boolean): string {
  const svgContent = getTemplatePreviewSvg(tmpl.id);
  const layoutBadgeText = tmpl.columns === 1 ? '1 Column (ATS First)' : '2 Columns (Executive)';
  const fontBadgeText = tmpl.fontFamily === 'serif' ? 'Serif Typography' : 'Sans-Serif Typography';
  const atsBadge = tmpl.atsOptimized
    ? '<span class="template-badge badge-ats">✓ ATS Optimized</span>'
    : '<span class="template-badge badge-visual">★ Visual Executive</span>';

  return `
    <article class="template-card ${isActive ? 'is-active-template' : ''}" data-template-id="${tmpl.id}">
      <div class="template-card-header">
        <div class="template-card-title-group">
          <h3 class="template-card-name">${escapeHtml(tmpl.name)}</h3>
          <div class="template-card-badges">
            <span class="template-badge">${layoutBadgeText}</span>
            <span class="template-badge">${fontBadgeText}</span>
            ${atsBadge}
          </div>
        </div>
        ${isActive ? '<span class="badge-active-indicator" title="Currently selected template">● Active</span>' : ''}
      </div>

      <div class="template-card-preview-frame">
        <div class="template-svg-wrapper" title="${escapeHtml(tmpl.name)} Template Preview">
          ${svgContent}
        </div>
      </div>

      <div class="template-card-body">
        <p class="template-card-desc">${escapeHtml(tmpl.description)}</p>

        <div class="template-specs-list">
          <div class="template-spec-row">
            <span class="spec-label">Reading Order:</span>
            <span class="spec-value">${escapeHtml(tmpl.readingOrder)}</span>
          </div>
          <div class="template-spec-row">
            <span class="spec-label">Paper Standard:</span>
            <span class="spec-value">A4 Portrait (210 × 297 mm)</span>
          </div>
        </div>

        ${
          tmpl.readingOrderCaveat
            ? `
          <div class="template-caveat-box" role="note">
            <div class="caveat-icon">ℹ</div>
            <div class="caveat-text">${escapeHtml(tmpl.readingOrderCaveat)}</div>
          </div>
        `
            : ''
        }
      </div>

      <div class="template-card-footer">
        <button
          type="button"
          id="btn-select-template-${tmpl.id}"
          class="btn ${isActive ? 'btn-secondary' : 'btn-primary'} btn-block"
          ${isActive ? 'aria-pressed="true"' : ''}
        >
          ${isActive ? '✓ Currently Selected' : `Use ${tmpl.name} Template`}
        </button>
        <button
          type="button"
          id="btn-preview-template-${tmpl.id}"
          class="btn btn-secondary btn-block"
        >
          Open in Editor
        </button>
      </div>
    </article>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
