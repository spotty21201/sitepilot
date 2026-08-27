import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ProviderAdapterError,
  analyzeVertexEnvelope,
  isRepairEligible,
  parseStructuredCandidate,
  type ProviderFailureCode,
} from '@/lib/taskmaster/provider-adapter';
import { InMemoryTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { withProviderBudget } from '@/lib/taskmaster/provider-budget';
import { createTaskmasterRun } from '@/lib/taskmaster/runner';
import { createStudyTemplateProposals, schemeProposalArraySchema, type SchemeGenerationInput } from '@/lib/schemes/proposal-contract';

const identifiers = { runId: 'tm-provider-fixture', correlationId: 'corr-provider-fixture' };
const base = { httpStatus: 200, contentType: 'application/json', responseBytes: 1, requestDurationMs: 12 };

const input: SchemeGenerationInput = {
  opportunityId: 'adapter-case', name: 'Synthetic adapter case', address: 'Synthetic address', objective: 'Three strategies',
  siteAreaM2: 12000, frontageMeters: 100, depthMeters: 120,
  existingAsset: { gfa: 6000, floors: 3, description: 'Existing asset', currentStatus: 'Operational' },
  planningLimits: { maxFAR: 7, maxCoveragePct: 50, minKDHPct: 25, maxHeightMeters: 180, setbacks: { front: 10, rear: 8, sideLeft: 6, sideRight: 6 } },
  studyVersion: 'Study version 1', inputHash: 'input-adapter',
  priorities: { existingBuildingRetention: 'adapt', developmentYield: 'balanced', publicRealm: 'generous', programMix: 'mixed use', phasing: 'phased', planningRiskTolerance: 'medium', investmentHorizon: 'long', allowNonCompliantStretch: false },
};

function codeFrom(work: () => unknown): ProviderFailureCode | undefined {
  try {
    work();
  } catch (error) {
    return error instanceof ProviderAdapterError ? error.code : undefined;
  }
  return undefined;
}

function envelope(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    responseId: 'safe-response-id',
    modelVersion: 'gemini-test-001',
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(createStudyTemplateProposals(input)) }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    ...overrides,
  });
}

