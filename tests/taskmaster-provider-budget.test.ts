import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { withProviderBudget, ProviderBudgetExceeded } from '@/lib/taskmaster/provider-budget';

describe('Taskmaster provider transport budget', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TASKMASTER_MAX_PROVIDER_REQUESTS;
    delete process.env.TASKMASTER_MAX_TOTAL_TOKENS;
    delete process.env.GOOGLE_CLOUD_LOCATION;
    delete process.env.VERTEX_AI_LOCATION;
  });

  it('counts every Vertex transport request and persists usage metadata', async () => {
    process.env.TASKMASTER_MAX_PROVIDER_REQUESTS = '2';
    process.env.GOOGLE_CLOUD_LOCATION = 'asia-southeast2';
    process.env.VERTEX_AI_LOCATION = 'global';
    const repository = new InMemoryTaskmasterRunRepository();
    const responses = [
      { responseId: 'resp-1', modelVersion: 'gemini-3.7-flash-001', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8, totalTokenCount: 18 } },
      { responseId: 'resp-2', modelVersion: 'gemini-3.7-flash-001', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 9, totalTokenCount: 21 } },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } })));
    await withProviderBudget('run-budget', repository, async () => {
      await fetch('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-3.7-flash:generateContent');
      await fetch('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-3.7-flash:generateContent');
    });
    await expect(withProviderBudget('run-budget', repository, async () => fetch('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-3.7-flash:generateContent'))).rejects.toBeInstanceOf(ProviderBudgetExceeded);
    const usage = await repository.getProviderUsage('run-budget');
    expect(usage?.providerRequests).toBe(2);
    expect(usage?.successfulProviderRequests).toBe(2);
    expect(usage?.providerResponses).toBe(2);
    expect(usage?.modelOutputsReceived).toBe(2);
    expect(usage?.modelOutputsSchemaAccepted).toBe(0);
    expect(usage?.outcome).toBe('OUTPUT_INVALID');
    expect(usage?.totalTokens).toBe(39);
    expect(usage?.actualModel).toBe('gemini-3.7-flash-001');
    expect(usage?.location).toBe('global');
    expect(usage?.responseIds).toEqual(['resp-1', 'resp-2']);
  });
});
