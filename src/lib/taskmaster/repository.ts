import { createHash } from 'node:crypto';
import type { TaskmasterProviderUsage, TaskmasterRunRecord } from './schemas';

function emptyProviderUsage(): TaskmasterProviderUsage {
  return {
    providerRequests: 0,
    successfulProviderRequests: 0,
    providerResponses: 0,
    modelOutputsReceived: 0,
    modelOutputsSchemaAccepted: 0,
    repairRequests: 0,
    outcome: 'NO_REQUEST',
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

function idempotencyKeyHash(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export interface TaskmasterRunRepository {
  create(run: TaskmasterRunRecord): Promise<TaskmasterRunRecord>;
  get(runId: string): Promise<TaskmasterRunRecord | undefined>;
  findByIdempotencyKey(key: string): Promise<TaskmasterRunRecord | undefined>;
  save(run: TaskmasterRunRecord): Promise<TaskmasterRunRecord>;
  acquireLease(runId: string, owner: string, leaseMs: number): Promise<TaskmasterRunRecord | undefined>;
  releaseLease(runId: string, owner: string): Promise<void>;
  reserveProviderRequest(runId: string, limit: number): Promise<{ allowed: boolean; requestNumber: number; reason?: string }>;
  recordProviderUsage(runId: string, usage: Partial<TaskmasterProviderUsage>): Promise<void>;
  getProviderUsage(runId: string): Promise<TaskmasterProviderUsage | undefined>;
}

/** Local Firestore substitute with the same optimistic-concurrency contract. */
export class InMemoryTaskmasterRunRepository implements TaskmasterRunRepository {
  private readonly runs = new Map<string, TaskmasterRunRecord>();
  private readonly providerUsage = new Map<string, TaskmasterProviderUsage>();

  async create(run: TaskmasterRunRecord): Promise<TaskmasterRunRecord> {
    if (this.runs.has(run.runId) || [...this.runs.values()].some((candidate) => candidate.idempotencyKey === run.idempotencyKey)) {
      throw new Error(`Taskmaster idempotency key already exists: ${run.idempotencyKey}`);
    }
    const created = structuredClone({ ...run, revision: run.revision ?? 0 });
    this.runs.set(run.runId, created);
    return structuredClone(created);
  }

  async get(runId: string): Promise<TaskmasterRunRecord | undefined> {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : undefined;
  }

  async findByIdempotencyKey(key: string): Promise<TaskmasterRunRecord | undefined> {
    for (const run of this.runs.values()) if (run.idempotencyKey === key) return structuredClone(run);
    return undefined;
  }

  async save(run: TaskmasterRunRecord): Promise<TaskmasterRunRecord> {
    const current = this.runs.get(run.runId);
    if (!current) throw new Error(`Taskmaster run ${run.runId} does not exist.`);
    if ((run.revision ?? 0) !== current.revision) throw new Error(`Taskmaster run ${run.runId} has a stale revision.`);
    const saved = structuredClone({ ...run, revision: current.revision + 1 });
    this.runs.set(run.runId, saved);
    return structuredClone(saved);
  }

  async acquireLease(runId: string, owner: string, leaseMs: number): Promise<TaskmasterRunRecord | undefined> {
    const current = this.runs.get(runId);
    if (!current) return undefined;
    const active = current.leaseOwner && current.leaseOwner !== owner && current.leaseExpiresAt && Date.parse(current.leaseExpiresAt) > Date.now();
    if (active) return undefined;
    const leased = structuredClone({ ...current, leaseOwner: owner, leaseExpiresAt: new Date(Date.now() + leaseMs).toISOString() });
    this.runs.set(runId, leased);
    return structuredClone(leased);
  }

  async releaseLease(runId: string, owner: string): Promise<void> {
    const current = this.runs.get(runId);
    if (current?.leaseOwner === owner) this.runs.set(runId, structuredClone({ ...current, leaseOwner: undefined, leaseExpiresAt: undefined }));
  }

  async reserveProviderRequest(runId: string, limit: number) {
    const current = this.providerUsage.get(runId) || emptyProviderUsage();
    if (current.providerRequests >= limit) {
      current.budgetStopReason = `Provider request ceiling of ${limit} reached.`;
      this.providerUsage.set(runId, structuredClone(current));
      return { allowed: false, requestNumber: current.providerRequests, reason: current.budgetStopReason };
    }
    current.providerRequests += 1;
    this.providerUsage.set(runId, structuredClone(current));
    return { allowed: true, requestNumber: current.providerRequests };
  }

  async recordProviderUsage(runId: string, usage: Partial<TaskmasterProviderUsage>) {
    const current = this.providerUsage.get(runId) || emptyProviderUsage();
    this.providerUsage.set(runId, structuredClone({ ...current, ...usage }));
  }

  async getProviderUsage(runId: string) { return this.providerUsage.get(runId) ? structuredClone(this.providerUsage.get(runId)) : undefined; }
}

type FirestoreLike = import('@google-cloud/firestore').Firestore;

class FirestoreTaskmasterRunRepository implements TaskmasterRunRepository {
  private readonly runsCollection = process.env.TASKMASTER_FIRESTORE_COLLECTION || 'taskmasterRuns';
  private readonly idempotencyCollection = process.env.TASKMASTER_FIRESTORE_IDEMPOTENCY_COLLECTION || 'taskmasterIdempotency';
  private readonly providerUsageCollection = process.env.TASKMASTER_FIRESTORE_USAGE_COLLECTION || 'taskmasterProviderUsage';

  constructor(private readonly db: FirestoreLike) {}

  private runRef(runId: string) { return this.db.collection(this.runsCollection).doc(runId); }

  async create(run: TaskmasterRunRecord): Promise<TaskmasterRunRecord> {
    const created = { ...run, revision: run.revision ?? 0 };
    await this.db.runTransaction(async (transaction) => {
      const runRef = this.runRef(created.runId);
      const idempotencyRef = this.db.collection(this.idempotencyCollection).doc(idempotencyKeyHash(created.idempotencyKey));
      const [runSnapshot, idempotencySnapshot] = await Promise.all([transaction.get(runRef), transaction.get(idempotencyRef)]);
      if (runSnapshot.exists || idempotencySnapshot.exists) throw new Error(`Taskmaster idempotency key already exists: ${created.idempotencyKey}`);
      transaction.create(runRef, created);
      transaction.create(idempotencyRef, { runId: created.runId, correlationId: created.correlationId, createdAt: created.createdAt, expiresAt: created.expiresAt || null });
      transaction.create(runRef.collection('events').doc('00000000-created'), { type: 'RUN_CREATED', state: created.state, step: created.currentStep || null, correlationId: created.correlationId, createdAt: created.createdAt });
    });
    return structuredClone(created);
  }

  async get(runId: string): Promise<TaskmasterRunRecord | undefined> {
    const snapshot = await this.runRef(runId).get();
    if (!snapshot.exists) return undefined;
    return snapshot.data() as TaskmasterRunRecord;
  }

  async findByIdempotencyKey(key: string): Promise<TaskmasterRunRecord | undefined> {
    const idempotency = await this.db.collection(this.idempotencyCollection).doc(idempotencyKeyHash(key)).get();
    if (!idempotency.exists) return undefined;
    const runId = (idempotency.data() as { runId?: string }).runId;
    return runId ? this.get(runId) : undefined;
  }

  async save(run: TaskmasterRunRecord): Promise<TaskmasterRunRecord> {
    let saved: TaskmasterRunRecord = run;
    await this.db.runTransaction(async (transaction) => {
      const ref = this.runRef(run.runId);
      const currentSnapshot = await transaction.get(ref);
      if (!currentSnapshot.exists) throw new Error(`Taskmaster run ${run.runId} does not exist.`);
      const current = currentSnapshot.data() as TaskmasterRunRecord;
      if ((run.revision ?? 0) !== (current.revision ?? 0)) throw new Error(`Taskmaster run ${run.runId} has a stale revision.`);
      saved = { ...run, revision: (current.revision ?? 0) + 1 };
      transaction.set(ref, saved, { merge: false });
      const eventId = `${String(saved.revision).padStart(8, '0')}-${saved.state.toLowerCase()}`;
      transaction.set(ref.collection('events').doc(eventId), { state: saved.state, step: saved.currentStep || null, correlationId: saved.correlationId, revision: saved.revision, activityCount: saved.activities.length, createdAt: saved.updatedAt });
      for (const proposal of saved.generation?.proposals || []) {
        transaction.set(ref.collection('proposals').doc(proposal.id), { ...proposal, runId: saved.runId, sourceStudyVersion: saved.sourceStudyVersion, updatedAt: saved.updatedAt }, { merge: true });
      }
    });
    return structuredClone(saved);
  }

  async acquireLease(runId: string, owner: string, leaseMs: number): Promise<TaskmasterRunRecord | undefined> {
    let leased: TaskmasterRunRecord | undefined;
    await this.db.runTransaction(async (transaction) => {
      const ref = this.runRef(runId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return;
      const current = snapshot.data() as TaskmasterRunRecord;
      const active = current.leaseOwner && current.leaseOwner !== owner && current.leaseExpiresAt && Date.parse(current.leaseExpiresAt) > Date.now();
      if (active) return;
      leased = { ...current, leaseOwner: owner, leaseExpiresAt: new Date(Date.now() + leaseMs).toISOString(), revision: (current.revision ?? 0) + 1 };
      transaction.set(ref, leased, { merge: false });
    });
    return leased ? structuredClone(leased) : undefined;
  }

  async releaseLease(runId: string, owner: string): Promise<void> {
    await this.db.runTransaction(async (transaction) => {
      const ref = this.runRef(runId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return;
      const current = snapshot.data() as TaskmasterRunRecord;
      if (current.leaseOwner !== owner) return;
      transaction.set(ref, { ...current, leaseOwner: null, leaseExpiresAt: null, revision: (current.revision ?? 0) + 1 }, { merge: false });
    });
  }

  async reserveProviderRequest(runId: string, limit: number) {
    let result = { allowed: false, requestNumber: 0, reason: undefined as string | undefined };
    await this.db.runTransaction(async (transaction) => {
      const ref = this.db.collection(this.providerUsageCollection).doc(runId);
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists ? snapshot.data() as Partial<TaskmasterProviderUsage> : {};
      const count = Number(current.providerRequests || 0);
      if (count >= limit) {
        const reason = `Provider request ceiling of ${limit} reached.`;
        transaction.set(ref, { ...current, providerRequests: count, budgetStopReason: reason, updatedAt: new Date().toISOString() }, { merge: true });
        result = { allowed: false, requestNumber: count, reason };
        return;
      }
      const next = count + 1;
      transaction.set(ref, { ...current, providerRequests: next, updatedAt: new Date().toISOString(), costConfigVersion: current.costConfigVersion || process.env.TASKMASTER_COST_CONFIG_VERSION || '2026-08-sitepilot-v1' }, { merge: true });
      transaction.create(ref.collection('requests').doc(String(next).padStart(4, '0')), { requestNumber: next, startedAt: new Date().toISOString() });
      result = { allowed: true, requestNumber: next, reason: undefined };
    });
    return result;
  }

  async recordProviderUsage(runId: string, usage: Partial<TaskmasterProviderUsage>) {
    const ref = this.db.collection(this.providerUsageCollection).doc(runId);
    await ref.set({ ...usage, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async getProviderUsage(runId: string) {
    const snapshot = await this.db.collection(this.providerUsageCollection).doc(runId).get();
    return snapshot.exists ? snapshot.data() as TaskmasterProviderUsage : undefined;
  }
}

let repositoryPromise: Promise<TaskmasterRunRepository> | undefined;
let localRepository: InMemoryTaskmasterRunRepository | undefined;

function firestoreEnabled(): boolean {
  return process.env.TASKMASTER_FIRESTORE_ENABLED === 'true' || Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

export async function getTaskmasterRunRepository(): Promise<TaskmasterRunRepository> {
  if (!firestoreEnabled()) {
    localRepository ||= new InMemoryTaskmasterRunRepository();
    return localRepository;
  }
  repositoryPromise ||= (async () => {
    const { Firestore } = await import('@google-cloud/firestore');
    const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT, ignoreUndefinedProperties: true });
    return new FirestoreTaskmasterRunRepository(db);
  })();
  return repositoryPromise;
}

export function resetTaskmasterRepositoryForTests(): void {
  repositoryPromise = undefined;
  localRepository = new InMemoryTaskmasterRunRepository();
}
