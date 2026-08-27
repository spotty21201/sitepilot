import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchemeGenerationReview } from '@/components/SchemeGenerationReview';
import { createStudyTemplateProposals, reconcileSchemeProposals, type SchemeGenerationInput } from '@/lib/schemes/proposal-contract';
import { simulateDevelopmentSchemeTool } from '@/lib/taskmaster/tools';
import type { SchemeGenerationMetadata } from '@/types';

const input: SchemeGenerationInput = {
  opportunityId: 'ui-case', name: 'Sudirman Green Link — Synthetic Study', address: 'Jl. Sudirman', objective: 'Transit-oriented mixed use',
  siteAreaM2: 12000, frontageMeters: 100, depthMeters: 120,
  existingAsset: { gfa: 6000, floors: 3, description: 'Existing asset', currentStatus: 'Operational' },
  planningLimits: { maxFAR: 7, maxCoveragePct: 50, minKDHPct: 25, maxHeightMeters: 180, setbacks: { front: 10, rear: 8, sideLeft: 6, sideRight: 6 } },
  studyVersion: 'Study version 1', inputHash: 'input-ui-review',
  priorities: { existingBuildingRetention: 'adapt', developmentYield: 'balanced', publicRealm: 'generous', programMix: 'retail, office, residential and hotel', phasing: 'phased', planningRiskTolerance: 'medium', investmentHorizon: 'long', allowNonCompliantStretch: false },
};

function metadata(): SchemeGenerationMetadata {
  const draft = createStudyTemplateProposals(input);
  const proposals = reconcileSchemeProposals(draft, draft.map((proposal) => simulateDevelopmentSchemeTool(input, proposal)));
  return {
    status: 'READY', provider: 'LOCAL_DEVELOPMENT', model: 'configured-model-must-stay-hidden', modelCalled: false,
    disclosure: 'Template schemes used.', generatedAt: '2026-08-27T00:00:00.000Z', opportunityId: input.opportunityId,
    sourceStudyVersion: input.studyVersion, inputHash: input.inputHash, userPriorities: input.priorities,
    assumptions: ['Rectangular study parcel'], validation: { valid: true, errors: [] }, proposals,
    taskmasterRunId: 'tm-ui-test', correlationId: 'corr-ui-test', taskmasterState: 'AWAITING_APPROVAL',
    providerUsage: { providerRequests: 0, successfulProviderRequests: 0, promptTokens: 0, candidateTokens: 0, toolUsePromptTokens: 0, thoughtTokens: 0, totalTokens: 0, repairCount: 0 },
    preparation: { validationResult: 'PASSED', distinctnessResult: 'PASSED', repairAttempted: false, repairSucceeded: false, informationStillRequired: ['Measured landscaped/permeable area to demonstrate KDH'] },
  };
}

describe('scheme generation disclosure and strategy documents', () => {
  it('shows truthful fallback metadata, reconciled figures and complete strategy content without exposing a configured model', () => {
    render(<SchemeGenerationReview generation={metadata()} onAccept={vi.fn()} isOpen onOpen={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByText('Template fallback').length).toBeGreaterThan(0);
    expect(screen.getByText(/Model not called · template schemes used/)).toBeDefined();
    expect(screen.queryByText('configured-model-must-stay-hidden')).toBeNull();
    expect(screen.getByText(/tm-ui-test \/ corr-ui-test/)).toBeDefined();
    expect(screen.getByText(/distinctness PASSED/)).toBeDefined();
    expect(screen.getAllByText(/m² achieved · .*m² target/).length).toBe(3);
    expect(screen.getByText(/6,000 m² retained · 0 m² removed/)).toBeDefined();
    expect(screen.getAllByText(/Commercial premise:/).length).toBe(3);
  });
});
