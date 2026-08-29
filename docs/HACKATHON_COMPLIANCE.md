# SitePilot hackathon readiness

## Implemented submission story

**Category:** Taskmaster.

SitePilot’s agent receives a confirmed development opportunity, creates a bounded ADK plan, proposes three structured development strategies with Gemini 3.7 Flash, requests deterministic simulations, persists auditable workflow state, stops at human approval, and later prepares a grounded comparative assessment of the three canonical results.

The demonstrated architecture uses Vertex AI, Google ADK, private Cloud Run, Cloud Tasks, Firestore, Artifact Registry, Cloud Build, and Cloud Logging. Vercel reaches private Cloud Run with federated OIDC/WIF credentials; Cloud Run is not publicly invokable.

## Authority and disclosure matrix

| Area | Authoritative source | AI role |
| --- | --- | --- |
| Confirmed inputs and provenance | User-confirmed snapshot and input hash | Interpret only |
| Geometry, GFA, FAR/KLB, KDB, height, setbacks, KDH evidence, collisions | SitePilot deterministic engine | May request simulations; cannot replace results |
| Proposal strategy | Schema-validated Gemini output or labelled templates | Advisory proposal |
| Persistence and accepted state | Firestore Taskmaster records and human approval workflow | No direct control |
| Post-simulation assessment | Deterministic evidence package plus validated advisory output | Compare and explain |
| Exports | Accepted canonical SitePilot state | No direct control |

Fallback is disclosed as “Template schemes used” or “Deterministic study summary — no model request made.” Configured model names never imply a call.

## Google technology evidence

- `@google/adk` 2.0.0: bounded Taskmaster planning stage.
- `@google/genai` 2.17.1: stable Vertex `v1` structured proposal and assessment calls.
- Model: exactly `gemini-3.7-flash`, Vertex location `global`.
- Cloud Run: private API/worker runtime on Node 22 with service-account ADC.
- Cloud Tasks: asynchronous, authenticated, idempotent worker delivery.
- Firestore: runs, activities/events, proposals, simulations, approval state, rate allowances, and provider accounting.
- Vercel WIF/OIDC: server-to-server identity exchange and Cloud Run ID-token audience binding.

## Not implemented or not claimed

- User evidence/document upload.
- Three specialist agents.
- Pub/Sub or Cloud Storage in the demonstrated workflow.
- Automated external information requests.
- Account-backed project sharing.
- Cadastral or statutory verification.
- Financial return calculations or universal investment winner.
- Final Go/No-Go investment decisions.

## Owner-only actions before submission

The owner/entrant must factually confirm eligibility, project newness, team details, rights to submit all materials, applicable AI-provider and third-party terms, the root repository license, final category selection, and all Devpost attestations.

No root license is added because no owner license choice appears in the controlling conversation.

## Promotion gate

The hackathon domain may be assigned only after the exact Preview passes live pre-simulation Gemini, deterministic simulation, human approval, live post-simulation assessment, reload persistence/reuse/stale behavior, browser errors, accessibility, CLS, exports, private IAM, Cloud Tasks/Firestore, provider accounting, and sensitive-log checks. The project has not been submitted by this work package.