describe('Vertex response boundary classifications', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records safe metadata for a valid Vertex envelope and valid structured proposal', () => {
    const analysis = analyzeVertexEnvelope(envelope(), base, identifiers);
    expect(analysis).toMatchObject({ modelOutputReceived: true, metadata: { responseId: 'safe-response-id', modelVersion: 'gemini-test-001', candidateCount: 1, finishReasons: ['STOP'], totalTokens: 30 } });
    const candidateText = JSON.parse(envelope()).candidates[0].content.parts[0].text;
    expect(parseStructuredCandidate(candidateText, schemeProposalArraySchema, identifiers)).toHaveLength(3);
  });

  it.each([
    ['empty HTTP body', '', 'EMPTY_RESPONSE_BODY'],
    ['truncated response envelope', '{"candidates":[', 'INVALID_RESPONSE_ENVELOPE'],
    ['no candidates', JSON.stringify({ candidates: [] }), 'NO_CANDIDATES'],
    ['no candidates with prompt feedback', JSON.stringify({ candidates: [], promptFeedback: { blockReason: 'SAFETY' } }), 'SAFETY_BLOCKED'],
    ['safety termination', envelope({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '{}' }] } }] }), 'SAFETY_BLOCKED'],
    ['maximum-token termination', envelope({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] }), 'MAX_TOKENS'],
    ['empty candidate content', envelope({ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }), 'CANDIDATE_NO_TEXT'],
  ] as const)('classifies %s', (_label, body, expected) => {
    expect(codeFrom(() => analyzeVertexEnvelope(body, { ...base, responseBytes: body.length }, identifiers))).toBe(expected);
  });

  it('distinguishes malformed candidate JSON from schema-invalid candidate JSON', () => {
    expect(codeFrom(() => parseStructuredCandidate('{', schemeProposalArraySchema, identifiers))).toBe('INVALID_CANDIDATE_JSON');
    expect(codeFrom(() => parseStructuredCandidate('{"not":"strategies"}', schemeProposalArraySchema, identifiers))).toBe('SCHEMA_INVALID_OUTPUT');
  });

  it('allows repair only for invalid candidate JSON or schema-invalid output', () => {
    expect(isRepairEligible(new ProviderAdapterError('INVALID_CANDIDATE_JSON', identifiers))).toBe(true);
    expect(isRepairEligible(new ProviderAdapterError('SCHEMA_INVALID_OUTPUT', identifiers))).toBe(true);
    expect(isRepairEligible(new ProviderAdapterError('EMPTY_RESPONSE_BODY', identifiers))).toBe(false);
    expect(isRepairEligible(new ProviderAdapterError('SAFETY_BLOCKED', identifiers))).toBe(false);
  });

  it('classifies a non-JSON non-success HTTP response without parsing it as a candidate', async () => {
    const repository = new InMemoryTaskmasterRunRepository();
    const run = createTaskmasterRun(input, input.objective, 'adapter-http-error');
    await repository.create(run);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream unavailable', { status: 503, headers: { 'content-type': 'text/plain', 'x-goog-request-id': 'safe-request-id' } })));
    await expect(withProviderBudget(run.runId, repository, () => fetch('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/m:generateContent')))
      .rejects.toMatchObject({ code: 'NON_SUCCESS_HTTP', runId: run.runId, correlationId: run.correlationId });
    expect(await repository.getProviderUsage(run.runId)).toMatchObject({
      providerRequests: 1,
      providerResponses: 1,
      successfulProviderRequests: 0,
      modelOutputsReceived: 0,
      outcome: 'REQUEST_FAILED',
      failureCode: 'NON_SUCCESS_HTTP',
      lastResponseMetadata: { httpStatus: 503, contentType: 'text/plain', responseBytes: 20, requestId: 'safe-request-id' },
    });
  });

  it.each([
    ['timeout', Object.assign(new Error('request timed out'), { name: 'AbortError' }), 'PROVIDER_TIMEOUT'],
    ['connection interruption', new TypeError('fetch failed'), 'PROVIDER_CONNECTION_INTERRUPTED'],
  ] as const)('classifies a provider %s before any response is received', async (_label, transportError, expected) => {
    const repository = new InMemoryTaskmasterRunRepository();
    const run = createTaskmasterRun(input, input.objective, `adapter-${expected}`);
    await repository.create(run);
    vi.stubGlobal('fetch', vi.fn(async () => { throw transportError; }));
    await expect(withProviderBudget(run.runId, repository, () => fetch('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/m:generateContent')))
      .rejects.toMatchObject({ code: expected });
    expect(await repository.getProviderUsage(run.runId)).toMatchObject({ providerRequests: 1, providerResponses: 0, modelOutputsReceived: 0, failureCode: expected });
  });

  it('never includes response content or sensitive configuration in classified errors or logs', async () => {
    const repository = new InMemoryTaskmasterRunRepository();
    const run = createTaskmasterRun(input, input.objective, 'adapter-log-safety');
    await repository.create(run);
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const secret = 'secret-opportunity-document-and-token';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(secret, { status: 500, headers: { 'content-type': 'text/plain' } })));
    let failure: unknown;
    try {
      await withProviderBudget(run.runId, repository, () => fetch('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/m:generateContent'));
    } catch (error) {
      failure = error;
    }
    expect(String(failure)).not.toContain(secret);
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });

  it('parses a valid three-strategy response with a standalone schema fixture', () => {
    const schema = z.array(z.object({ strategy: z.enum(['CONSERVATIVE', 'BALANCED', 'BOUNDARY']) })).length(3);
    expect(parseStructuredCandidate(JSON.stringify([
      { strategy: 'CONSERVATIVE' }, { strategy: 'BALANCED' }, { strategy: 'BOUNDARY' },
    ]), schema, identifiers)).toHaveLength(3);
  });
});
