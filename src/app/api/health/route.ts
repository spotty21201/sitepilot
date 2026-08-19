import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      service: 'sitepilot',
      timestamp: new Date().toISOString()
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  );
}
