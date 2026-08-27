import type { TaskmasterProviderUsage } from './schemas';
import type { TaskmasterRunRepository } from './repository';
import {
  ProviderAdapterError,
  analyzeVertexEnvelope,
  classifyConnectionFailure,
  type ProviderRunIdentifiers,
  type SafeProviderResponseMetadata,
} from './provider-adapter';

// Vertex can use the global endpoint (`aiplatform.googleapis.com`), a
// regional endpoint (`asia-southeast2-aiplatform.googleapis.com`) or a
// regional replica endpoint. Keep the guard broad enough to cover all SDK
// transport variants while still excluding unrelated Google APIs.
const VERTEX_HOST = /(^|[.-])aiplatform\.googleapis\.com$|\.rep\.googleapis\.com$/i;

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function estimateCost(usage: TaskmasterProviderUsage): number | undefined {
  const inputRate = process.env.TASKMASTER_COST_INPUT_USD_PER_MILLION;
  const outputRate = process.env.TASKMASTER_COST_OUTPUT_USD_PER_MILLION;
  if (!inputRate || !outputRate) return undefined;
  const input = numberEnv('TASKMASTER_COST_INPUT_USD_PER_MILLION', 0);
  const output = numberEnv('TASKMASTER_COST_OUTPUT_USD_PER_MILLION', 0);
  return Number((((usage.promptTokens + usage.toolUsePromptTokens) / 1_000_000) * input + ((usage.candidateTokens + usage.thoughtTokens) / 1_000_000) * output).toFixed(8));
}

export class ProviderBudgetExceeded extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderBudgetExceeded';
  }
}

function emptyUsage(requestNumber = 0): TaskmasterProviderUsage {
  return {
    providerRequests: requestNumber,
    successfulProviderRequests: 0,
    providerResponses: 0,
    modelOutputsReceived: 0,
    modelOutputsSchemaAccepted: 0,
    repairRequests: 0,
    outcome: requestNumber > 0 ? 'REQUEST_FAILED' : 'NO_REQUEST',
    promptTokens: 0,
    candidateTokens: 0,
    toolUsePromptTokens: 0,
    thoughtTokens: 0,
    totalTokens: 0,
    modelLatencyMs: 0,
    repairCount: 0,
    costConfigVersion: process.env.TASKMASTER_COST_CONFIG_VERSION || '2026-08-sitepilot-v1',
  };
}

function safeResponseLog(identifiers: ProviderRunIdentifiers, metadata: SafeProviderResponseMetadata): void {
  console.info(JSON.stringify({
    service: 'sitepilot-taskmaster',
    event: 'vertex_response_metadata',
    runId: identifiers.runId,
    correlationId: identifiers.correlationId,
    ...metadata,
  }));
}

async function recordResponse(
  runId: string,
  repository: TaskmasterRunRepository,
  reservationNumber: number,
  metadata: SafeProviderResponseMetadata,
  options: { responseReceived: boolean; httpSuccess: boolean; outputReceived: boolean; countDuration?: boolean; failureCode?: Exclude<TaskmasterProviderUsage['failureCode'], null | undefined> },
): Promise<void> {
  const current = await repository.getProviderUsage(runId);
  const next: TaskmasterProviderUsage = {
    ...(current || emptyUsage(reservationNumber)),
    providerRequests: Math.max(current?.providerRequests || 0, reservationNumber),
    provider: 'VERTEX_AI',
    location: process.env.VERTEX_AI_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'global',
    requestedModel: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
    actualModel: metadata.modelVersion || current?.actualModel,
    providerResponses: (current?.providerResponses || 0) + (options.responseReceived ? 1 : 0),
    successfulProviderRequests: (current?.successfulProviderRequests || 0) + (options.httpSuccess ? 1 : 0),
    modelOutputsReceived: (current?.modelOutputsReceived || 0) + (options.outputReceived ? 1 : 0),
    outcome: options.outputReceived ? 'OUTPUT_INVALID' : 'REQUEST_FAILED',
    failureCode: options.failureCode ?? null,
    promptTokens: (current?.promptTokens || 0) + (metadata.promptTokens || 0),
    candidateTokens: (current?.candidateTokens || 0) + (metadata.candidateTokens || 0),
    toolUsePromptTokens: (current?.toolUsePromptTokens || 0) + (metadata.toolUsePromptTokens || 0),
    thoughtTokens: (current?.thoughtTokens || 0) + (metadata.thoughtTokens || 0),
    totalTokens: (current?.totalTokens || 0) + (metadata.totalTokens || 0),
    modelLatencyMs: (current?.modelLatencyMs || 0) + (options.countDuration === false ? 0 : metadata.requestDurationMs),
    responseIds: [...(current?.responseIds || []), ...(metadata.responseId ? [metadata.responseId] : [])].slice(-20),
    lastResponseMetadata: metadata,
    costConfigVersion: current?.costConfigVersion || process.env.TASKMASTER_COST_CONFIG_VERSION || '2026-08-sitepilot-v1',
    estimatedCostUsd: undefined,
  };
  next.estimatedCostUsd = estimateCost(next);
  await repository.recordProviderUsage(runId, next);
}

