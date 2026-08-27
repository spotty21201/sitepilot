import { describe, expect, it } from 'vitest';
import { createTaskmasterRun, executeTaskmasterRun } from '@/lib/taskmaster/runner';
import { InMemoryTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { meaningfulProposalDifferences } from '@/lib/schemes/proposal-contract';
import type { TaskmasterInput } from '@/lib/taskmaster/schemas';

const acceptanceInput: TaskmasterInput = {
  opportunityId: 'sudirman-green-link-synthetic',
  name: 'Sudirman Green Link — Synthetic Study',
  address: 'Jl. Jenderal Sudirman, Jakarta',
  objective: 'Transit-oriented retail, offices, residences, hotel, shaded pedestrian space, public plaza and phased investment',
  siteAreaM2: 12000,
  frontageMeters: 100,
  depthMeters: 120,
  existingAsset: { gfa: 6000, floors: 3, description: 'Existing three-storey asset', currentStatus: 'Operational' },
  planningLimits: { maxFAR: 7, maxCoveragePct: 50, minKDHPct: 25, maxHeightMeters: 180, setbacks: { front: 10, rear: 8, sideLeft: 6, sideRight: 6 } },
  studyVersion: 'Study version 1',
  inputHash: 'input-sudirman-acceptance',
  priorities: {
    existingBuildingRetention: 'adapt', developmentYield: 'balanced', publicRealm: 'generous',
    programMix: 'Transit-oriented retail, offices, residences, hotel, shaded pedestrian space and public plaza',
    phasing: 'phased', planningRiskTolerance: 'medium', investmentHorizon: 'long', allowNonCompliantStretch: false,
  },
};

describe('tester-feedback synthetic acceptance case', () => {
  it('produces three reconciled urban-design and delivery strategies through deterministic fallback', async () => {
    const repository = new InMemoryTaskmasterRunRepository();
    const created = createTaskmasterRun(acceptanceInput, acceptanceInput.objective, 'acceptance-sudirman', true);
    await repository.create(created);
    const run = await executeTaskmasterRun(created.runId, repository, 'acceptance-delivery');
    expect(run?.state).toBe('AWAITING_APPROVAL');
    expect(run).toMatchObject({ modelCalled: false, modelCallCount: 0, provider: 'LOCAL_DEVELOPMENT', model: 'Template schemes used' });
    expect(run?.providerUsage).toMatchObject({ providerRequests: 0, successfulProviderRequests: 0, totalTokens: 0 });
    const proposals = run?.generation?.proposals || [];
    expect(proposals).toHaveLength(3);
    expect(proposals.map((proposal) => [proposal.existingGfaRetainedM2, proposal.existingGfaRemovedM2])).toEqual([[6000, 0], [3600, 2400], [0, 6000]]);
    for (let left = 0; left < proposals.length; left += 1) {
      for (let right = left + 1; right < proposals.length; right += 1) {
        expect(meaningfulProposalDifferences(proposals[left], proposals[right]).length).toBeGreaterThanOrEqual(2);
      }
    }
    proposals.forEach((proposal) => {
      expect(proposal.varianceGFA).toBeCloseTo(proposal.achievedGFA - proposal.targetGFA, 2);
      expect(proposal.varianceExplanation).not.toContain('Pending');
      expect(Object.values(proposal.programGFAByUse).reduce((sum, value) => sum + value, 0)).toBeCloseTo(proposal.achievedGFA, 2);
      expect(proposal.commercialPremise.length).toBeGreaterThan(20);
      expect(proposal.informationStillRequired.join(' ')).toContain('landscaped/permeable');
    });
    expect(run?.simulations).toHaveLength(3);
    expect(run?.simulations?.every((simulation) => simulation.planningStatus === 'WITHIN_SUPPLIED_LIMITS')).toBe(true);
    expect(run?.simulations?.every((simulation) => !simulation.kdhDemonstrated && simulation.warnings.some((warning) => warning.includes('KDH not demonstrated')))).toBe(true);
    expect(run?.simulations?.[0].masses.find((mass) => mass.id.endsWith('existing-asset'))?.gfa).toBe(6000);
    expect(run?.generation?.qualityGate).toEqual({ distinctnessPassed: true, repairAttempted: false, repairSucceeded: false });
  });
});
