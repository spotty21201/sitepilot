import { NextRequest, NextResponse } from 'next/server';
import { enqueueTaskmasterRun } from '@/lib/taskmaster/cloud-tasks';
import { createTaskmasterRun } from '@/lib/taskmaster/runner';
import { getTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { taskmasterInputSchema, toPublicTaskmasterRun } from '@/lib/taskmaster/schemas';
import { consumeTaskmasterAllowance } from '@/lib/taskmaster/rate-limit';
import { apiModeEnabled, proxyTaskmasterRequest, taskmasterApiEnabled } from '@/lib/taskmaster/vercel-proxy';
import { randomUUID } from 'node:crypto';

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
  if (!apiModeEnabled() && !sameOrigin(request)) return NextResponse.json({ ok: false, error: 'Taskmaster requests must originate from the SitePilot application.' }, { status: 401 });
  try {
    const bodyText = await request.text();
    if (taskmasterApiEnabled()) {
      const session = request.cookies.get('sitepilot_session')?.value || randomUUID();
      const response = await proxyTaskmasterRequest(request, '/api/taskmaster/runs', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sitepilot-session': session }, body: bodyText });
      const result = new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json' } });
      if (!request.cookies.get('sitepilot_session')) result.cookies.set('sitepilot_session', session, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 });
      return result;
    }
    const body = JSON.parse(bodyText) as { goal?: string; idempotencyKey?: string; input?: unknown };
    const input = taskmasterInputSchema.parse(body.input);
    const repository = await getTaskmasterRunRepository();
    const idempotencyKey = body.idempotencyKey || `${input.opportunityId}:${input.studyVersion}:${input.inputHash}`;
    const existing = await repository.findByIdempotencyKey(idempotencyKey);
    if (existing) return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(existing), enqueued: false, mode: 'IDEMPOTENT_REPLAY' });
    const allowance = await consumeTaskmasterAllowance(request.cookies.get('sitepilot_session')?.value || request.headers.get('x-sitepilot-session') || 'anonymous-session');
    const run = createTaskmasterRun(input, body.goal || input.objective, idempotencyKey, allowance.forceFallback);
    await repository.create(run);
    const queued = await enqueueTaskmasterRun(run.runId, run.correlationId);
    const updated = { ...run, taskName: queued.taskName };
    await repository.save(updated);
    const response = NextResponse.json({ ok: true, run: toPublicTaskmasterRun(updated), enqueued: true, mode: queued.mode }, { status: 202 });
    if (!request.cookies.get('sitepilot_session')) response.cookies.set('sitepilot_session', randomUUID(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Taskmaster run could not be created.' }, { status: 400 });
  }
}
