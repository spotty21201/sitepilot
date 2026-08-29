# SitePilot Devpost package — ready to paste, not submitted

## Category

Taskmaster

## Tagline

Three AI-proposed development strategies, one deterministic planning truth, and a human-controlled decision.

## What it does

SitePilot converts a confirmed development opportunity into exactly three materially different strategies: Conservative, Balanced, and Boundary. Google ADK plans a bounded Taskmaster workflow; Gemini 3.7 Flash proposes structured program, asset, public-realm, access, servicing, phasing, and commercial intent. Cloud Tasks runs the workflow asynchronously and Firestore preserves its evidence. SitePilot calculates every geometry and planning figure independently. The user must approve a scheme before it becomes canonical. A second on-demand Gemini stage compares all three simulations and prepares an evidence-grounded advisory assessment without overwriting deterministic results.

## Features and functionality

- Four-part opportunity intake, confirmation snapshot, version, and hash.
- Optional Additional Strategy Instructions treated as untrusted brief data.
- Three schema-validated, meaningfully distinct strategies.
- Exact existing-asset and program reconciliation.
- Deterministic geometry, GFA, FAR/KLB, KDB, height, setbacks, KDH evidence, collisions, and supplied-envelope checks.
- Persisted Taskmaster events, proposals, simulations, idempotency, correlation, provider usage, and human approval.
- Grounded three-scheme AI comparison and detailed active-scheme assessment.
- Reload-safe browser case and assessment reuse/staleness behavior.
- 2D plan, 3D Spatial Console, comparison table, Executive Brief, Sources & Assumptions, CSV, PDF, and DAE.
- Honest deterministic/template fallback after provider failure or allowance exhaustion.

## Technologies used

- Next.js 16.3.1, React 19.2.8, TypeScript, Zod, Three.js.
- Google ADK 2.0.0 (`@google/adk`).
- Google Gen AI SDK 2.17.1 (`@google/genai`).
- Google Cloud Firestore SDK 9.0.0 and Cloud Tasks SDK 7.0.0.
- Vertex AI stable `v1`, model `gemini-3.7-flash`, location `global`.
- Private Cloud Run, Cloud Tasks, Firestore, Artifact Registry, Cloud Build, Cloud Logging, and service-account ADC.
- Vercel server hosting with OIDC/WIF private-backend invocation.

## Other data sources

Current demonstration cases are synthetic and user-supplied. SitePilot does not claim authoritative cadastral, statutory, market, cost, or commercial data. Supplied values and assumptions remain visibly labelled.

## Findings and learnings

AI is most useful here for framing alternatives and explaining trade-offs, not calculating planning truth. Strict schemas are necessary but insufficient: deterministic reconciliation, distinctness, evidence-reference, stale-revision, provider-budget, and human-approval gates remain essential. Private cross-cloud identity also avoids browser tokens and long-lived service-account keys.

## Links

- Repository: https://github.com/spotty21201/sitepilot
- Hosted project: https://sitepilot-hackathon.vercel.app

## Reproducible judging steps

1. Open the hosted project anonymously and select **New Opportunity**.
2. Enter the synthetic case from `docs/DEMO_VIDEO_PLAN.md`, including its distinctive Additional Strategy Instructions.
3. Review and confirm the snapshot, then create three schemes.
4. Inspect provider/model/accounting disclosure and compare the three strategies.
5. Approve one scheme and inspect canonical calculated figures.
6. Select **Prepare Planning Assessment** and inspect comments for all three schemes plus the active scheme.
7. Reload to verify persistence/reuse; edit a relevant scenario input to verify stale disclosure.
8. Export CSV, PDF, and DAE.

## Current limitations

Rectangular study geometry is not a survey. Planning/commercial inputs may be unverified. Browser projects are not account-backed. Public AI usage is rate-limited. Fallback may be used after provider failure or quota exhaustion and is always disclosed.

## Pre-existing and assisted work disclosure

The project uses standard pre-existing frameworks and third-party packages under their respective licenses. The owner conceived and directed SitePilot; Kimi, Antigravity, Codex, and other AI assistants supported design, coding, review, and testing.

## Owner fields still required

- Entrant/team names and eligibility.
- Project-newness attestation.
- Rights and provider-terms confirmation.
- Root repository license selection.
- Final screenshots/video URL.
- Final Devpost attestations and submission authorization.
