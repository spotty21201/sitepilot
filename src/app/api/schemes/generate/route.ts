import { NextRequest, NextResponse } from 'next/server';
import { schemePrioritiesSchema, generateSchemeProposals, type SchemeGenerationInput } from '@/lib/schemes/proposal-contract';

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
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Generation requests must originate from the SitePilot application.' }, { status: 401 });
  }
  try {
    const body = await request.json() as Partial<SchemeGenerationInput>;
    const priorities = schemePrioritiesSchema.safeParse(body.priorities);
    if (!priorities.success) {
      return NextResponse.json({ ok: false, error: 'Confirm the owner priorities before generating schemes.', details: priorities.error.issues }, { status: 400 });
    }
    if (!body.opportunityId || !body.name || !body.address || !body.planningLimits || !body.inputHash || !body.studyVersion) {
      return NextResponse.json({ ok: false, error: 'Opportunity, planning inputs, study version and input hash are required.' }, { status: 400 });
    }
    const input: SchemeGenerationInput = {
      ...(body as SchemeGenerationInput),
      priorities: priorities.data,
    };
    const result = await generateSchemeProposals(input);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Scheme generation failed.' }, { status: 500 });
  }
}
