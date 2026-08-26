import { describe, expect, it } from 'vitest';
import { createStudyTemplateProposals, validateSchemeProposals } from '@/lib/schemes/proposal-contract';
import type { TaskmasterInput } from '@/lib/taskmaster/schemas';
import { simulateDevelopmentSchemeTool } from '@/lib/taskmaster/tools';

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
});
