import { NextRequest, NextResponse } from 'next/server';
import { executeTaskmasterRun } from '@/lib/taskmaster/runner';
import { getTaskmasterRunRepository } from '@/lib/taskmaster/repository';

function isAuthorizedWorker(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production' && process.env.TASKMASTER_WORKER_SECRET === undefined) return true;
  const expected = process.env.TASKMASTER_WORKER_SECRET;
  if (expected && (request.headers.get('authorization') === `Bearer ${expected}` || request.headers.get('x-sitepilot-taskmaster-secret') === expected)) return true;
  // In production the Cloud Run IAM boundary validates the Cloud Tasks OIDC
  // token before the request reaches this container. The bearer token is
  // intentionally not logged or persisted; the service grants invoker only
  // to the dedicated Cloud Tasks identity.
  return process.env.NODE_ENV === 'production' && Boolean(request.headers.get('authorization')?.startsWith('Bearer '));
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedWorker(request)) return NextResponse.json({ ok: false, error: 'Worker authentication failed.' }, { status: 401 });
  try {
    const body = await request.json() as { runId?: string; deliveryId?: string };
    if (!body.runId) return NextResponse.json({ ok: false, error: 'runId is required.' }, { status: 400 });
    const run = await executeTaskmasterRun(body.runId, await getTaskmasterRunRepository(), body.deliveryId || request.headers.get('x-cloudtasks-taskname') || undefined);
    if (!run) return NextResponse.json({ ok: false, error: 'Taskmaster run was not found or is already executing.' }, { status: 404 });
    return NextResponse.json({ ok: true, state: run.state, progress: run.progress });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Taskmaster worker failed.' }, { status: 500 });
  }
}
