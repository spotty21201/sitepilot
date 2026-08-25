import { NextRequest, NextResponse } from 'next/server';
import { approveTaskmasterRun, completeApprovedTaskmasterRun, rejectTaskmasterRun } from '@/lib/taskmaster/runner';
import { getTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { toPublicTaskmasterRun } from '@/lib/taskmaster/schemas';
import { apiModeEnabled, proxyTaskmasterRequest, taskmasterApiEnabled } from '@/lib/taskmaster/vercel-proxy';

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get('host') || request.nextUrl.host);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  if (!apiModeEnabled() && !sameOrigin(request)) return NextResponse.json({ ok: false, error: 'Taskmaster requests must originate from the SitePilot application.' }, { status: 401 });
  const { runId } = await context.params;
  try {
    if (taskmasterApiEnabled()) {
      const response = await proxyTaskmasterRequest(request, `/api/taskmaster/runs/${encodeURIComponent(runId)}/approval`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await request.text() });
      return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json' } });
    }
    const body = await request.json() as { decision?: 'APPROVED' | 'REJECTED'; proposalId?: string; expectedStudyVersion?: string; acceptedStudyVersion?: string; applied?: boolean };
    const repository = await getTaskmasterRunRepository();
    if (body.decision === 'REJECTED') {
      const run = await rejectTaskmasterRun(runId, repository);
      return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(run) });
    }
    if (!body.proposalId || !body.expectedStudyVersion) return NextResponse.json({ ok: false, error: 'Proposal and expected study version are required.' }, { status: 400 });
    const applying = body.applied
      ? await repository.get(runId)
      : await approveTaskmasterRun(runId, body.proposalId, body.expectedStudyVersion, 'local-user', repository);
    if (!applying) return NextResponse.json({ ok: false, error: 'Taskmaster run was not found.' }, { status: 404 });
    if (body.applied && (applying.state !== 'APPLYING' || applying.approval?.proposalId !== body.proposalId)) {
      return NextResponse.json({ ok: false, error: 'The approval application checkpoint is invalid.' }, { status: 409 });
    }
    if (body.acceptedStudyVersion) {
      const completed = await completeApprovedTaskmasterRun(runId, body.acceptedStudyVersion, repository);
      return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(completed) });
    }
    return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(applying) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Taskmaster approval failed.';
    return NextResponse.json({ ok: false, error: message }, { status: message.toLowerCase().includes('stale') ? 409 : 400 });
  }
}
