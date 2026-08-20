import { describe, it, expect, beforeEach } from 'vitest';
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

  it('creates a new case with USER_ENTERED_ASSUMPTION provenance and 2 initial scenarios', () => {
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

    // Verify 2 baseline scenarios are created with deterministic metrics
    expect(newCase.scenarios).toHaveLength(2);
    const [scenA, scenB] = newCase.scenarios;
    expect(scenA.name).toContain('Scenario A');
    expect(scenB.name).toContain('Scenario B');
    expect(scenB.isPreferred).toBe(true);
    expect(scenA.metrics.grossSiteArea).toBe(12500);
    expect(scenB.metrics.grossSiteArea).toBe(12500);
    expect(scenB.metrics.totalGFA).toBeGreaterThan(scenA.metrics.totalGFA);

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
});
