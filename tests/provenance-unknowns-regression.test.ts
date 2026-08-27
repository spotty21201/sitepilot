import { describe, it, expect, beforeEach } from 'vitest';
import { createCase } from '@/lib/storage/case-repository';

describe('SitePilot Release 1 — Provenance & Unknown Value Handling Regression Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps storeys, height, and setbacks unknown when unsupplied and marks them as unverified', () => {
    const blankCase = createCase({
      name: 'Unverified Greenfield Opportunity',
      address: 'Jl. Jenderal Sudirman No. 1, Jakarta',
      grossSiteArea: 5000,
      frontageLength: 50,
      // No existingFloors, statutoryMaxFloors, statutoryMaxHeightMeters, setbacks supplied
      hasZoningEvidence: false,
      provenanceType: 'USER_ENTERED_ASSUMPTION'
    });

    // Root site assumptions
    expect(blankCase.site.hasZoningEvidence).toBe(false);
    expect(blankCase.evidenceConfidence).toBe('UNVERIFIED');

    // Assert findings do not claim to be verified FACTs
    for (const f of blankCase.findings) {
      expect(f.classification).toMatch(/ASSUMPTION|CLAIM/);
      expect(f.confidence).toMatch(/LOW|UNVERIFIED/);
      expect(f.sourceName).not.toContain('Asset Inventory');
      expect(f.sourceName).not.toContain('Tax Assessment');
    }

    // Scenarios must be flagged as provisional study
    for (const scen of blankCase.scenarios) {
      expect(scen.complianceReport?.statusPillLabel).toContain('Within supplied study envelope');
      expect(scen.complianceReport?.decisionText).toContain('Statutory status not yet confirmed');
    }
  });

  it('does not elevate user intake values into authoritative document sources', () => {
    const customCase = createCase({
      name: 'Custom Brownfield Site',
      address: 'Jl. Rasuna Said No. 12',
      grossSiteArea: 3500,
      frontageLength: 45,
      existingGFA: 2500,
      askingPriceAmount: 75000000000,
      njopAmount: 60000000000,
      hasZoningEvidence: false,
      provenanceType: 'USER_ENTERED_ASSUMPTION'
    });

    const sourceNames = customCase.findings.map(f => f.sourceName);
    expect(sourceNames).not.toContain('Asset Inventory Records');
    expect(sourceNames).not.toContain('Tax Assessment Notice (PBB/NJOP)');
    expect(sourceNames).not.toContain('Title Certificate');

    const classifications = customCase.findings.map(f => f.classification);
    expect(classifications).not.toContain('FACT');

    // Existing asset without confirmed floors
    expect(customCase.existingAsset?.isFloorsAssumed).toBe(true);
    expect(customCase.existingAsset?.floors).toBeUndefined();
  });
});
