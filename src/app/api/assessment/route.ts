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

const REQUIRED_CLOUD_RUN_MODEL = 'gemini-3.7-flash';
const REQUIRED_CLOUD_RUN_PROJECT = 'project-528f858c-325a-45aa-ac0';
const REQUIRED_CLOUD_RUN_LOCATION = 'global';

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

function isValidFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Security & Two-Path Access Boundary
    const authHeader = request.headers.get('authorization') || '';
    const serverSecret = process.env.SITEPILOT_SERVER_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';
    const cloudRunUrl = process.env.CLOUDRUN_SERVICE_URL;

    // Check Server-to-Server Path (requires valid Bearer secret)
    const isServerAuthorized = Boolean(serverSecret && authHeader === `Bearer ${serverSecret}`);

    // If an authorization header was supplied but is invalid, reject immediately (401)
    if (authHeader && !isServerAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid authentication credentials.', ok: false },
        { status: 401 }
      );
    }

    // Check Browser Path (requires exact same-origin Origin & Host matching)
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host') || request.nextUrl?.host || '';
    const secFetchSite = request.headers.get('sec-fetch-site');

    let accessPath: 'same_origin_browser' | 'authorized_server';

    if (isServerAuthorized) {
      accessPath = 'authorized_server';
    } else {
      // Browser path requires explicit valid Origin matching the request host
      if (!origin) {
        return NextResponse.json(
          { error: 'Unauthorized: Missing Origin header for browser request path.', ok: false },
          { status: 401 }
        );
      }

      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
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

      // Check referer if present
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          if (refererUrl.host !== host) {
            return NextResponse.json(
              { error: 'Unauthorized: Mismatched Referer header.', ok: false },
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

      // Check Sec-Fetch-Site if provided
      if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'same-site' && secFetchSite !== 'none') {
        return NextResponse.json(
          { error: 'Unauthorized: Cross-site fetch prohibited.', ok: false },
          { status: 401 }
        );
      }

      accessPath = 'same_origin_browser';
    }

    // In production, if server secret is missing and Cloud Run is configured, fail closed
    if (isProduction && !serverSecret && cloudRunUrl) {
      console.error('[SitePilot Assessment API] Server configuration error: SITEPILOT_SERVER_SECRET is missing in production.');
      return NextResponse.json(
        { error: 'Server configuration error: Secure backend authentication is unconfigured.', ok: false },
        { status: 500 }
      );
    }

    // 2. Strict Input Schema Validation (Validates Every Geometry Field)
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
      if (
        !mass ||
        typeof mass !== 'object' ||
        !mass.id ||
        !mass.name ||
        !isValidPositiveNumber(mass.footprintArea) ||
        !isValidPositiveNumber(mass.floors) ||
        !isValidPositiveNumber(mass.height) ||
        !isValidPositiveNumber(mass.floorToFloorHeight) ||
        !mass.position ||
        !isValidFiniteNumber(mass.position.x) ||
        !isValidFiniteNumber(mass.position.y) ||
        !isValidFiniteNumber(mass.position.z) ||
        !mass.dimensions ||
        !isValidPositiveNumber(mass.dimensions.width) ||
        !isValidPositiveNumber(mass.dimensions.length) ||
        !isValidPositiveNumber(mass.dimensions.height)
      ) {
        return NextResponse.json(
          { error: `Validation error: Mass ${mass?.id || 'unknown'} contains missing, non-finite, or negative geometry fields.`, ok: false },
          { status: 400 }
        );
      }
    }

    // 3. Deterministic Authority (Recomputed on Server using Single Authoritative Geometry Engine)
    const canonicalSetbacks: Setbacks = { front, rear, sideLeft, sideRight };
    const grossSiteArea = body.grossSiteArea;
    const masses = body.masses;

    const metrics = calculateDevelopmentMetrics(grossSiteArea, masses, canonicalSetbacks);
    const overlaps = calculateMassPairwiseIntersections(masses);
    const encroachments = checkSetbackEncroachments(grossSiteArea, canonicalSetbacks, masses);
    const complianceReport = evaluateScenarioCompliance(
      grossSiteArea, 
      canonicalSetbacks, 
      masses, 
      metrics, 
      overlaps, 
      body.scenarioName
    );

    const STATUTORY_HEIGHT_CAP_METERS = 32.0;
    const STATUTORY_MAX_FAR = 3.20;
    const STATUTORY_MAX_KDB_PERCENT = 55.0;

    // 4. Construct Grounded Prompt for Vertex AI
    const deterministicFacts = [
      `- Scenario: "${body.scenarioName}" (ID: ${body.scenarioId})`,
      `- Total Building Height: ${metrics.totalHeightMeters.toFixed(1)}m (${metrics.totalFloors} Storeys)`,
      `- Subzone R.9 Height Limit: ${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m (8 Storeys)`,
      `- Height Overrun: ${complianceReport.metrics.heightOverrunMeters > 0 ? `+${complianceReport.metrics.heightOverrunMeters.toFixed(1)}m VIOLATION` : '0.0m (Compliant)'}`,
      `- Floor Area Ratio (FAR): ${metrics.farKLB.toFixed(2)}x (Statutory Max: ${STATUTORY_MAX_FAR.toFixed(2)}x)`,
      `- Total Gross Floor Area (GFA): ${metrics.totalGFA.toLocaleString()} m²`,
      `- Building Coverage (KDB): ${metrics.siteCoveragePercentage}% (Statutory Max: ${STATUTORY_MAX_KDB_PERCENT}%)`,
      `- Unbuilt Green Open Space: ${metrics.openSpaceArea.toLocaleString()} m² (${metrics.openSpacePercentage}%)`,
      `- Setbacks: Front ${canonicalSetbacks.front}m (Standard 10m), Rear ${canonicalSetbacks.rear}m, Left ${canonicalSetbacks.sideLeft}m, Right ${canonicalSetbacks.sideRight}m`,
      `- Setback Encroachments: ${encroachments.length > 0 ? encroachments.map(e => e.description).join('; ') : 'None (Fully Contained)'}`,
      `- 3D Mass Overlaps: ${overlaps.hasOverlap ? `ACTIVE COLLISION (${overlaps.overlapVolumeM3} m³ overlap)` : 'Zero Collisions'}`,
      `- Out of Bounds Footprint: ${(metrics.outOfBoundsAreaM2 || 0) > 0.5 ? `${metrics.outOfBoundsAreaM2} m² beyond parcel` : 'None'}`,
      `- Authoritative Compliance Verdict: ${complianceReport.status} (${complianceReport.assessmentStatus})`,
      `- Primary Summary: ${complianceReport.summaryText}`
    ].join('\n');

    const prompt = `You are the Senior Planning Advisor for SitePilot (intelligent site due diligence workspace).
Analyze the active scenario's deterministic planning evidence for the Menteng prime property (Subzone R.9):

${deterministicFacts}

TASK & GUARDRAILS:
1. All narrative conclusions must strictly align with the deterministic planning facts above.
2. The numeric calculations and compliance status above are immutable and authoritative.
3. Structure your response into:
   - Decision: One clear executive verdict reflecting the Authoritative Deterministic Status.
   - Supporting Evidence: 3-4 concise bullet points citing exact numerical metrics above.
   - Identified Risks: 1-3 specific planning or physical risks.
   - Recommended Next Action: One actionable professional recommendation.

Provide a professional, clear assessment.`;

    let assessment: PlanningAssessment;

    // 5. Invoke Cloud Run Backend with Strict Provenance Validation
    if (cloudRunUrl) {
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

      // Strict Provenance Validation: require exact model, project, location, and non-empty revision/correlationId
      if (
        !cloudRunData ||
        typeof cloudRunData !== 'object' ||
        cloudRunData.ok !== true ||
        cloudRunData.authenticated !== true ||
        cloudRunData.model !== REQUIRED_CLOUD_RUN_MODEL ||
        cloudRunData.project !== REQUIRED_CLOUD_RUN_PROJECT ||
        cloudRunData.vertexLocation !== REQUIRED_CLOUD_RUN_LOCATION ||
        typeof cloudRunData.revision !== 'string' ||
        cloudRunData.revision.length === 0 ||
        typeof cloudRunData.correlationId !== 'string' ||
        cloudRunData.correlationId.length === 0
      ) {
        console.error('[SitePilot Assessment API] Invalid or inconsistent provenance from Cloud Run:', cloudRunData);
        return NextResponse.json(
          { error: 'Invalid or inconsistent provenance received from Cloud Run service.', ok: false },
          { status: 502 }
        );
      }

      const rawText = cloudRunData.response || '';
      const lines = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const evidenceLines = lines.filter((l: string) => l.startsWith('*') || l.startsWith('-')).slice(0, 4).map((l: string) => l.replace(/^[-*]\s*/, ''));

      assessment = {
        scenarioId: body.scenarioId,
        scenarioName: body.scenarioName,
        status: complianceReport.assessmentStatus,
        decision: complianceReport.decisionText,
        supportingEvidence: evidenceLines.length > 0 ? evidenceLines : [
          `Total Height: ${metrics.totalHeightMeters.toFixed(1)}m (Subzone R.9 Cap: ${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m)`,
          `Floor Area Ratio: ${metrics.farKLB.toFixed(2)}x (Zoning Max: ${STATUTORY_MAX_FAR.toFixed(2)}x)`,
          `Site Coverage (KDB): ${metrics.siteCoveragePercentage}% (Zoning Max: ${STATUTORY_MAX_KDB_PERCENT}%)`,
          `Setbacks: Front ${canonicalSetbacks.front}m (Standard 10m)`
        ],
        identifiedRisks: complianceReport.identifiedRisks,
        recommendedAction: complianceReport.recommendedAction,
        model: `${cloudRunData.model} (Cloud Run / Vertex AI)`,
        generatedAt: new Date().toISOString(),
        accessPath,
        userAuthenticated: false,
        backendAuthenticated: true,
        provenance: {
          model: cloudRunData.model,
          project: cloudRunData.project,
          vertexLocation: cloudRunData.vertexLocation,
          revision: cloudRunData.revision,
          correlationId: cloudRunData.correlationId
        }
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
        status: complianceReport.assessmentStatus,
        decision: complianceReport.decisionText,
        supportingEvidence: [
          `Total Height: ${metrics.totalHeightMeters.toFixed(1)}m (Cap: ${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m)`,
          `Floor Area Ratio: ${metrics.farKLB.toFixed(2)}x (Max: ${STATUTORY_MAX_FAR.toFixed(2)}x)`,
          `Site Coverage: ${metrics.siteCoveragePercentage}% (Max: ${STATUTORY_MAX_KDB_PERCENT}%)`,
          `Setbacks: Front ${canonicalSetbacks.front}m`
        ],
        identifiedRisks: complianceReport.identifiedRisks,
        recommendedAction: complianceReport.recommendedAction,
        model: 'gemini-3.7-flash (DEV_HEURISTIC)',
        generatedAt: new Date().toISOString(),
        accessPath,
        userAuthenticated: false,
        backendAuthenticated: false
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
