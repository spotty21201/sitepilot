import type { TaskmasterRunRecord } from './schemas';

export interface TaskmasterRunRepository {
  create(run: TaskmasterRunRecord): Promise<void>;
  get(runId: string): Promise<TaskmasterRunRecord | undefined>;
  findByIdempotencyKey(key: string): Promise<TaskmasterRunRecord | undefined>;
  save(run: TaskmasterRunRecord): Promise<void>;
}

/**
 * Local substitute used by development and automated tests. It deliberately
 * has the same async contract as Firestore so the workflow cannot bypass the
 * persistence boundary when the hosted service is enabled later.
 */
export class InMemoryTaskmasterRunRepository implements TaskmasterRunRepository {
  private readonly runs = new Map<string, TaskmasterRunRecord>();

  async create(run: TaskmasterRunRecord): Promise<void> {
    if (this.runs.has(run.runId)) throw new Error(`Taskmaster run ${run.runId} already exists.`);
    this.runs.set(run.runId, structuredClone(run));
  }

  async get(runId: string): Promise<TaskmasterRunRecord | undefined> {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : undefined;
  }

  async findByIdempotencyKey(key: string): Promise<TaskmasterRunRecord | undefined> {
    for (const run of this.runs.values()) {
      if (run.idempotencyKey === key) return structuredClone(run);
    }
    return undefined;
  }

  async save(run: TaskmasterRunRecord): Promise<void> {
    if (!this.runs.has(run.runId)) throw new Error(`Taskmaster run ${run.runId} does not exist.`);
    this.runs.set(run.runId, structuredClone(run));
  }
}

interface FirestoreDocumentReference {
  create(value: TaskmasterRunRecord): Promise<unknown>;
  get(): Promise<{ exists: boolean; data(): unknown }>;
  set(value: TaskmasterRunRecord, options: { merge: boolean }): Promise<unknown>;
}

interface FirestoreCollection {
  doc(id: string): FirestoreDocumentReference;
  where(field: string, op: '==', value: string): { limit(count: number): { get(): Promise<{ empty: boolean; docs: Array<{ data(): unknown }> }> } };
}

class FirestoreTaskmasterRunRepository implements TaskmasterRunRepository {
  private readonly collectionName = process.env.TASKMASTER_FIRESTORE_COLLECTION || 'sitepilot_taskmaster_runs';

  constructor(private readonly db: { collection: (name: string) => FirestoreCollection }) {}

  async create(run: TaskmasterRunRecord): Promise<void> {
    await this.db.collection(this.collectionName).doc(run.runId).create(run);
  }

  async get(runId: string): Promise<TaskmasterRunRecord | undefined> {
    const snapshot = await this.db.collection(this.collectionName).doc(runId).get();
    if (!snapshot.exists) return undefined;
    return snapshot.data() as TaskmasterRunRecord;
  }

  async findByIdempotencyKey(key: string): Promise<TaskmasterRunRecord | undefined> {
    const snapshot = await this.db.collection(this.collectionName).where('idempotencyKey', '==', key).limit(1).get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data() as TaskmasterRunRecord;
  }

  async save(run: TaskmasterRunRecord): Promise<void> {
    await this.db.collection(this.collectionName).doc(run.runId).set(run, { merge: false });
  }
}

let repositoryPromise: Promise<TaskmasterRunRepository> | undefined;
let localRepository: InMemoryTaskmasterRunRepository | undefined;

function firestoreEnabled(): boolean {
  return process.env.TASKMASTER_FIRESTORE_ENABLED === 'true'
    || Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

export async function getTaskmasterRunRepository(): Promise<TaskmasterRunRepository> {
  if (!firestoreEnabled()) {
    localRepository ||= new InMemoryTaskmasterRunRepository();
    return localRepository;
  }
  repositoryPromise ||= (async () => {
    const { Firestore } = await import('@google-cloud/firestore');
    const db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT,
      ignoreUndefinedProperties: true,
    });
    return new FirestoreTaskmasterRunRepository(db);
  })();
  return repositoryPromise;
}

export function resetTaskmasterRepositoryForTests(): void {
  repositoryPromise = undefined;
  localRepository = new InMemoryTaskmasterRunRepository();
}
