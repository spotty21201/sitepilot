import type { TaskmasterProviderUsage } from './schemas';
import type { TaskmasterRunRepository } from './repository';

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

function usageFromBody(body: unknown): { prompt: number; candidate: number; tool: number; thought: number; total: number; responseId?: string; actualModel?: string } {
  if (!body || typeof body !== 'object') return { prompt: 0, candidate: 0, tool: 0, thought: 0, total: 0 };
  const record = body as Record<string, unknown>;
  const metadata = (record.usageMetadata || record.usage_metadata) as Record<string, unknown> | undefined;
  if (!metadata) return { prompt: 0, candidate: 0, tool: 0, thought: 0, total: 0 };
  const value = (name: string) => Number(metadata[name] || metadata[name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] || 0);
  return {
    prompt: value('promptTokenCount'),
    candidate: value('candidatesTokenCount'),
    tool: value('toolUsePromptTokenCount'),
    thought: value('thoughtsTokenCount'),
    total: value('totalTokenCount'),
    responseId: typeof record.responseId === 'string' ? record.responseId : undefined,
    actualModel: typeof record.modelVersion === 'string' ? record.modelVersion : undefined,
  };
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

/**
 * Installs a server-only transport guard around Vertex requests. ADK and the
 * GenAI SDK both use fetch, so internal turns and repair calls cannot bypass
 * the same persisted request reservation.
 */
export async function withProviderBudget<T>(runId: string, repository: TaskmasterRunRepository, work: () => Promise<T>): Promise<T> {
  const previousFetch = globalThis.fetch;
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
      const parsedBody = await response.clone().json().catch(() => undefined);
      const requestUsage = usageFromBody(parsedBody);
      const current = await repository.getProviderUsage(runId);
      const next: TaskmasterProviderUsage = {
        ...(current || { providerRequests: reservation.requestNumber, successfulProviderRequests: 0, promptTokens: 0, candidateTokens: 0, toolUsePromptTokens: 0, thoughtTokens: 0, totalTokens: 0, modelLatencyMs: 0, repairCount: 0, costConfigVersion: process.env.TASKMASTER_COST_CONFIG_VERSION || '2026-08-sitepilot-v1' }),
        provider: 'VERTEX_AI',
        location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
        requestedModel: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
        actualModel: requestUsage.actualModel || current?.actualModel,
        successfulProviderRequests: (current?.successfulProviderRequests || 0) + (response.ok ? 1 : 0),
        promptTokens: (current?.promptTokens || 0) + requestUsage.prompt,
        candidateTokens: (current?.candidateTokens || 0) + requestUsage.candidate,
        toolUsePromptTokens: (current?.toolUsePromptTokens || 0) + requestUsage.tool,
        thoughtTokens: (current?.thoughtTokens || 0) + requestUsage.thought,
        totalTokens: (current?.totalTokens || 0) + requestUsage.total,
        modelLatencyMs: (current?.modelLatencyMs || 0) + (Date.now() - started),
        responseIds: [...(current?.responseIds || []), ...(requestUsage.responseId ? [requestUsage.responseId] : [])].slice(-20),
        costConfigVersion: current?.costConfigVersion || process.env.TASKMASTER_COST_CONFIG_VERSION || '2026-08-sitepilot-v1',
        estimatedCostUsd: undefined,
      };
      next.estimatedCostUsd = estimateCost(next);
      await repository.recordProviderUsage(runId, next);
      return response;
    } catch (error) {
      await repository.recordProviderUsage(runId, { modelLatencyMs: (await repository.getProviderUsage(runId))?.modelLatencyMs || (Date.now() - started) });
      throw error;
    }
  };
  try {
    return await work();
  } finally {
    globalThis.fetch = previousFetch;
  }
}
