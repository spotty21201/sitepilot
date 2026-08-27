import { NextRequest, NextResponse } from 'next/server';
import { getTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { toPublicTaskmasterRun } from '@/lib/taskmaster/schemas';
import { apiModeEnabled, proxyTaskmasterRequest, sameOriginBrowserReadAllowed, taskmasterApiEnabled } from '@/lib/taskmaster/vercel-proxy';

export async function GET(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  if (!apiModeEnabled() && !sameOriginBrowserReadAllowed(request)) return NextResponse.json({ ok: false, error: 'Taskmaster requests must originate from the SitePilot application.' }, { status: 401 });
  const { runId } = await context.params;
  if (taskmasterApiEnabled()) {
    const response = await proxyTaskmasterRequest(request, `/api/taskmaster/runs/${encodeURIComponent(runId)}`, { method: 'GET' });
    return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json' } });
  }
  const run = await (await getTaskmasterRunRepository()).get(runId);
  if (!run) return NextResponse.json({ ok: false, error: 'Taskmaster run was not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(run) });
}
