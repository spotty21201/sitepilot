import { createHash } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';

export interface TaskmasterAllowance {
  allowed: boolean;
  forceFallback: boolean;
  reason?: string;
  dayCount: number;
  sessionCount: number;
}

const localCounters = new Map<string, { count: number; expiresAt: number }>();

function hash(value: string): string {
  const salt = process.env.TASKMASTER_RATE_LIMIT_SALT || process.env.GOOGLE_CLOUD_PROJECT || 'sitepilot-local-rate-limit';
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function windows() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  return { day, hour };
}

export async function consumeTaskmasterAllowance(sessionKey: string): Promise<TaskmasterAllowance> {
  const { day, hour } = windows();
  const dayLimit = Number(process.env.TASKMASTER_DAILY_RUN_LIMIT || 20);
  const sessionLimit = Number(process.env.TASKMASTER_SESSION_RUN_LIMIT || 2);
  const sessionHash = hash(sessionKey || 'anonymous-session');
  if (process.env.TASKMASTER_FIRESTORE_ENABLED !== 'true') {
    const dayKey = `day:${day}`;
    const sessionKeyValue = `session:${sessionHash}:${hour}`;
    const currentDay = localCounters.get(dayKey) || { count: 0, expiresAt: Date.now() + 86_400_000 };
    const currentSession = localCounters.get(sessionKeyValue) || { count: 0, expiresAt: Date.now() + 3_600_000 };
    if (currentDay.count >= dayLimit || currentSession.count >= sessionLimit) {
      return { allowed: false, forceFallback: true, reason: 'The live generation allowance is exhausted; study templates will be used.', dayCount: currentDay.count, sessionCount: currentSession.count };
    }
    currentDay.count += 1;
    currentSession.count += 1;
    localCounters.set(dayKey, currentDay);
    localCounters.set(sessionKeyValue, currentSession);
    return { allowed: true, forceFallback: false, dayCount: currentDay.count, sessionCount: currentSession.count };
  }
  const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT });
  const collection = process.env.TASKMASTER_RATE_LIMIT_COLLECTION || 'taskmasterRateLimits';
  const dayRef = db.collection(collection).doc(`day-${day}`);
  const sessionRef = db.collection(collection).doc(`session-${sessionHash}-${hour}`);
  let result: TaskmasterAllowance = { allowed: false, forceFallback: true, reason: 'The live generation allowance is exhausted; study templates will be used.', dayCount: 0, sessionCount: 0 };
  await db.runTransaction(async (transaction) => {
    const [daySnapshot, sessionSnapshot] = await Promise.all([transaction.get(dayRef), transaction.get(sessionRef)]);
    const dayCount = Number(daySnapshot.data()?.count || 0);
    const sessionCount = Number(sessionSnapshot.data()?.count || 0);
    if (dayCount >= dayLimit || sessionCount >= sessionLimit) {
      result = { ...result, dayCount, sessionCount };
      return;
    }
    transaction.set(dayRef, { count: dayCount + 1, window: day, updatedAt: new Date().toISOString() }, { merge: true });
    transaction.set(sessionRef, { count: sessionCount + 1, window: hour, subjectHash: sessionHash, updatedAt: new Date().toISOString() }, { merge: true });
    result = { allowed: true, forceFallback: false, dayCount: dayCount + 1, sessionCount: sessionCount + 1 };
  });
  return result;
}
