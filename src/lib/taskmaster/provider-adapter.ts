import type { z } from 'zod';

export const providerFailureCodes = [
  'NON_SUCCESS_HTTP',
  'EMPTY_RESPONSE_BODY',
  'INVALID_RESPONSE_ENVELOPE',
  'NO_CANDIDATES',
  'SAFETY_BLOCKED',
  'MAX_TOKENS',
  'CANDIDATE_NO_TEXT',
  'INVALID_CANDIDATE_JSON',
  'SCHEMA_INVALID_OUTPUT',
  'PROVIDER_TIMEOUT',
  'PROVIDER_CONNECTION_INTERRUPTED',
] as const;

export type ProviderFailureCode = typeof providerFailureCodes[number];

export interface ProviderRunIdentifiers {
  runId: string;
  correlationId: string;
}

export interface SafeProviderResponseMetadata {
  httpStatus?: number;
  contentType?: string;
  responseBytes?: number;
  requestDurationMs: number;
  requestId?: string;
  responseId?: string;
  modelVersion?: string;
  candidateCount?: number;
  finishReasons?: string[];
  promptFeedbackBlockReason?: string;
  promptTokens?: number;
  candidateTokens?: number;
  toolUsePromptTokens?: number;
  thoughtTokens?: number;
  totalTokens?: number;
}

const SAFE_MESSAGES: Record<ProviderFailureCode, string> = {
  NON_SUCCESS_HTTP: 'Vertex returned a non-success HTTP response',
  EMPTY_RESPONSE_BODY: 'Vertex returned an empty response body',
  INVALID_RESPONSE_ENVELOPE: 'Vertex returned a truncated or invalid response envelope',
  NO_CANDIDATES: 'Vertex returned no candidates',
  SAFETY_BLOCKED: 'Vertex blocked the response for safety or policy reasons',
  MAX_TOKENS: 'Vertex stopped generation at the maximum token limit',
  CANDIDATE_NO_TEXT: 'Vertex returned a candidate with no text',
  INVALID_CANDIDATE_JSON: 'Gemini returned invalid candidate JSON',
  SCHEMA_INVALID_OUTPUT: 'Gemini output did not satisfy the SitePilot schema',
  PROVIDER_TIMEOUT: 'The Vertex request timed out',
  PROVIDER_CONNECTION_INTERRUPTED: 'The Vertex connection was interrupted',
};

export class ProviderAdapterError extends Error {
  readonly code: ProviderFailureCode;
  readonly runId: string;
  readonly correlationId: string;
  readonly safeMetadata?: SafeProviderResponseMetadata;

  constructor(code: ProviderFailureCode, identifiers: ProviderRunIdentifiers, safeMetadata?: SafeProviderResponseMetadata) {
    super(`${SAFE_MESSAGES[code]} [${code}] (run ${identifiers.runId}, correlation ${identifiers.correlationId}).`);
    this.name = 'ProviderAdapterError';
    this.code = code;
    this.runId = identifiers.runId;
    this.correlationId = identifiers.correlationId;
    this.safeMetadata = safeMetadata;
  }
}

export function isRepairEligible(error: unknown): error is ProviderAdapterError {
  return error instanceof ProviderAdapterError
    && (error.code === 'INVALID_CANDIDATE_JSON' || error.code === 'SCHEMA_INVALID_OUTPUT');
}

export function classifyConnectionFailure(error: unknown): 'PROVIDER_TIMEOUT' | 'PROVIDER_CONNECTION_INTERRUPTED' {
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError' || /timed?\s*out/i.test(error.message))) {
    return 'PROVIDER_TIMEOUT';
  }
  return 'PROVIDER_CONNECTION_INTERRUPTED';
}

export function parseStructuredCandidate<T>(
  text: string | undefined,
  schema: z.ZodType<T>,
  identifiers: ProviderRunIdentifiers,
): T {
  if (!text?.trim()) throw new ProviderAdapterError('CANDIDATE_NO_TEXT', identifiers);
  let candidate: unknown;
  try {
    candidate = JSON.parse(text);
  } catch {
    throw new ProviderAdapterError('INVALID_CANDIDATE_JSON', identifiers);
  }
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) throw new ProviderAdapterError('SCHEMA_INVALID_OUTPUT', identifiers);
  return parsed.data;
}

function numberValue(record: Record<string, unknown> | undefined, camel: string): number {
  if (!record) return 0;
  const snake = camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const value = Number(record[camel] ?? record[snake] ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function stringValue(record: Record<string, unknown>, camel: string): string | undefined {
  const snake = camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  const value = record[camel] ?? record[snake];
  return typeof value === 'string' && value ? value : undefined;
}

export interface VertexEnvelopeAnalysis {
  metadata: SafeProviderResponseMetadata;
  modelOutputReceived: boolean;
}

export function analyzeVertexEnvelope(
  body: string,
  base: SafeProviderResponseMetadata,
  identifiers: ProviderRunIdentifiers,
): VertexEnvelopeAnalysis {
  if (body.length === 0) throw new ProviderAdapterError('EMPTY_RESPONSE_BODY', identifiers, base);
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ProviderAdapterError('INVALID_RESPONSE_ENVELOPE', identifiers, base);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProviderAdapterError('INVALID_RESPONSE_ENVELOPE', identifiers, base);
  }
  const envelope = value as Record<string, unknown>;
  const usage = (envelope.usageMetadata ?? envelope.usage_metadata) as Record<string, unknown> | undefined;
  const candidates = Array.isArray(envelope.candidates) ? envelope.candidates : [];
  const promptFeedback = (envelope.promptFeedback ?? envelope.prompt_feedback) as Record<string, unknown> | undefined;
  const blockReason = promptFeedback ? stringValue(promptFeedback, 'blockReason') : undefined;
  const finishReasons = candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const reason = stringValue(candidate as Record<string, unknown>, 'finishReason');
    return reason ? [reason] : [];
  });
  const metadata: SafeProviderResponseMetadata = {
    ...base,
    responseId: stringValue(envelope, 'responseId'),
    modelVersion: stringValue(envelope, 'modelVersion'),
    candidateCount: candidates.length,
    finishReasons,
    promptFeedbackBlockReason: blockReason,
    promptTokens: numberValue(usage, 'promptTokenCount'),
    candidateTokens: numberValue(usage, 'candidatesTokenCount'),
    toolUsePromptTokens: numberValue(usage, 'toolUsePromptTokenCount'),
    thoughtTokens: numberValue(usage, 'thoughtsTokenCount'),
    totalTokens: numberValue(usage, 'totalTokenCount'),
  };
  if (candidates.length === 0) {
    throw new ProviderAdapterError(blockReason ? 'SAFETY_BLOCKED' : 'NO_CANDIDATES', identifiers, metadata);
  }
  const safetyReasons = new Set(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION']);
  if (blockReason || finishReasons.some((reason) => safetyReasons.has(reason))) {
    throw new ProviderAdapterError('SAFETY_BLOCKED', identifiers, metadata);
  }
  if (finishReasons.includes('MAX_TOKENS')) throw new ProviderAdapterError('MAX_TOKENS', identifiers, metadata);
  const hasText = candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const content = ((candidate as Record<string, unknown>).content ?? {}) as Record<string, unknown>;
    const parts = Array.isArray(content.parts) ? content.parts : [];
    return parts.some((part) => part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string' && Boolean(((part as Record<string, unknown>).text as string).trim()));
  });
  if (!hasText) throw new ProviderAdapterError('CANDIDATE_NO_TEXT', identifiers, metadata);
  return { metadata, modelOutputReceived: true };
}
