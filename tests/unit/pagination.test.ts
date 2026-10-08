import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSemanticAtoms,
  formatYearMonth,
  formatDateRange,
  type SemanticAtom,
} from '../../src/web/blocks.js';
import {
  paginateResume,
  assertContentConservation,
  type MeasureAtomsFn,
} from '../../src/web/paginate.js';
import { createFictionalStarter } from '../../src/core/defaults.js';
import type { ResumeV1 } from '../../src/core/generated/resume.js';

describe('semantic block building', () => {
  it('buildSemanticAtoms builds header and all populated sections in sectionOrder', () => {
    const resume = createFictionalStarter('classic', 1);
    const atoms = buildSemanticAtoms(resume);

    assert.ok(atoms.length > 5, 'Should generate multiple atoms');

    // Header must be first
    assert.equal(atoms[0]?.type, 'header');
    assert.equal(atoms[0]?.sourcePath, 'profile');
    assert.equal(atoms[0]?.headerData?.name, resume.profile.name);

    // Verify sourcePaths exist on all atoms
    for (const atom of atoms) {
      assert.ok(atom.sourcePath, `Atom ${atom.id} missing sourcePath`);
      assert.ok(atom.id, 'Atom missing id');
    }

    // Verify section order respected
    const headingTypes = atoms
      .filter((a) => a.type === 'section-heading')
      .map((a) => a.sectionId);

    // In starter: summary, experience, education, projects, skills, certifications
    assert.deepEqual(headingTypes, [
      'summary',
      'experience',
      'education',
      'projects',
      'skills',
      'certifications',
    ]);
  });

  it('omits headings for empty sections', () => {
    const resume = createFictionalStarter('classic', 1);
    resume.projects = [];
    resume.certifications = [];

    const atoms = buildSemanticAtoms(resume);
    const headings = atoms
      .filter((a) => a.type === 'section-heading')
      .map((a) => a.sectionId);

    assert.equal(headings.includes('projects'), false);
    assert.equal(headings.includes('certifications'), false);
    assert.equal(headings.includes('experience'), true);
  });

  it('formats dates consistently', () => {
    assert.equal(formatYearMonth('2022-03'), 'Mar 2022');
    assert.equal(formatYearMonth('2025-12'), 'Dec 2025');
    assert.equal(formatDateRange('2022-01', undefined, true), 'Jan 2022 - Present');
    assert.equal(formatDateRange('2020-05', '2023-08'), 'May 2020 - Aug 2023');
    assert.equal(formatDateRange(undefined, '2021-06'), 'Jun 2021');
  });
});

