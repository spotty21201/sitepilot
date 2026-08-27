import { describe, expect, it } from 'vitest';
import { createStudyTemplateProposals, meaningfulProposalDifferences, reconcileSchemeProposals, validateSchemeProposals } from '@/lib/schemes/proposal-contract';
import type { TaskmasterInput } from '@/lib/taskmaster/schemas';
import { massFromProposal, simulateDevelopmentSchemeTool } from '@/lib/taskmaster/tools';
import { getCanonicalParcelBounds } from '@/lib/geometry/engine';

const input: TaskmasterInput = {
  opportunityId: 'quality-case', name: 'Quality case', address: 'Central Jakarta', objective: 'Three studies',
  siteAreaM2: 12000, frontageMeters: 80, depthMeters: 150, landscapedPermeablePct: 20,
  planningLimits: { maxFAR: 6.5, maxCoveragePct: 55, minKDHPct: 20, maxHeightMeters: 180, setbacks: { front: 10, rear: 6, sideLeft: 4, sideRight: 4 } },
  studyVersion: 'v1', inputHash: 'quality-input',
  priorities: { existingBuildingRetention: 'replace', developmentYield: 'balanced', publicRealm: 'strong', programMix: 'mixed use', phasing: 'single_phase', planningRiskTolerance: 'medium', investmentHorizon: 'long', allowNonCompliantStretch: false },
};

describe('Taskmaster proposal quality gates', () => {
  it('requires three strategies with complete program shares and calculates KDH from a supplied percentage', () => {
    const proposals = createStudyTemplateProposals(input);
    const validation = validateSchemeProposals(proposals, input);
    expect(validation.valid).toBe(true);
    expect(new Set(proposals.map((proposal) => proposal.strategy)).size).toBe(3);
    expect(simulateDevelopmentSchemeTool(input, proposals[0]).kdhDemonstrated).toBe(true);
    expect(simulateDevelopmentSchemeTool(input, proposals[0]).landscapedPermeableAreaM2).toBe(2400);
  });

  it('rejects ADAPT for a greenfield opportunity', () => {
    const proposals = createStudyTemplateProposals({ ...input, existingAsset: undefined });
    proposals[0] = { ...proposals[0], existingAssetDecision: 'ADAPT' };
    expect(validateSchemeProposals(proposals, { ...input, existingAsset: undefined }).valid).toBe(false);
  });

  it('preserves an entered 6,000 m² asset exactly and reconciles target, result, variance and program totals', () => {
    const brownfield = { ...input, existingAsset: { gfa: 6000, floors: 3, description: 'Existing three-storey asset', currentStatus: 'Operational' } };
    const proposals = createStudyTemplateProposals(brownfield);
    expect(proposals.map((proposal) => [proposal.existingGfaRetainedM2, proposal.existingGfaRemovedM2])).toEqual([
      [6000, 0], [3600, 2400], [0, 6000],
    ]);
    const bounds = getCanonicalParcelBounds(brownfield.siteAreaM2, brownfield.planningLimits.setbacks, brownfield.frontageMeters);
    const masses = proposals.map((proposal) => massFromProposal(brownfield, proposal, bounds));
    expect(masses[0].find((mass) => mass.id.endsWith('existing-asset'))?.gfa).toBe(6000);
    expect(masses[1].find((mass) => mass.id.endsWith('existing-asset'))?.gfa).toBe(3600);
    expect(masses[2].some((mass) => mass.id.endsWith('existing-asset'))).toBe(false);

    const simulations = proposals.map((proposal) => simulateDevelopmentSchemeTool(brownfield, proposal));
    const reconciled = reconcileSchemeProposals(proposals, simulations);
    expect(validateSchemeProposals(reconciled, brownfield, 'RECONCILED').valid).toBe(true);
    reconciled.forEach((proposal) => {
      expect(proposal.achievedGFA - proposal.targetGFA).toBeCloseTo(proposal.varianceGFA, 2);
      expect(Object.values(proposal.programGFAByUse).reduce((sum, gfa) => sum + gfa, 0)).toBeCloseTo(proposal.achievedGFA, 2);
      expect(proposal.varianceExplanation).not.toContain('Pending');
    });
  });

  it('rejects superficial strategy variants and podium/tower labels without matching components', () => {
    const proposals = createStudyTemplateProposals(input);
    expect(meaningfulProposalDifferences(proposals[0], proposals[1]).length).toBeGreaterThanOrEqual(2);
    const superficial = proposals.map((proposal, index) => index === 1 ? {
      ...proposal,
      existingAssetDecision: proposals[0].existingAssetDecision,
      existingGfaRetainedM2: proposals[0].existingGfaRetainedM2,
      existingGfaRemovedM2: proposals[0].existingGfaRemovedM2,
      programGFAByUse: proposals[0].programGFAByUse,
      programSharePct: proposals[0].programSharePct,
      publicRealmIntent: proposals[0].publicRealmIntent,
      accessServicingConcept: proposals[0].accessServicingConcept,
      phasingConcept: proposals[0].phasingConcept,
      commercialPremise: proposals[0].commercialPremise,
      proposedMassRoles: proposals[0].proposedMassRoles,
      podiumStoreys: proposals[0].podiumStoreys,
      towerStoreys: proposals[0].towerStoreys,
      alternativeStoreys: proposals[0].alternativeStoreys,
      floorToFloorAssumptions: proposals[0].floorToFloorAssumptions,
      targetGFA: proposals[0].targetGFA,
    } : proposal);
    expect(validateSchemeProposals(superficial, input).errors.join(' ')).toContain('at least three development-strategy areas');

    const inconsistent = createStudyTemplateProposals(input);
    inconsistent[1] = { ...inconsistent[1], podiumStoreys: undefined, towerStoreys: undefined, alternativeStoreys: 8 };
    expect(validateSchemeProposals(inconsistent, input).errors.join(' ')).toContain('podium labels and controls');
  });
});
