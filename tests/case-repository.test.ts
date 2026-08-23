import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  listCases, 
  getCase, 
  saveCase, 
  createCase, 
  deleteCase, 
  resetDemoCase, 
  getActiveCaseId, 
  setActiveCaseId 
} from '@/lib/storage/case-repository';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import {
  CanonicalSpatialCommandService,
  executeCanonicalSpatialCommand,
} from '@/lib/spatial/canonical-command-service';

interface MutableStoredProjectShape {
  name: string;
  scenarios: Array<{
    id: string;
    assumptionsUsed?: unknown;
    metrics?: unknown;
    masses: Array<{ id: string; dimensions?: unknown }>;
  }>;
}

describe('SitePilot Case Repository & Persistence Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists the Golden Project demo template by default', () => {
    const cases = listCases();
    expect(cases.length).toBeGreaterThanOrEqual(1);
    const demo = cases.find(c => c.id === GOLDEN_PROJECT.id);
    expect(demo).toBeDefined();
    expect(demo?.name).toBe('Menteng Heritage Quarter');
    expect(demo?.isTemplate).toBe(true);
  });

  it('creates a new case with USER_ENTERED_ASSUMPTION provenance and 3 initial scenarios', () => {
    const newCase = createCase({
      name: 'Surabaya CBD Tower',
      address: 'Jl. Pemuda No. 10, Surabaya',
      city: 'Surabaya',
      country: 'Indonesia',
      objective: 'Evaluate 12,500 m² parcel for premium mixed-use hotel and office.',
      askingPriceAmount: 250000000000,
      askingPriceCurrency: 'IDR',
      grossSiteArea: 12500,
      frontageLength: 100
    });

    expect(newCase.id).toMatch(/^proj-\d+/);
    expect(newCase.name).toBe('Surabaya CBD Tower');
    expect(newCase.isTemplate).toBe(false);
    expect(newCase.site.grossSiteArea).toBe(12500);
    expect(newCase.site.frontageLength).toBe(100);

    // Verify Invariant 2 & 3: Provenance
    expect(newCase.areaProvenance).toBeDefined();
    expect(newCase.areaProvenance?.sourceType).toBe('USER_ENTERED_ASSUMPTION');
    expect(newCase.areaProvenance?.value).toBe(12500);
    expect(newCase.areaProvenance?.confidence).toBe('UNVERIFIED');

    // Verify 3 baseline scenarios are created with deterministic metrics
    expect(newCase.scenarios).toHaveLength(3);
    const [scenA, scenB, scenC] = newCase.scenarios;
    expect(scenA.name).toContain('Scenario A');
    expect(scenB.name).toContain('Scenario B');
    expect(scenC.name).toContain('Scenario C');
    expect(scenB.isPreferred).toBe(true);
    expect(scenA.metrics.grossSiteArea).toBe(12500);
    expect(scenB.metrics.grossSiteArea).toBe(12500);
    expect(scenC.metrics.grossSiteArea).toBe(12500);
    expect(scenC.metrics.totalGFA).toBeGreaterThan(scenB.metrics.totalGFA);

    // Verify case is now listed and active
    const cases = listCases();
    expect(cases.some(c => c.id === newCase.id)).toBe(true);
    expect(getActiveCaseId()).toBe(newCase.id);
  });

  it('preserves case modifications across reload cycles', () => {
    const newCase = createCase({
      name: 'Bandung Tech Park',
      address: 'Jl. Dago No. 150',
      grossSiteArea: 8000
    });

    // Modify setbacks on the case
    const updatedCase = {
      ...newCase,
      site: {
        ...newCase.site,
        setbacks: { front: 15, rear: 8, sideLeft: 6, sideRight: 6 }
      }
    };

    saveCase(updatedCase);

    // Simulate page reload by reading fresh from storage
    const reloaded = getCase(newCase.id);
    expect(reloaded.site.setbacks.front).toBe(15);
    expect(reloaded.site.setbacks.rear).toBe(8);
    expect(reloaded.site.grossSiteArea).toBe(8000);
    expect(reloaded.name).toBe('Bandung Tech Park');
  });

  it('manages active case ID switching and deletion', () => {
    const case1 = createCase({ name: 'Case 1', address: 'Addr 1', grossSiteArea: 5000 });
    const case2 = createCase({ name: 'Case 2', address: 'Addr 2', grossSiteArea: 6000 });

    expect(getActiveCaseId()).toBe(case2.id);

    setActiveCaseId(case1.id);
    expect(getActiveCaseId()).toBe(case1.id);

    // Delete active case -> active case falls back to default demo
    deleteCase(case1.id);
    expect(getCase(case1.id).id).toBe(GOLDEN_PROJECT.id);
    expect(getActiveCaseId()).toBe(GOLDEN_PROJECT.id);
  });

  it('resets demo template back to original Golden Project benchmark', () => {
    const modifiedDemo = {
      ...GOLDEN_PROJECT,
      name: 'Menteng Modified Name'
    };
    saveCase(modifiedDemo);

    expect(getCase(GOLDEN_PROJECT.id).name).toBe('Menteng Modified Name');

    resetDemoCase();
    expect(getCase(GOLDEN_PROJECT.id).name).toBe('Menteng Heritage Quarter');
  });

  it('loads legacy core data and synthesizes revision metadata without changing IDs', () => {
    localStorage.setItem('sitepilot_cases_v1', JSON.stringify({
      [GOLDEN_PROJECT.id]: GOLDEN_PROJECT,
    }));
    const loaded = getCase(GOLDEN_PROJECT.id);
    expect(loaded.id).toBe(GOLDEN_PROJECT.id);
    expect(loaded.scenarios.map((scenario) => scenario.id)).toEqual(GOLDEN_PROJECT.scenarios.map((scenario) => scenario.id));
    expect(loaded.scenarios.flatMap((scenario) => scenario.masses.map((mass) => mass.id))).toEqual(
      GOLDEN_PROJECT.scenarios.flatMap((scenario) => scenario.masses.map((mass) => mass.id))
    );
    expect(loaded.scenarios.every((scenario) => scenario.canonicalRevision?.schemaVersion === 1)).toBe(true);
    expect(loaded.scenarios.every((scenario) => scenario.canonicalRevision?.sequence === 0)).toBe(true);
  });

  it('round-trips active canonical revision metadata while retaining rollback-readable core data', () => {
    const project = getCase(GOLDEN_PROJECT.id);
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const result = executeCanonicalSpatialCommand(project, {
      id: 'cmd:persistence-roundtrip',
      type: 'RESIZE_MASS',
      caseId: project.id,
      scenarioId: scenario.id,
      targetId: west.id,
      expectedSourceRevisionId: scenario.canonicalRevision!.revisionId,
      issuedAt: '2026-08-22T02:00:00.000Z',
      source: 'LEGACY_EDITOR',
      description: 'Persist width',
      payload: { width: 36, length: west.dimensions.length },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(saveCase(result.project)).toBe(true);
    const reloaded = getCase(project.id);
    expect(reloaded.scenarios[1].masses[1].dimensions.width).toBe(36);
    expect(reloaded.scenarios[1].canonicalRevision).toEqual(result.scenario.canonicalRevision);

    const rollbackReader = JSON.parse(localStorage.getItem('sitepilot_cases_v1') || '{}');
    expect(rollbackReader[project.id].scenarios[1].masses[1].dimensions.width).toBe(36);
    expect(rollbackReader[project.id].sources).toEqual(project.sources);
    expect(rollbackReader[project.id].contradictions).toEqual(project.contradictions);
  });

  it('repairs malformed revision metadata without changing canonical geometry', () => {
    const malformed = structuredClone(GOLDEN_PROJECT) as typeof GOLDEN_PROJECT & {
      scenarios: Array<(typeof GOLDEN_PROJECT.scenarios)[number] & { canonicalRevision?: unknown }>;
    };
    (malformed.scenarios[1] as { canonicalRevision?: unknown }).canonicalRevision = {
      schemaVersion: 999,
      revisionId: 42,
    };
    localStorage.setItem('sitepilot_cases_v1', JSON.stringify({ [malformed.id]: malformed }));
    const loaded = getCase(malformed.id);
    expect(loaded.scenarios[1].masses).toEqual(GOLDEN_PROJECT.scenarios[1].masses);
    expect(loaded.scenarios[1].canonicalRevision?.schemaVersion).toBe(1);
  });

  it('reconciles a structurally valid revision whose ID does not match its scenario, sequence, and hash', () => {
    const project = getCase(GOLDEN_PROJECT.id);
    const malformed = structuredClone(project);
    malformed.scenarios[1].canonicalRevision!.revisionId = 'unrelated:r999:invalid';
    localStorage.setItem('sitepilot_cases_v1', JSON.stringify({ [malformed.id]: malformed }));
    const loaded = getCase(malformed.id);
    const revision = loaded.scenarios[1].canonicalRevision!;
    expect(revision.revisionId).toMatch(new RegExp(`^${loaded.scenarios[1].id}:r${revision.sequence}:`));
    expect(revision.sequence).toBe(project.scenarios[1].canonicalRevision!.sequence + 1);
    expect(loaded.scenarios[1].masses).toEqual(project.scenarios[1].masses);
  });

  it.each([
    ['empty scenarios', (project: MutableStoredProjectShape) => { project.scenarios = []; }],
    ['missing assumptions', (project: MutableStoredProjectShape) => { delete project.scenarios[0].assumptionsUsed; }],
    ['missing metrics', (project: MutableStoredProjectShape) => { delete project.scenarios[0].metrics; }],
    ['duplicate scenario IDs', (project: MutableStoredProjectShape) => { project.scenarios[1].id = project.scenarios[0].id; }],
    ['duplicate mass IDs', (project: MutableStoredProjectShape) => { project.scenarios[1].masses[1].id = project.scenarios[1].masses[0].id; }],
    ['malformed mass dimensions', (project: MutableStoredProjectShape) => { delete project.scenarios[1].masses[0].dimensions; }],
  ])('rejects a hydration-unsafe stored project with %s', (_label, mutate) => {
    const malformed = structuredClone(GOLDEN_PROJECT) as unknown as MutableStoredProjectShape;
    malformed.name = 'Unsafe persisted project';
    mutate(malformed);
    const bytes = JSON.stringify({ [GOLDEN_PROJECT.id]: malformed });
    localStorage.setItem('sitepilot_cases_v1', bytes);
    expect(getCase(GOLDEN_PROJECT.id).name).toBe(GOLDEN_PROJECT.name);
    expect(localStorage.getItem('sitepilot_cases_v1')).toBe(bytes);
  });

  it('rejects a persisted case whose storage-map key does not match its project ID', () => {
    const mismatched = structuredClone(GOLDEN_PROJECT);
    mismatched.id = 'different-project-id';
    mismatched.scenarios = mismatched.scenarios.map((scenario) => ({
      ...scenario,
      projectId: mismatched.id,
    }));
    const bytes = JSON.stringify({ [GOLDEN_PROJECT.id]: mismatched });
    localStorage.setItem('sitepilot_cases_v1', bytes);
    expect(getCase(GOLDEN_PROJECT.id).id).toBe(GOLDEN_PROJECT.id);
    expect(localStorage.getItem('sitepilot_cases_v1')).toBe(bytes);
  });

  it('fails safely on a malformed root and does not overwrite existing bytes', () => {
    const malformed = '{not valid json';
    localStorage.setItem('sitepilot_cases_v1', malformed);
    expect(getCase(GOLDEN_PROJECT.id).id).toBe(GOLDEN_PROJECT.id);
    expect(saveCase(getCase(GOLDEN_PROJECT.id))).toBe(false);
    expect(localStorage.getItem('sitepilot_cases_v1')).toBe(malformed);
  });

  it('preserves opaque sibling entries when saving a valid case', () => {
    const opaque = { futureSchema: true, payload: ['preserve-me'] };
    localStorage.setItem('sitepilot_cases_v1', JSON.stringify({ opaque }));
    expect(saveCase(getCase(GOLDEN_PROJECT.id))).toBe(true);
    const stored = JSON.parse(localStorage.getItem('sitepilot_cases_v1') || '{}');
    expect(stored.opaque).toEqual(opaque);
  });

  it('falls back for a dangling active case ID without deleting stored data', () => {
    localStorage.setItem('sitepilot_active_case_id_v1', 'missing-case');
    localStorage.setItem('sitepilot_cases_v1', JSON.stringify({ opaque: { keep: true } }));
    expect(getActiveCaseId()).toBe(GOLDEN_PROJECT.id);
    expect(JSON.parse(localStorage.getItem('sitepilot_cases_v1') || '{}').opaque).toEqual({ keep: true });
  });

  it('persists canonical result but intentionally starts reload with empty undo and redo history', () => {
    const project = getCase(GOLDEN_PROJECT.id);
    const scenario = project.scenarios[1];
    const service = new CanonicalSpatialCommandService(saveCase);
    const result = service.execute(project, {
      id: 'cmd:history-not-persisted',
      type: 'SET_MASS_PROGRAM',
      caseId: project.id,
      scenarioId: scenario.id,
      targetId: scenario.masses[1].id,
      expectedSourceRevisionId: scenario.canonicalRevision!.revisionId,
      issuedAt: '2026-08-22T02:01:00.000Z',
      source: 'LEGACY_EDITOR',
      description: 'Change programme',
      payload: { program: 'HOTEL' },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    saveCase(result.project);
    expect(service.canUndo(project.id, scenario.id)).toBe(true);

    const reloaded = getCase(project.id);
    const reloadedService = new CanonicalSpatialCommandService(saveCase);
    expect(reloaded.scenarios[1].masses[1].program).toBe('HOTEL');
    expect(reloadedService.canUndo(project.id, scenario.id)).toBe(false);
    expect(reloadedService.canRedo(project.id, scenario.id)).toBe(false);
  });

  it('keeps actual repository bytes and scoped history unchanged when command, undo, or redo storage writes fail', () => {
    const project = getCase(GOLDEN_PROJECT.id);
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const nativeSetItem = Storage.prototype.setItem;
    let failWrites = true;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const service = new CanonicalSpatialCommandService(saveCase);
      const proposal = {
        id: 'cmd:real-storage-failure',
        type: 'MOVE_MASS' as const,
        caseId: project.id,
        scenarioId: scenario.id,
        targetId: west.id,
        expectedSourceRevisionId: scenario.canonicalRevision!.revisionId,
        issuedAt: '2026-08-22T02:02:00.000Z',
        source: 'LEGACY_EDITOR' as const,
        description: 'Move with storage failure',
        payload: { position: { ...west.position, x: -20 } },
      };

      const rejected = service.execute(project, proposal);
      expect(rejected.accepted).toBe(false);
      expect(service.canUndo(project.id, scenario.id)).toBe(false);
      expect(localStorage.getItem('sitepilot_cases_v1')).toBeNull();

      failWrites = false;
      const committed = service.execute(project, proposal);
      expect(committed.accepted).toBe(true);
      if (!committed.accepted) return;
      const committedBytes = localStorage.getItem('sitepilot_cases_v1');

      failWrites = true;
      expect(service.undo(committed.project, project.id, scenario.id).accepted).toBe(false);
      expect(service.canUndo(project.id, scenario.id)).toBe(true);
      expect(service.canRedo(project.id, scenario.id)).toBe(false);
      expect(localStorage.getItem('sitepilot_cases_v1')).toBe(committedBytes);

      failWrites = false;
      const undo = service.undo(committed.project, project.id, scenario.id);
      expect(undo.accepted).toBe(true);
      const undoBytes = localStorage.getItem('sitepilot_cases_v1');

      failWrites = true;
      expect(service.redo(undo.project, project.id, scenario.id).accepted).toBe(false);
      expect(service.canUndo(project.id, scenario.id)).toBe(false);
      expect(service.canRedo(project.id, scenario.id)).toBe(true);
      expect(localStorage.getItem('sitepilot_cases_v1')).toBe(undoBytes);
    } finally {
      setItemSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });
});
