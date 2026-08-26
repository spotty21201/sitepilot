import { executeTaskmasterRun } from './runner';
import { getTaskmasterRunRepository } from './repository';

export interface TaskmasterEnqueueResult {
  mode: 'LOCAL_DEVELOPMENT' | 'CLOUD_TASKS';
  taskName?: string;
}

function cloudTasksConfigured(): boolean {
  return Boolean(
    process.env.TASKMASTER_CLOUD_TASKS_QUEUE
    && process.env.GOOGLE_CLOUD_PROJECT
    && process.env.TASKMASTER_WORKER_URL
  );
}

async function enqueueCloudTask(runId: string, correlationId?: string, deliverySuffix = 'initial'): Promise<TaskmasterEnqueueResult> {
  const { CloudTasksClient } = await import('@google-cloud/tasks');
  const client = new CloudTasksClient();
  const project = process.env.GOOGLE_CLOUD_PROJECT!;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-southeast2';
  const queue = process.env.TASKMASTER_CLOUD_TASKS_QUEUE!;
  const parent = client.queuePath(project, location, queue);
  const deliveryId = `delivery-${runId}-${deliverySuffix}`;
  const payload = Buffer.from(JSON.stringify({ runId, deliveryId, correlationId })).toString('base64');
  const task: Record<string, unknown> = {
    name: client.taskPath(project, location, queue, `taskmaster-${runId}-${deliverySuffix}`),
    httpRequest: {
      httpMethod: 'POST',
      url: process.env.TASKMASTER_WORKER_URL!,
      headers: { 'content-type': 'application/json' },
      body: payload,
    },
  };
  if (process.env.TASKMASTER_WORKER_SECRET) {
    (task.httpRequest as Record<string, unknown>).headers = {
      ...((task.httpRequest as Record<string, unknown>).headers as Record<string, string>),
      'x-sitepilot-taskmaster-secret': process.env.TASKMASTER_WORKER_SECRET,
    };
  }
  if (process.env.TASKMASTER_SERVICE_ACCOUNT_EMAIL) {
    (task.httpRequest as Record<string, unknown>).oidcToken = {
      serviceAccountEmail: process.env.TASKMASTER_SERVICE_ACCOUNT_EMAIL,
      audience: process.env.TASKMASTER_TASK_AUDIENCE || process.env.TASKMASTER_WORKER_URL,
    };
  }
  const [response] = await client.createTask({ parent, task });
  return { mode: 'CLOUD_TASKS', taskName: response.name || undefined };
}

/**
 * Cloud Tasks is the hosted boundary. Local development uses one in-process
 * delivery so tests and the browser can exercise the same checkpointed worker
 * without creating cloud resources or invoking paid services.
 */
export async function enqueueTaskmasterRun(runId: string, correlationId?: string, deliverySuffix = 'initial'): Promise<TaskmasterEnqueueResult> {
  if (cloudTasksConfigured()) return enqueueCloudTask(runId, correlationId, deliverySuffix);

  const repository = await getTaskmasterRunRepository();
  setTimeout(() => {
    void executeTaskmasterRun(runId, repository, `local-${runId}`);
  }, 0);
  return { mode: 'LOCAL_DEVELOPMENT' };
}

export function taskmasterCloudConfiguration(): {
  configured: boolean;
  queue?: string;
  workerUrl?: string;
  location: string;
} {
  return {
    configured: cloudTasksConfigured(),
    queue: process.env.TASKMASTER_CLOUD_TASKS_QUEUE,
    workerUrl: process.env.TASKMASTER_WORKER_URL,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'asia-southeast2',
  };
}