describe('pagination packing & orphan/widow protection', () => {
  // Deterministic mock measurement function for testing algorithms
  // Heading: 30px, Entry heading: 25px, Bullet: 20px, Detail: 18px, Skill/Cert: 20px, Cont: 15px
  const mockMeasure: MeasureAtomsFn = (atoms, widthMm) => {
    let total = 0;
    for (const atom of atoms) {
      switch (atom.type) {
        case 'header':
          total += 80;
          break;
        case 'section-heading':
          total += 30;
          break;
        case 'summary-body':
          total += 40;
          break;
        case 'entry-heading':
          total += 25;
          break;
        case 'bullet':
          total += 20;
          break;
        case 'education-detail':
          total += 18;
          break;
        case 'skill-group':
          total += widthMm < 60 ? 30 : 20; // Taller in narrow sidebar
          break;
        case 'certification':
          total += widthMm < 60 ? 25 : 18;
          break;
        case 'continuation-label':
          total += 15;
          break;
      }
    }
    return total;
  };

  it('fits normal content on 1 page when within capacity', () => {
    const resume = createFictionalStarter('classic', 1);
    const atoms = buildSemanticAtoms(resume);

    // Generous capacity: 1000px
    const result = paginateResume({
      resume,
      atoms,
      pageCapacityPx: 1000,
      measureFn: mockMeasure,
    });

    assert.equal(result.pages.length, 1);
    assert.equal(result.overflowAtoms.length, 0);
    assert.equal(result.issues.filter((i) => i.severity === 'error').length, 0);
  });

  it('enforces orphan rule: section heading moves with entry heading and first bullet', () => {
    const resume: ResumeV1 = {
      schemaVersion: 1,
      document: {
        title: 'Orphan Test',
        template: 'classic',
        maxPages: 2,
        accent: 'slate',
      },
      profile: { name: 'Test Candidate', links: [] },
      sectionOrder: [
        'summary',
        'experience',
        'education',
        'projects',
        'skills',
        'certifications',
      ],
      experience: [
        {
          id: 'role-1',
          employer: 'Company A',
          role: 'Role A',
          start: '2020-01',
          current: true,
          bullets: ['Bullet 1', 'Bullet 2'],
        },
      ],
      education: [],
      projects: [],
      skills: [],
      certifications: [],
    };

    const atoms = buildSemanticAtoms(resume);

    // Header = 80px.
    // Section heading = 30px, Entry heading = 25px, Bullet 1 = 20px. Unit = 75px. Total = 155px.
    // If pageCapacity is 120px:
    // Header (80px) fits. Remaining = 40px.
    // Section heading alone is 30px, but unit is 75px! 80 + 75 = 155 > 120.
    // Therefore section heading must NOT be left on page 1. It must move to page 2!
    const result = paginateResume({
      resume,
      atoms,
      pageCapacityPx: 120,
      measureFn: mockMeasure,
    });

    assert.equal(result.pages.length, 2);
    // Page 1 should only have Header
    assert.equal(result.pages[0]?.atoms.length, 1);
    assert.equal(result.pages[0]?.atoms[0]?.type, 'header');

    // Page 2 should start with Section Heading
    assert.equal(result.pages[1]?.atoms[0]?.type, 'section-heading');
    assert.equal(result.pages[1]?.atoms[0]?.sectionId, 'experience');
  });

  it('splits multi-bullet entry across pages and adds continuation label', () => {
    const resume: ResumeV1 = {
      schemaVersion: 1,
      document: {
        title: 'Split Entry Test',
        template: 'classic',
        maxPages: 2,
        accent: 'navy',
      },
      profile: { name: 'Test Candidate', links: [] },
      sectionOrder: [
        'summary',
        'experience',
        'education',
        'projects',
        'skills',
        'certifications',
      ],
      experience: [
        {
          id: 'role-1',
          employer: 'Big Tech Corp',
          role: 'Staff Engineer',
          start: '2020-01',
          current: true,
          bullets: [
            'First bullet that fits on page 1',
            'Second bullet that fits on page 1',
            'Third bullet that spills to page 2',
            'Fourth bullet that spills to page 2',
          ],
        },
      ],
      education: [],
      projects: [],
      skills: [],
      certifications: [],
    };

    const atoms = buildSemanticAtoms(resume);

    // Header = 80, SecHead = 30, EntryHead = 25, Bullet 1 = 20, Bullet 2 = 20. Total P1 = 175.
    // Bullet 3 (+20) would be 195.
    // Capacity = 180.
    const result = paginateResume({
      resume,
      atoms,
      pageCapacityPx: 180,
      measureFn: mockMeasure,
    });

    assert.equal(result.pages.length, 2);
    assert.equal(result.overflowAtoms.length, 0);

    // Page 1 has header, sec-head, entry-head, bullet 1, bullet 2
    assert.equal(result.pages[0]?.atoms.length, 5);

    // Page 2 must have continuation label + bullet 3 + bullet 4
    const p2Atoms = result.pages[1]?.atoms || [];
    assert.equal(p2Atoms[0]?.type, 'continuation-label');
    assert.ok(p2Atoms[0]?.text?.includes('Big Tech Corp (Continued)'));
    assert.equal(p2Atoms[1]?.type, 'bullet');
    assert.equal(p2Atoms[2]?.type, 'bullet');
  });

  it('reports strict overflow and affected JSON paths when maxPages is exceeded', () => {
    const resume: ResumeV1 = {
      schemaVersion: 1,
      document: {
        title: 'Overflow Test',
        template: 'classic',
        maxPages: 1,
        accent: 'slate',
      },
      profile: { name: 'Candidate', links: [] },
      sectionOrder: [
        'summary',
        'experience',
        'education',
        'projects',
        'skills',
        'certifications',
      ],
      experience: [
        {
          id: 'role-1',
          employer: 'Acme',
          role: 'Dev',
          start: '2020-01',
          current: true,
          bullets: ['Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4', 'Bullet 5'],
        },
      ],
      education: [],
      projects: [],
      skills: [],
      certifications: [],
    };

    const atoms = buildSemanticAtoms(resume);

    // Capacity allows header + heading + bullets 1-2, but not 3-5
    const result = paginateResume({
      resume,
      atoms,
      pageCapacityPx: 180,
      measureFn: mockMeasure,
    });

    assert.equal(result.pages.length, 1);
    assert.ok(result.overflowAtoms.length > 0, 'Should have overflow atoms');

    // Issues should contain OVERFLOW_PAGE_LIMIT
    const overflowLimitIssue = result.issues.find((i) => i.code === 'OVERFLOW_PAGE_LIMIT');
    assert.ok(overflowLimitIssue);
    assert.equal(overflowLimitIssue.severity, 'error');

    // Issues should contain OVERFLOW_UNPLACED_CONTENT with JSON path
    const unplacedIssues = result.issues.filter((i) => i.code === 'OVERFLOW_UNPLACED_CONTENT');
    assert.ok(unplacedIssues.length > 0);
    assert.ok(unplacedIssues.some((i) => i.path.includes('experience[0].bullets')));
  });
});

describe('two-page pagination & content conservation', () => {
  const mockMeasure: MeasureAtomsFn = (atoms) => {
    let total = 0;
    for (const atom of atoms) {
      if (atom.type === 'header') total += 80;
      else if (atom.type === 'section-heading') total += 25;
      else if (atom.type === 'skill-group') total += 20;
      else if (atom.type === 'certification') total += 18;
      else if (atom.type === 'entry-heading') total += 25;
      else if (atom.type === 'bullet') total += 20;
      else total += 20;
    }
    return total;
  };

  it('assertContentConservation guarantees zero duplicate or omitted atoms', () => {
    const resume = createFictionalStarter('classic', 2);
    const atoms = buildSemanticAtoms(resume);

    const result = paginateResume({
      resume,
      atoms,
      pageCapacityPx: 400,
      measureFn: mockMeasure,
    });

    // Directly assert conservation
    assert.doesNotThrow(() => {
      assertContentConservation(atoms, result.pages, result.overflowAtoms);
    });

    // Verify intentional error throwing when an unplaced atom is omitted
    const ghostAtom: SemanticAtom = {
      id: 'atom-ghost-missing',
      type: 'bullet',
      sourcePath: 'experience[99].bullets[99]',
      text: 'Omitted content',
    };
    assert.throws(
      () => assertContentConservation([...atoms, ghostAtom], result.pages, result.overflowAtoms),
      /Content conservation error: Atom atom-ghost-missing/
    );
  });
});
