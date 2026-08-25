import { NextRequest, NextResponse } from 'next/server';
import { enqueueTaskmasterRun } from '@/lib/taskmaster/cloud-tasks';
import { createTaskmasterRun } from '@/lib/taskmaster/runner';
import { getTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { taskmasterInputSchema, toPublicTaskmasterRun } from '@/lib/taskmaster/schemas';

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get('host') || request.nextUrl.host);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: 'Taskmaster requests must originate from the SitePilot application.' }, { status: 401 });
  try {
    const body = await request.json() as { goal?: string; idempotencyKey?: string; input?: unknown };
    const input = taskmasterInputSchema.parse(body.input);
    const repository = await getTaskmasterRunRepository();
    const idempotencyKey = body.idempotencyKey || `${input.opportunityId}:${input.studyVersion}:${input.inputHash}`;
    const existing = await repository.findByIdempotencyKey(idempotencyKey);
    if (existing) return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(existing), enqueued: false, mode: 'IDEMPOTENT_REPLAY' });
    const run = createTaskmasterRun(input, body.goal || input.objective, idempotencyKey);
    await repository.create(run);
    const queued = await enqueueTaskmasterRun(run.runId, run.correlationId);
    const updated = { ...run, taskName: queued.taskName };
    await repository.save(updated);
    return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(updated), enqueued: true, mode: queued.mode }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Taskmaster run could not be created.' }, { status: 400 });
  }
}
