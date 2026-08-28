import { createHash } from 'node:crypto';

export interface TaskmasterAllowance {
  allowed: boolean;
  forceFallback: boolean;
  reason?: string;
  dayCount: number;
  sessionCount: number;
}

export interface AssessmentAllowance {
  allowed: boolean;
  reason?: string;
  dayCount: number;
  sessionCount: number;
}

export interface RateLimitFirestore {
  collection(name: string): { doc(id: string): unknown };
  runTransaction<T>(work: (transaction: {
    get(ref: unknown): Promise<{ data(): Record<string, unknown> | undefined }>;
    set(ref: unknown, data: Record<string, unknown>, options: { merge: true }): void;
  }) => Promise<T>): Promise<T>;
}

const localCounters = new Map<string, { count: number; expiresAt: number }>();

export function hashRateLimitSubject(value: string, namespace = 'taskmaster'): string {
  const salt = process.env.TASKMASTER_RATE_LIMIT_SALT || process.env.GOOGLE_CLOUD_PROJECT || 'sitepilot-local-rate-limit';
  return createHash('sha256').update(`${salt}:${namespace}:${value}`).digest('hex');
}

function windows() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  return { day, hour };
}

interface AllowanceConfig {
  namespace: string;
  dayLimitEnv: string;
  sessionLimitEnv: string;
  defaultDayLimit: number;
  defaultSessionLimit: number;
  collectionEnv: string;
  defaultCollection: string;
  exhaustedReason: string;
}

function limit(name: string, fallback: number): number {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : fallback;
}

async function consumeAllowance(sessionKey: string, config: AllowanceConfig, firestore?: RateLimitFirestore): Promise<AssessmentAllowance> {
  const { day, hour } = windows();
  const dayLimit = limit(config.dayLimitEnv, config.defaultDayLimit);
  const sessionLimit = limit(config.sessionLimitEnv, config.defaultSessionLimit);
  const sessionHash = hashRateLimitSubject(sessionKey || 'anonymous-session', config.namespace);
  const denied = (dayCount: number, sessionCount: number): AssessmentAllowance => ({
    allowed: false,
    reason: config.exhaustedReason,
    dayCount,
    sessionCount,
  });
  if (process.env.TASKMASTER_FIRESTORE_ENABLED !== 'true') {
    const dayKey = `${config.namespace}:day:${day}`;
    const sessionKeyValue = `${config.namespace}:session:${sessionHash}:${hour}`;
    const currentDay = localCounters.get(dayKey) || { count: 0, expiresAt: Date.now() + 86_400_000 };
    const currentSession = localCounters.get(sessionKeyValue) || { count: 0, expiresAt: Date.now() + 3_600_000 };
    if (currentDay.count >= dayLimit || currentSession.count >= sessionLimit) {
      return denied(currentDay.count, currentSession.count);
    }
    currentDay.count += 1;
    currentSession.count += 1;
    localCounters.set(dayKey, currentDay);
    localCounters.set(sessionKeyValue, currentSession);
    return { allowed: true, dayCount: currentDay.count, sessionCount: currentSession.count };
  }
  let db = firestore;
  if (!db) {
    const { Firestore } = await import('@google-cloud/firestore');
    db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT }) as unknown as RateLimitFirestore;
  }
  const collection = process.env[config.collectionEnv] || config.defaultCollection;
  const dayRef = db.collection(collection).doc(`day-${day}`);
  const sessionRef = db.collection(collection).doc(`session-${sessionHash}-${hour}`);
  let result: AssessmentAllowance = denied(0, 0);
  await db.runTransaction(async (transaction) => {
    const [daySnapshot, sessionSnapshot] = await Promise.all([transaction.get(dayRef), transaction.get(sessionRef)]);
    const dayCount = Number(daySnapshot.data()?.count || 0);
    const sessionCount = Number(sessionSnapshot.data()?.count || 0);
    if (dayCount >= dayLimit || sessionCount >= sessionLimit) {
      result = denied(dayCount, sessionCount);
      return;
    }
    const updatedAt = new Date().toISOString();
    transaction.set(dayRef, { count: dayCount + 1, window: day, updatedAt }, { merge: true });
    transaction.set(sessionRef, { count: sessionCount + 1, window: hour, subjectHash: sessionHash, updatedAt }, { merge: true });
    result = { allowed: true, dayCount: dayCount + 1, sessionCount: sessionCount + 1 };
  });
  return result;
}

export async function consumeTaskmasterAllowance(sessionKey: string): Promise<TaskmasterAllowance> {
  const result = await consumeAllowance(sessionKey, {
    namespace: 'taskmaster',
    dayLimitEnv: 'TASKMASTER_DAILY_RUN_LIMIT',
    sessionLimitEnv: 'TASKMASTER_SESSION_RUN_LIMIT',
    defaultDayLimit: 20,
    defaultSessionLimit: 2,
    collectionEnv: 'TASKMASTER_RATE_LIMIT_COLLECTION',
    defaultCollection: 'taskmasterRateLimits',
    exhaustedReason: 'The live generation allowance is exhausted; study templates will be used.',
  });
  return { ...result, forceFallback: !result.allowed };
}

export async function consumeAssessmentAllowance(sessionKey: string, firestore?: RateLimitFirestore): Promise<AssessmentAllowance> {
  return consumeAllowance(sessionKey, {
    namespace: 'assessment',
    dayLimitEnv: 'ASSESSMENT_DAILY_LIVE_LIMIT',
    sessionLimitEnv: 'ASSESSMENT_SESSION_HOURLY_LIMIT',
    defaultDayLimit: 10,
    defaultSessionLimit: 1,
    collectionEnv: 'ASSESSMENT_RATE_LIMIT_COLLECTION',
    defaultCollection: 'assessmentRateLimits',
    exhaustedReason: 'The live assessment allowance is exhausted; a deterministic summary was used.',
  }, firestore);
}

export function resetRateLimitStateForTests(): void {
  localCounters.clear();
}
