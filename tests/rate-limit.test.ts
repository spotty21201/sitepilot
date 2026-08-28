import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumeAssessmentAllowance,
  consumeTaskmasterAllowance,
  hashRateLimitSubject,
  type RateLimitFirestore,
  resetRateLimitStateForTests,
} from '@/lib/taskmaster/rate-limit';

const firestoreState = {
  documents: new Map<string, Record<string, unknown>>(),
  writes: [] as Array<{ path: string; data: Record<string, unknown> }>,
  queue: Promise.resolve(),
};

const fakeFirestore: RateLimitFirestore = {
  collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
  async runTransaction<T>(work: (transaction: {
    get(ref: unknown): Promise<{ data(): Record<string, unknown> | undefined }>;
    set(ref: unknown, data: Record<string, unknown>, options: { merge: true }): void;
  }) => Promise<T>): Promise<T> {
    let result!: T;
    const pendingTransaction = firestoreState.queue.then(async () => {
      const pendingWrites: Array<{ path: string; data: Record<string, unknown> }> = [];
      result = await work({
        get: async (ref) => ({ data: () => firestoreState.documents.get((ref as { path: string }).path) }),
        set: (ref, data) => pendingWrites.push({ path: (ref as { path: string }).path, data }),
      });
      for (const write of pendingWrites) {
        firestoreState.documents.set(write.path, { ...(firestoreState.documents.get(write.path) || {}), ...write.data });
        firestoreState.writes.push(write);
      }
    });
    firestoreState.queue = pendingTransaction.then(() => undefined);
    await pendingTransaction;
    return result;
  },
};

describe('public inference allowance guards', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLOUD_PROJECT: 'synthetic-project',
      TASKMASTER_RATE_LIMIT_SALT: 'synthetic-test-salt',
      TASKMASTER_FIRESTORE_ENABLED: 'false',
      TASKMASTER_DAILY_RUN_LIMIT: '10',
      TASKMASTER_SESSION_RUN_LIMIT: '1',
      ASSESSMENT_DAILY_LIVE_LIMIT: '10',
      ASSESSMENT_SESSION_HOURLY_LIMIT: '1',
    };
    resetRateLimitStateForTests();
    firestoreState.documents.clear();
    firestoreState.writes.length = 0;
    firestoreState.queue = Promise.resolve();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('forces deterministic Taskmaster fallback after one run in the session window', async () => {
    expect(await consumeTaskmasterAllowance('browser-session')).toMatchObject({ allowed: true, forceFallback: false, sessionCount: 1 });
    expect(await consumeTaskmasterAllowance('browser-session')).toMatchObject({
      allowed: false,
      forceFallback: true,
      sessionCount: 1,
      reason: 'The live generation allowance is exhausted; study templates will be used.',
    });
  });

  it('allows only one concurrent live assessment reservation per session hour', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => consumeAssessmentAllowance('concurrent-session')));
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toHaveLength(7);
  });

  it('enforces the global assessment daily limit across different sessions', async () => {
    process.env.ASSESSMENT_DAILY_LIVE_LIMIT = '2';
    expect((await consumeAssessmentAllowance('session-a')).allowed).toBe(true);
    expect((await consumeAssessmentAllowance('session-b')).allowed).toBe(true);
    const denied = await consumeAssessmentAllowance('session-c');
    expect(denied).toMatchObject({ allowed: false, dayCount: 2 });
  });

  it('persists only salted session hashes in Firestore-backed counters', async () => {
    process.env.TASKMASTER_FIRESTORE_ENABLED = 'true';
    const rawSession = 'raw-browser-session-value';
    const result = await consumeAssessmentAllowance(rawSession, fakeFirestore);
    expect(result.allowed).toBe(true);
    const persisted = JSON.stringify(firestoreState.writes);
    expect(persisted).not.toContain(rawSession);
    expect(persisted).toContain(hashRateLimitSubject(rawSession, 'assessment'));
    expect(firestoreState.writes.some((write) => write.path.startsWith('assessmentRateLimits/session-'))).toBe(true);
  });

  it('uses a Firestore transaction to serialize concurrent reservations', async () => {
    process.env.TASKMASTER_FIRESTORE_ENABLED = 'true';
    const results = await Promise.all(Array.from({ length: 5 }, () => consumeAssessmentAllowance('firestore-concurrent-session', fakeFirestore)));
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(firestoreState.writes.filter((write) => write.path.startsWith('assessmentRateLimits/session-'))).toHaveLength(1);
  });
});