/**
 * Installs a server-only transport guard around Vertex requests. ADK and the
 * GenAI SDK both use fetch, so internal turns and repair calls cannot bypass
 * the same persisted request reservation.
 */
export async function withProviderBudget<T>(runId: string, repository: TaskmasterRunRepository, work: () => Promise<T>): Promise<T> {
  const previousFetch = globalThis.fetch;
  const run = await repository.get(runId);
  const identifiers: ProviderRunIdentifiers = { runId, correlationId: run?.correlationId || 'not-recorded' };
  const maxRequests = Math.max(1, numberEnv('TASKMASTER_MAX_PROVIDER_REQUESTS', 8));
  const maxTokens = Math.max(0, numberEnv('TASKMASTER_MAX_TOTAL_TOKENS', 32768));
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const parsed = new URL(url);
    if (!VERTEX_HOST.test(parsed.hostname)) return previousFetch(input, init);
    const existing = await repository.getProviderUsage(runId);
    if ((existing?.totalTokens || 0) >= maxTokens) {
      const reason = `Cumulative token ceiling of ${maxTokens} reached.`;
      await repository.recordProviderUsage(runId, { budgetStopReason: reason });
      throw new ProviderBudgetExceeded(reason);
    }
    const reservation = await repository.reserveProviderRequest(runId, maxRequests);
    if (!reservation.allowed) throw new ProviderBudgetExceeded(reservation.reason || 'Provider request budget reached.');
    const started = Date.now();
    try {
      const response = await previousFetch(input, init);
      const body = await response.clone().text();
      const baseMetadata: SafeProviderResponseMetadata = {
        httpStatus: response.status,
        contentType: response.headers.get('content-type') || undefined,
        responseBytes: new TextEncoder().encode(body).byteLength,
        requestDurationMs: Date.now() - started,
        requestId: response.headers.get('x-goog-request-id') || response.headers.get('x-request-id') || undefined,
      };
      safeResponseLog(identifiers, baseMetadata);
      await recordResponse(runId, repository, reservation.requestNumber, baseMetadata, {
        responseReceived: true,
        httpSuccess: response.ok,
        outputReceived: false,
        failureCode: response.ok ? undefined : 'NON_SUCCESS_HTTP',
      });
      if (!response.ok) {
        throw new ProviderAdapterError('NON_SUCCESS_HTTP', identifiers, baseMetadata);
      }
      try {
        const analysis = analyzeVertexEnvelope(body, baseMetadata, identifiers);
        await recordResponse(runId, repository, reservation.requestNumber, analysis.metadata, { responseReceived: false, httpSuccess: false, outputReceived: analysis.modelOutputReceived, countDuration: false });
      } catch (error) {
        if (error instanceof ProviderAdapterError) {
          await recordResponse(runId, repository, reservation.requestNumber, error.safeMetadata || baseMetadata, { responseReceived: false, httpSuccess: false, outputReceived: false, countDuration: false, failureCode: error.code });
        }
        throw error;
      }
      return response;
    } catch (error) {
      if (error instanceof ProviderAdapterError || error instanceof ProviderBudgetExceeded) throw error;
      const code = classifyConnectionFailure(error);
      const metadata: SafeProviderResponseMetadata = { requestDurationMs: Date.now() - started };
      await recordResponse(runId, repository, reservation.requestNumber, metadata, { responseReceived: false, httpSuccess: false, outputReceived: false, failureCode: code });
      throw new ProviderAdapterError(code, identifiers, metadata);
    }
  };
  try {
    return await work();
  } finally {
    globalThis.fetch = previousFetch;
  }
}
