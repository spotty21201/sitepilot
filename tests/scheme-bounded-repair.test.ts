import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@/lib/ai/config', () => ({
  getAiConfig: () => ({ provider: 'VERTEX_AI', model: 'gemini-test', projectId: 'synthetic', location: 'asia-southeast2' }),
}));
vi.mock('@/lib/ai/gemini', () => ({
  createAiClient: () => ({ ai: { models: { generateContent: provider.generateContent } }, model: 'gemini-test', provider: 'VERTEX_AI' }),
}));

import { createStudyTemplateProposals, generateSchemeProposals, type SchemeGenerationInput } from '@/lib/schemes/proposal-contract';
import { ProviderAdapterError } from '@/lib/taskmaster/provider-adapter';

const input: SchemeGenerationInput = {
  opportunityId: 'repair-case', name: 'Repair case', address: 'Synthetic address', objective: 'Three distinct strategies',
  siteAreaM2: 12000, frontageMeters: 100, depthMeters: 120,
  existingAsset: { gfa: 6000, floors: 3, description: 'Existing asset', currentStatus: 'Operational' },
  planningLimits: { maxFAR: 7, maxCoveragePct: 50, minKDHPct: 25, maxHeightMeters: 180, setbacks: { front: 10, rear: 8, sideLeft: 6, sideRight: 6 } },
  studyVersion: 'Study version 1', inputHash: 'input-repair',
  priorities: { existingBuildingRetention: 'adapt', developmentYield: 'balanced', publicRealm: 'generous', programMix: 'retail, office, residential and hotel', phasing: 'phased', planningRiskTolerance: 'medium', investmentHorizon: 'long', allowNonCompliantStretch: false },
};

describe('bounded proposal repair', () => {
  beforeEach(() => {
    provider.generateContent.mockReset();
    process.env.TASKMASTER_ALLOW_MODEL_REPAIR = 'true';
    process.env.TASKMASTER_ALLOW_LIVE_MODEL = 'true';
  });
  afterEach(() => {
    delete process.env.TASKMASTER_ALLOW_MODEL_REPAIR;
    delete process.env.TASKMASTER_ALLOW_LIVE_MODEL;
  });

  it('performs exactly one repair and records that the repaired set passed', async () => {
    provider.generateContent
      .mockResolvedValueOnce({ text: '[]' })
      .mockResolvedValueOnce({ text: JSON.stringify(createStudyTemplateProposals(input)) });
    const onRepairAttempt = vi.fn();
    const result = await generateSchemeProposals(input, { onRepairAttempt });
    expect(provider.generateContent).toHaveBeenCalledTimes(2);
    expect(result.modelCalled).toBe(true);
    expect(onRepairAttempt).toHaveBeenCalledTimes(1);
    expect(result.qualityGate).toEqual({ distinctnessPassed: true, repairAttempted: true, repairSucceeded: true });
  });

  it('uses the installed SDK structured-output contract and records schema acceptance', async () => {
    provider.generateContent.mockResolvedValue({ text: JSON.stringify(createStudyTemplateProposals(input)) });
    const onSchemaAccepted = vi.fn();
    await generateSchemeProposals(input, { onSchemaAccepted });
    expect(provider.generateContent).toHaveBeenCalledTimes(1);
    const request = provider.generateContent.mock.calls[0][0];
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.responseSchema).toMatchObject({ type: 'ARRAY' });
    expect(request.config).not.toHaveProperty('responseJsonSchema');
    expect(onSchemaAccepted).toHaveBeenCalledTimes(1);
  });

  it('stops after the one repair when structured output remains invalid', async () => {
    provider.generateContent.mockResolvedValue({ text: '[]' });
    await expect(generateSchemeProposals(input)).rejects.toThrow();
    expect(provider.generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not silently fall back when the provider fails before usable output', async () => {
    provider.generateContent.mockRejectedValue(new ProviderAdapterError('EMPTY_RESPONSE_BODY', { runId: 'tm-live-failure', correlationId: 'corr-live-failure' }));
    await expect(generateSchemeProposals(input, { identifiers: { runId: 'tm-live-failure', correlationId: 'corr-live-failure' } }))
      .rejects.toMatchObject({ code: 'EMPTY_RESPONSE_BODY' });
    expect(provider.generateContent).toHaveBeenCalledTimes(1);
  });
});
