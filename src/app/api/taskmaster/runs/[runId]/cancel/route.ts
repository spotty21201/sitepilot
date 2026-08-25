import { NextRequest, NextResponse } from 'next/server';
import { cancelTaskmasterRun } from '@/lib/taskmaster/runner';
import { getTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { toPublicTaskmasterRun } from '@/lib/taskmaster/schemas';

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== (request.headers.get('host') || request.nextUrl.host)) return NextResponse.json({ ok: false, error: 'Taskmaster requests must originate from the SitePilot application.' }, { status: 401 });
  try {
    const { runId } = await context.params;
    const run = await cancelTaskmasterRun(runId, await getTaskmasterRunRepository());
    return NextResponse.json({ ok: true, run: toPublicTaskmasterRun(run) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Taskmaster cancellation failed.' }, { status: 400 });
  }
}
