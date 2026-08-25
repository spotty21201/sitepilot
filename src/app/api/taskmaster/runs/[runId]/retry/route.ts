import { NextRequest, NextResponse } from 'next/server';
import { enqueueTaskmasterRun } from '@/lib/taskmaster/cloud-tasks';
import { getTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { toPublicTaskmasterRun } from '@/lib/taskmaster/schemas';
import { apiModeEnabled, proxyTaskmasterRequest, taskmasterApiEnabled } from '@/lib/taskmaster/vercel-proxy';

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const origin = request.headers.get('origin');
  if (!apiModeEnabled() && (!origin || new URL(origin).host !== (request.headers.get('host') || request.nextUrl.host))) return NextResponse.json({ ok: false, error: 'Taskmaster requests must originate from the SitePilot application.' }, { status: 401 });
  try {
    const { runId } = await context.params;
    if (taskmasterApiEnabled()) {
      const response = await proxyTaskmasterRequest(request, `/api/taskmaster/runs/${encodeURIComponent(runId)}/retry`, { method: 'POST' });
      return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json' } });
    }
    const repository = await getTaskmasterRunRepository();
    const current = await repository.get(runId);
    if (!current || current.state !== 'FAILED_RETRYABLE') return NextResponse.json({ ok: false, error: 'Only retryable Taskmaster failures can be retried.' }, { status: 409 });
    const queued = { ...current, state: 'QUEUED' as const, currentStep: 'Queued for retry', error: undefined, updatedAt: new Date().toISOString() };
    await repository.save(queued);
    const mode = await enqueueTaskmasterRun(runId);
    return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(queued), mode: mode.mode }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Taskmaster retry failed.' }, { status: 400 });
  }
}
