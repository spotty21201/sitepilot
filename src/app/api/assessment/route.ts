import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { createAiClient } from '@/lib/ai/gemini';
import { PlanningAssessment, Setbacks } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AssessmentRequestBody {
  scenarioId: string;
  scenarioName: string;
  floors: number;
  heightMeters: number;
  heightCap: number;
  heightOverrun: number;
  far: number;
  gfa: number;
  siteCoverage: number;
  openSpace: number;
  setbacks: Setbacks;
  isOverridden: boolean;
  hasCollision?: boolean;
  collisionVolume?: number;
  encroachments?: Array<{ side: string; description: string; encroachmentMeters: number }>;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security Check: Authenticate request & prevent public abuse
    const authHeader = request.headers.get('authorization') || '';
    const internalSecret = process.env.SITEPILOT_INTERNAL_TOKEN || 'sitepilot-internal-auth-token-2026';
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    
    // Check if request is from legitimate same-origin app or authorized server-to-server token
    const isSameOrigin = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('100.97.49.76') || origin.includes('.run.app') || origin.includes('vercel.app');
    const isTokenAuthorized = authHeader === `Bearer ${internalSecret}` || request.headers.get('x-sitepilot-auth') === internalSecret;

    if (!isSameOrigin && !isTokenAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Access to AI assessment requires authentication token or same-origin session.' },
        { status: 401 }
      );
    }

    const body: AssessmentRequestBody = await request.json();

    if (!body.scenarioId || !body.scenarioName || typeof body.floors !== 'number') {
      return NextResponse.json(
        { error: 'Invalid payload: scenarioId, scenarioName, and numeric metrics are required.' },
        { status: 400 }
      );
    }

    // 2. Format Deterministic Planning Evidence Prompt
    const { ai, model, provider } = createAiClient();

    const prompt = `You are the Senior Planning Advisor for SitePilot (intelligent site due diligence workspace).
Analyze the following active scenario's deterministic planning evidence for the Menteng prime property (Subzone R.9):

SCENARIO EVIDENCE:
- Scenario ID: ${body.scenarioId}
- Scenario Name: "${body.scenarioName}"
- Storeys: ${body.floors} floors
- Building Height: ${body.heightMeters.toFixed(1)}m
- Subzone R.9 Height Limit: ${body.heightCap.toFixed(1)}m (Maximum 8 floors / 32m)
- Height Overrun: ${body.heightOverrun > 0 ? `+${body.heightOverrun.toFixed(1)}m VIOLATION` : '0m (Compliant)'}
- Floor Area Ratio (FAR / KLB): ${body.far.toFixed(2)}x (Zoning Cap: 3.20x)
- Gross Floor Area (GFA): ${body.gfa.toLocaleString()} m²
- Building Coverage (KDB): ${body.siteCoverage}% (Zoning Cap: 55%)
- Open Green Space: ${body.openSpace.toLocaleString()} m²
- Setbacks: Front ${body.setbacks.front}m (Standard 10m), Rear ${body.setbacks.rear}m, Left ${body.setbacks.sideLeft}m, Right ${body.setbacks.sideRight}m
- Override State: ${body.isOverridden ? 'Active User Override' : 'Baseline Concept'}
- 3D Mass Collisions: ${body.hasCollision ? `DETECTED (${body.collisionVolume || 0} m³ overlap)` : 'Zero Collisions'}
- Setback Encroachments: ${body.encroachments && body.encroachments.length > 0 ? body.encroachments.map(e => e.description).join('; ') : 'None (Fully Contained)'}

TASK:
Provide a concise, professional urban planning assessment containing:
1. Decision: One-sentence definitive executive verdict.
2. Supporting Evidence: 3-4 bullet points citing exact numerical metrics above.
3. Identified Risks: 1-3 key risks (e.g. height variance, traffic ingress on 6.5m northern corridor, collision).
4. Recommended Next Action: One actionable recommendation.

Return strict JSON conforming to this schema.`;

    let assessment: PlanningAssessment;

    // Check if Cloud Run external proxy is configured or direct Vertex AI
    if (provider === 'LOCAL_DEVELOPMENT' && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_CLOUD_PROJECT) {
      // Offline fallback in local development mode
      assessment = {
        scenarioId: body.scenarioId,
        scenarioName: body.scenarioName,
        status: body.heightOverrun > 0 ? 'NON_COMPLIANT_HEIGHT' : (body.encroachments && body.encroachments.length > 0) ? 'NON_COMPLIANT_SETBACK' : 'COMPLIANT',
        decision: body.heightOverrun > 0 
          ? `Non-compliant: Height exceeds Subzone R.9 cap by ${body.heightOverrun.toFixed(1)}m.`
          : 'Viable concept conforming to baseline zoning and setbacks.',
        supportingEvidence: [
          `Height: ${body.heightMeters.toFixed(1)}m (Cap: ${body.heightCap.toFixed(1)}m)`,
          `FAR: ${body.far.toFixed(2)}x (Max: 3.20x)`,
          `Coverage: ${body.siteCoverage}% (Max: 55%)`,
          `Setbacks: Front ${body.setbacks.front}m`
        ],
        identifiedRisks: body.heightOverrun > 0 
          ? ['Height overrun requires municipal RDTR rezoning variance.', 'Potential permit denial from DKI Jakarta spatial planning bureau.']
          : ['Northern access corridor (6.5m width) requires traffic management for residential volumes.'],
        recommendedAction: body.heightOverrun > 0 
          ? 'Reduce massing storeys to 8 floors (≤32m) or seek statutory height exemption.'
          : 'Proceed with cadastral boundary marker survey and preliminary architectural submission.',
        model: `${model} (Dev Heuristic)`,
        generatedAt: new Date().toISOString(),
        authenticated: true
      };
    } else {
      // Execute live Vertex AI / Google GenAI SDK call
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: {
                type: Type.STRING,
                enum: ['COMPLIANT', 'NON_COMPLIANT_HEIGHT', 'NON_COMPLIANT_SETBACK', 'COLLISION_DETECTED', 'WARNING']
              },
              decision: { type: Type.STRING },
              supportingEvidence: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              identifiedRisks: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              recommendedAction: { type: Type.STRING }
            },
            required: ['status', 'decision', 'supportingEvidence', 'identifiedRisks', 'recommendedAction']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      assessment = {
        scenarioId: body.scenarioId,
        scenarioName: body.scenarioName,
        status: parsed.status || (body.heightOverrun > 0 ? 'NON_COMPLIANT_HEIGHT' : 'COMPLIANT'),
        decision: parsed.decision || 'Assessment generated.',
        supportingEvidence: parsed.supportingEvidence || [],
        identifiedRisks: parsed.identifiedRisks || [],
        recommendedAction: parsed.recommendedAction || 'Review zoning compliance.',
        model: `${model} (${provider})`,
        generatedAt: new Date().toISOString(),
        authenticated: true
      };
    }

    return NextResponse.json(assessment, { status: 200 });
  } catch (error) {
    console.error('[SitePilot Assessment API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate Planning Assessment.', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
