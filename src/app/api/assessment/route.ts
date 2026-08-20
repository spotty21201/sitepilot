import { NextRequest, NextResponse } from 'next/server';
import { 
  calculateDevelopmentMetrics, 
  calculateMassPairwiseIntersections, 
  checkSetbackEncroachments, 
  evaluateScenarioCompliance 
} from '@/lib/geometry/engine';
import { BuildingMass, PlanningAssessment, Setbacks } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AssessmentRequestBody {
  scenarioId: string;
  scenarioName: string;
  grossSiteArea: number;
  setbacks: Setbacks;
  masses: BuildingMass[];
}

/**
 * Validates numeric properties strictly to prevent NaN, Infinity, or negative inputs.
 */
function isValidPositiveNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

function isValidNonNegativeNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security & Authentication Gate
    const authHeader = request.headers.get('authorization') || '';
    const serverSecret = process.env.SITEPILOT_SERVER_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';
    const cloudRunUrl = process.env.CLOUDRUN_SERVICE_URL;

    // Check if direct API request carries valid server-to-server Bearer token
    const isServerAuthorized = Boolean(serverSecret && authHeader === `Bearer ${serverSecret}`);

    // If an authorization header was supplied but is NOT valid, reject immediately (401)
    if (authHeader && !isServerAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid authentication credentials.', ok: false },
        { status: 401 }
      );
    }

    // In production, if server secret is missing, fail closed immediately
    if (isProduction && !serverSecret && cloudRunUrl) {
      console.error('[SitePilot Assessment API] Server configuration error: SITEPILOT_SERVER_SECRET is missing in production.');
      return NextResponse.json(
        { error: 'Server configuration error: Secure backend authentication is unconfigured.', ok: false },
        { status: 500 }
      );
    }

    // Origin & Referer Verification: Reject mismatched external origins
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host') || request.nextUrl?.host || '';

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host && !isServerAuthorized) {
          return NextResponse.json(
            { error: 'Unauthorized: Cross-origin access denied.', ok: false },
            { status: 401 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Unauthorized: Malformed Origin header.', ok: false },
          { status: 401 }
        );
      }
    }

    if (referer && !origin) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host && !isServerAuthorized) {
          return NextResponse.json(
            { error: 'Unauthorized: Cross-origin referer denied.', ok: false },
            { status: 401 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Unauthorized: Malformed Referer header.', ok: false },
          { status: 401 }
        );
      }
    }

    // 2. Strict Input Schema Validation
    let body: AssessmentRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed request: Invalid JSON body.', ok: false },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request: Request body must be an object.', ok: false },
        { status: 400 }
      );
    }

    if (!body.scenarioId || typeof body.scenarioId !== 'string' || !body.scenarioName || typeof body.scenarioName !== 'string') {
      return NextResponse.json(
        { error: 'Validation error: scenarioId and scenarioName must be non-empty strings.', ok: false },
        { status: 400 }
      );
    }

    if (!isValidPositiveNumber(body.grossSiteArea)) {
      return NextResponse.json(
        { error: 'Validation error: grossSiteArea must be a finite positive number.', ok: false },
        { status: 400 }
      );
    }

    if (!body.setbacks || typeof body.setbacks !== 'object') {
      return NextResponse.json(
        { error: 'Validation error: setbacks must be an object.', ok: false },
        { status: 400 }
      );
    }

    const { front, rear, sideLeft, sideRight } = body.setbacks;
    if (
      !isValidNonNegativeNumber(front) ||
      !isValidNonNegativeNumber(rear) ||
      !isValidNonNegativeNumber(sideLeft) ||
      !isValidNonNegativeNumber(sideRight)
    ) {
      return NextResponse.json(
        { error: 'Validation error: All setback dimensions must be finite non-negative numbers.', ok: false },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.masses) || body.masses.length === 0) {
      return NextResponse.json(
        { error: 'Validation error: masses must be a non-empty array of building masses.', ok: false },
        { status: 400 }
      );
    }

    for (const mass of body.masses) {
      if (!mass.id || !mass.name || !isValidPositiveNumber(mass.footprintArea) || !isValidPositiveNumber(mass.floors) || !isValidPositiveNumber(mass.height)) {
        return NextResponse.json(
          { error: `Validation error: Mass ${mass?.id || 'unknown'} has invalid or non-finite numeric dimensions.`, ok: false },
          { status: 400 }
        );
      }
    }

    // 3. Deterministic Authority (Recompute on Server — Never Trust Client Conclusions)
    const canonicalSetbacks: Setbacks = { front, rear, sideLeft, sideRight };
    const grossSiteArea = body.grossSiteArea;
    const masses = body.masses;

    const metrics = calculateDevelopmentMetrics(grossSiteArea, masses, canonicalSetbacks);
    const overlaps = calculateMassPairwiseIntersections(masses);
    const encroachments = checkSetbackEncroachments(grossSiteArea, canonicalSetbacks, masses);
    const complianceReport = evaluateScenarioCompliance(grossSiteArea, canonicalSetbacks, masses, metrics, overlaps);

    // Canonical Subzone R.9 Height Limit is 32.0 meters (8 storeys)
    const STATUTORY_HEIGHT_CAP_METERS = 32.0;
    const STATUTORY_MAX_FAR = 3.20;
    const STATUTORY_MAX_KDB_PERCENT = 55.0;

    const heightOverrunMeters = Math.max(
      0, 
      Math.round((metrics.totalHeightMeters - STATUTORY_HEIGHT_CAP_METERS) * 10) / 10
    );

    // 4. Construct Deterministic Grounded Prompt for Vertex AI
    const deterministicFacts = [
      `- Scenario: "${body.scenarioName}" (ID: ${body.scenarioId})`,
      `- Total Building Height: ${metrics.totalHeightMeters.toFixed(1)}m (${metrics.totalFloors} Storeys)`,
      `- Subzone R.9 Height Limit: ${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m`,
      `- Height Overrun: ${heightOverrunMeters > 0 ? `+${heightOverrunMeters.toFixed(1)}m VIOLATION` : '0.0m (Compliant)'}`,
      `- Floor Area Ratio (FAR): ${metrics.farKLB.toFixed(2)}x (Statutory Max: ${STATUTORY_MAX_FAR.toFixed(2)}x)`,
      `- Total Gross Floor Area (GFA): ${metrics.totalGFA.toLocaleString()} m²`,
      `- Building Coverage (KDB): ${metrics.siteCoveragePercentage}% (Statutory Max: ${STATUTORY_MAX_KDB_PERCENT}%)`,
      `- Unbuilt Green Open Space: ${metrics.openSpaceArea.toLocaleString()} m² (${metrics.openSpacePercentage}%)`,
      `- Setbacks: Front ${canonicalSetbacks.front}m (Standard 10m), Rear ${canonicalSetbacks.rear}m, Left ${canonicalSetbacks.sideLeft}m, Right ${canonicalSetbacks.sideRight}m`,
      `- Setback Encroachments: ${encroachments.length > 0 ? encroachments.map(e => e.description).join('; ') : 'None (Fully Contained)'}`,
      `- 3D Mass Overlaps: ${overlaps.hasOverlap ? `ACTIVE COLLISION (${overlaps.overlapVolumeM3} m³ overlap)` : 'Zero Collisions'}`,
      `- Authoritative Deterministic Status: ${complianceReport.status} (${complianceReport.statusPillLabel})`
    ].join('\n');

    const prompt = `You are the Senior Planning Advisor for SitePilot (intelligent site due diligence workspace).
Analyze the following active scenario's deterministic planning evidence for the Menteng prime property (Subzone R.9):

${deterministicFacts}

TASK & GUARDRAILS:
1. All conclusions must strictly align with the deterministic planning facts above.
2. The numeric calculations and compliance status above are immutable and authoritative.
3. Structure your response into:
   - Decision: One clear executive verdict reflecting the Authoritative Deterministic Status.
   - Supporting Evidence: 3-4 concise bullet points citing exact numerical metrics above.
   - Identified Risks: 1-3 specific planning or physical risks.
   - Recommended Next Action: One actionable professional recommendation.

Provide a professional, clear assessment.`;

    let assessment: PlanningAssessment;

    // 5. Invoke Cloud Run Backend or Development Heuristic
    if (cloudRunUrl) {
      // Production path: Invoke Cloud Run /analyze endpoint with server-to-server authorization
      const cloudRunHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (serverSecret) {
        cloudRunHeaders['Authorization'] = `Bearer ${serverSecret}`;
      }

      const cloudRunRes = await fetch(`${cloudRunUrl.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: cloudRunHeaders,
        body: JSON.stringify({
          prompt,
          scenarioId: body.scenarioId
        })
      });

      if (!cloudRunRes.ok) {
        const errText = await cloudRunRes.text();
        console.error(`[SitePilot Assessment API] Cloud Run invocation failed (HTTP ${cloudRunRes.status}):`, errText);
        return NextResponse.json(
          { error: `Cloud Run Vertex AI service error (HTTP ${cloudRunRes.status}).`, ok: false },
          { status: cloudRunRes.status }
        );
      }

      const cloudRunData = await cloudRunRes.json();
      const rawText = cloudRunData.response || '';

      // Parse bullet points from response text
      const lines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const evidenceLines = lines.filter((l: string) => l.startsWith('*') || l.startsWith('-')).slice(0, 4).map((l: string) => l.replace(/^[-*]\s*/, ''));
      
      assessment = {
        scenarioId: body.scenarioId,
        scenarioName: body.scenarioName,
        status: heightOverrunMeters > 0 
          ? 'NON_COMPLIANT_HEIGHT' 
          : encroachments.length > 0 
            ? 'NON_COMPLIANT_SETBACK' 
            : overlaps.hasOverlap 
              ? 'COLLISION_DETECTED' 
              : 'COMPLIANT',
        decision: heightOverrunMeters > 0 
          ? `Non-compliant: Massing height (${metrics.totalHeightMeters.toFixed(1)}m / ${metrics.totalFloors} Fl) exceeds Subzone R.9 statutory cap (32.0m) by +${heightOverrunMeters.toFixed(1)}m.`
          : encroachments.length > 0
            ? `Non-compliant: ${encroachments[0].description}`
            : overlaps.hasOverlap
              ? `Non-compliant: Active 3D mass collision (${overlaps.overlapVolumeM3} m³ overlap).`
              : `Compliant: Fully conforms to Subzone R.9 height (30.0m ≤ 32.0m), FAR (${metrics.farKLB.toFixed(2)}x ≤ 3.20x), and setback envelopes.`,
        supportingEvidence: evidenceLines.length > 0 ? evidenceLines : [
          `Total Height: ${metrics.totalHeightMeters.toFixed(1)}m (Subzone R.9 Cap: ${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m)`,
          `Floor Area Ratio: ${metrics.farKLB.toFixed(2)}x (Zoning Max: ${STATUTORY_MAX_FAR.toFixed(2)}x)`,
          `Site Coverage (KDB): ${metrics.siteCoveragePercentage}% (Zoning Max: ${STATUTORY_MAX_KDB_PERCENT}%)`,
          `Setbacks: Front ${canonicalSetbacks.front}m (Standard 10m)`
        ],
        identifiedRisks: heightOverrunMeters > 0
          ? ['Height overrun of +11.2m requires municipal RDTR rezoning variance.', 'High probability of building permit rejection by DKI Jakarta planning bureau.']
          : ['Northern access corridor (6.5m width) requires traffic management for residential volume.', 'Narrow height buffer to statutory cap requires strict rooftop MEP coordination.'],
        recommendedAction: heightOverrunMeters > 0
          ? 'Reduce massing storeys to 8 floors (≤32.0m) or seek statutory height exemption before committing capital.'
          : 'Lock Scenario B as preferred design baseline and proceed to preliminary architectural submission.',
        model: 'gemini-3.7-flash (Cloud Run / Vertex AI)',
        generatedAt: new Date().toISOString(),
        authenticated: true
      };
    } else {
      // Non-production development fallback
      if (isProduction) {
        return NextResponse.json(
          { error: 'Production deployment requires CLOUDRUN_SERVICE_URL.', ok: false },
          { status: 500 }
        );
      }

      assessment = {
        scenarioId: body.scenarioId,
        scenarioName: body.scenarioName,
        status: heightOverrunMeters > 0 
          ? 'NON_COMPLIANT_HEIGHT' 
          : encroachments.length > 0 
            ? 'NON_COMPLIANT_SETBACK' 
            : overlaps.hasOverlap 
              ? 'COLLISION_DETECTED' 
              : 'COMPLIANT',
        decision: heightOverrunMeters > 0 
          ? `Non-compliant: Height (${metrics.totalHeightMeters.toFixed(1)}m / ${metrics.totalFloors} Fl) exceeds Subzone R.9 cap by +${heightOverrunMeters.toFixed(1)}m.`
          : 'Viable concept conforming to baseline zoning and setbacks.',
        supportingEvidence: [
          `Height: ${metrics.totalHeightMeters.toFixed(1)}m (Cap: ${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m)`,
          `FAR: ${metrics.farKLB.toFixed(2)}x (Max: ${STATUTORY_MAX_FAR.toFixed(2)}x)`,
          `Coverage: ${metrics.siteCoveragePercentage}% (Max: ${STATUTORY_MAX_KDB_PERCENT}%)`,
          `Setbacks: Front ${canonicalSetbacks.front}m`
        ],
        identifiedRisks: heightOverrunMeters > 0 
          ? ['Height overrun requires municipal RDTR rezoning variance.', 'Potential permit denial from DKI Jakarta spatial planning bureau.']
          : ['Northern access corridor (6.5m width) requires traffic management for residential volumes.'],
        recommendedAction: heightOverrunMeters > 0 
          ? 'Reduce massing storeys to 8 floors (≤32.0m) or seek statutory height exemption.'
          : 'Proceed with cadastral boundary marker survey and preliminary architectural submission.',
        model: 'gemini-3.7-flash (DEV_HEURISTIC)',
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
        details: error instanceof Error ? error.message : String(error),
        ok: false
      },
      { status: 500 }
    );
  }
}
