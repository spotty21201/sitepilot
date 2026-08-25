# SitePilot Google technology inventory and gap register

Source revision: `d203bdf` plus the owner-authorized hosted Vertex AI run and restoration on 25 August 2026. This document is a source audit, not a claim of formal hackathon compliance.

## Verification boundary

- The fresh local production build verified a persisted Taskmaster fallback run through `AWAITING_APPROVAL`, canonical approval/application, completion, stale blocking, and one Spatial Console renderer.
- On 25 August 2026 the authorized non-production hosted mock path created Firestore runs, delivered real Cloud Tasks to a private Cloud Run worker, persisted three proposals, resumed a `FAILED_RETRYABLE` checkpoint, and stopped at `AWAITING_APPROVAL`. Duplicate task creation was rejected by deterministic task naming; unauthenticated worker access returned `403`.
- Project `project-528f858c-325a-45aa-ac0` now has Firestore Native `(default)` in `asia-southeast2`, queue `sitepilot-taskmaster`, and private service `sitepilot-taskmaster` revision `sitepilot-taskmaster-00004-qrv`. The worker image is pinned by digest `sha256:13f99cd7d28955af75ee604dfcbabb32ffac7629858dbd53d44d8f026023dded`. Existing `sitepilot-vertex` was not changed.
- One owner-authorized synthetic run (`tm-live-gemini-20260825-actual2`) reached `AWAITING_APPROVAL` through Vertex AI on Cloud Run revision `sitepilot-taskmaster-00012-6zj`, image digest `sha256:bf50c1fd2d6cd515d2142d5333671fbe1adcf41e624c09deec3e9766fb1053b8`, using `global` Vertex location. It persisted three structured proposals and deterministic simulations; no accepted study was changed.
- The worker was restored to fallback revision `sitepilot-taskmaster-00013-drs` with live execution disabled. Earlier hosted mock runs remain the evidence for deterministic fallback behavior.
- The run recorded provider `VERTEX_AI`, model `gemini-3.7-flash`, `modelCallCount=2`, 19 events and six tool activities. Cloud Run logs showed seven ADK request markers, so the logical counter is not a transport-level request cap. Token usage and estimated cost were not exposed by the current adapter and remain unavailable.
- The browser application stores cases in `localStorage`; Taskmaster has a Firestore adapter but local verification uses an in-memory substitute. There is no Firebase, Cloud Storage, Google Maps, Places, or Geocoding integration.

## A. Implemented and locally verified

| Google technology | Current role | Source evidence | What was verified |
|---|---|---|---|
| Google GenAI SDK (`@google/genai` 2.17.1) | Shared client factory and structured-generation adapter for scheme proposals and document finding extraction. | `src/lib/ai/gemini.ts`, `src/lib/schemes/proposal-contract.ts`, `src/app/api/evidence/extract/route.ts` | Local fallback was exercised; one hosted synthetic proposal request completed through Vertex AI. Token/cost telemetry is not persisted. |
| Gemini proposal contract | Three proposal objects are requested as JSON-shaped structured output when a provider is configured; Zod validates the returned array before use. | `src/lib/schemes/proposal-contract.ts`, `src/app/api/schemes/generate/route.ts` | Mock/local proposal path returned three distinct, schema-valid studies and deterministic validation passed. |
| Google ADK for TypeScript (`@google/adk` 2.0.0) | Defines the server-side single Taskmaster agent and bounded read-only tool boundary; it is loaded only when live model execution is explicitly enabled. | `src/lib/taskmaster/adk-agent.ts`, `package.json` | Hosted synthetic run completed its ADK planning phase and recorded a structured plan; logs show Vertex request markers. The current runtime emits a deprecation warning for the legacy Vertex environment marker. |
| Firestore adapter and Cloud Tasks boundary | Durable run repository and authenticated worker/enqueue interfaces for hosted execution. | `src/lib/taskmaster/repository.ts`, `src/lib/taskmaster/cloud-tasks.ts`, `src/app/api/taskmaster/worker/route.ts` | Hosted deterministic runs reached `AWAITING_APPROVAL`; Firestore events/proposals, resume, duplicate protection and Cloud Tasks OIDC delivery were observed. |

## B. Implemented or configurable, but not live-verified

| Product or model | Existing adapter/configuration | Missing evidence | Required test |
|---|---|---|---|
| Gemini model identifier `gemini-3.7-flash` | `GEMINI_MODEL` in `.env.example`, `src/lib/ai/config.ts`, `backend/server.js`, and Cloud Run env. | One synthetic run recorded the requested model and completed; the adapter did not persist provider-returned usage metadata. | Add token/cost telemetry and assert the returned model identifier before any broader use. |
| Vertex AI | `createAiClient()` constructs `GoogleGenAI({ vertexai: true, project, location })` when `GOOGLE_CLOUD_PROJECT` is present; Cloud Run used the dedicated runtime identity with `roles/aiplatform.user`. | One hosted run is verified in `global`; the browser/Vercel application is not connected to this worker, and the ADK marker needs a supported replacement. | Harden transport-level request budgets, update the environment marker after source review, then repeat one separately authorized synthetic run if needed. |
| Gemini Developer API | `createAiClient()` uses `GEMINI_API_KEY`/`GOOGLE_API_KEY` when no Google Cloud project is configured. | No API key was configured or used locally. | Use a separately authorized, budget-limited test key and confirm the response path and disclosure. |
| Taskmaster live ADK + Gemini proposal generation | `TASKMASTER_ALLOW_LIVE_MODEL`, `@google/adk@2.0.0`, structured proposal adapter, model metadata and output-token limit. | One hosted synthetic run reached `AWAITING_APPROVAL` with three proposals; the logical two-phase counter did not cap seven observed ADK requests, and no token/cost usage was persisted. | Enforce a true provider-request budget, add usage telemetry, and keep human approval and deterministic validation boundaries. |
| Firestore Taskmaster repository | `TASKMASTER_FIRESTORE_ENABLED`, `@google-cloud/firestore@9.0.0`, `taskmasterRuns` and `taskmasterIdempotency` collections. | Hosted deterministic access is verified; concurrent production-scale behavior and retention policy remain untested. | Add emulator/concurrency coverage and confirm retention/TTL policy before broader use. |
| Cloud Tasks worker delivery | `TASKMASTER_CLOUD_TASKS_QUEUE`, OIDC audience/service identity fields, `@google-cloud/tasks@7.0.0`. | Hosted OIDC delivery, duplicate-name rejection and bounded queue policy are verified; retry behavior under injected infrastructure failure remains untested. | Exercise one controlled retryable failure and inspect delivery-attempt correlation. |
| Cloud Run | Root `Dockerfile`/`cloudbuild.yaml` container deployed privately as `sitepilot-taskmaster`; existing `backend/*` remains the separate Vertex gateway path. | Private non-production revision, image digest and runtime Vertex AI permission are verified; live Gemini route is intentionally disabled. | One separately authorized synthetic Gemini run with model/location/cost evidence. |
| Cloud Build and Artifact Registry | `cloudbuild.yaml` and `backend/cloudbuild.yaml` run lint/tests, build images, push to Artifact Registry, and deploy Cloud Run. | Taskmaster build `91d148e8-c269-43ec-afa4-816171a3ca54` and immutable digest are verified. | Keep commit/image/revision provenance in subsequent deployments. |
| Cloud Logging / Secret Manager | Taskmaster worker emits structured correlation-only JSON; existing backend references Secret Manager for its own boundary. | Correlation IDs and provider/model metadata were observed without secrets or opportunity documents. | Keep redaction checks in hosted smoke tests; no new secret was created in this slice. |

## C. Missing or recommended next implementation

| Priority | Google technology | Product value | Current status | Missing work | Verification needed |
|---|---|---|---|---|---|
| 1 | Hardened live Gemini through Vertex AI in the persisted Taskmaster run | Demonstrates the complete Google agent story with an auditable cost boundary. | **Partially verified.** One synthetic run completed, but transport-level request limits and usage telemetry are incomplete. | Enforce request counting at the provider boundary, persist usage metadata, replace the deprecated ADK marker, and keep the worker fallback default. | One repeat synthetic run only after owner approval, with a hard request cap and cost evidence. |
| 2 | Google Maps Platform Geocoding/Places or an equivalent approved address service | Improves address parsing and street context without inventing road or cadastral geometry. | **Not implemented.** | Add a server-side adapter with source, retrieval date, rate/cost controls, and manual correction. | Synthetic address lookup, attribution, fallback, and cost/security review. |
| 3 | Firestore for the rest of the application | Makes accepted studies shareable and account-backed beyond Taskmaster run durability. | **Deferred.** Taskmaster-only Firestore adapter exists; browser case persistence remains localStorage. | Add authentication, project/scenario access control, export lineage, and migration. | Threat model, rules tests, multi-user isolation, recovery test. |
| 4 | Cloud Storage for evidence and generated artifacts | Supports durable source documents, report snapshots, and controlled sharing. | **Not implemented.** | Add signed upload/download boundaries after persistence/authentication design. | Upload limits, content policy, signed URL expiry, reproducibility test. |

## Component-to-source map

| Architecture component | Supporting source |
|---|---|
| Browser entry and layout | `src/app/page.tsx`, `src/app/layout.tsx` |
| Opportunity intake | `src/components/NewCaseModal.tsx`, `src/components/OpportunityInputsModal.tsx`, `src/lib/storage/case-repository.ts` |
| Three proposal request and fallback | `src/app/api/schemes/generate/route.ts`, `src/lib/schemes/proposal-contract.ts`, `src/components/SchemeGenerationReview.tsx` |
| Provider selection and model metadata | `src/lib/ai/config.ts`, `src/lib/ai/gemini.ts`, `.env.example` |
| Canonical commands, revisions, undo/redo | `src/lib/spatial/canonical-command-service.ts`, `src/lib/spatial/commands.ts`, `src/features/development-3d/spatial-console/spatial-editing-bridge.ts` |
| Geometry and planning authority | `src/lib/geometry/engine.ts`, `src/lib/opportunity/canonical-opportunity.ts` |
| Spatial adapter and default/fallback renderer | `src/features/development-3d/spatial-editor-adapter.ts`, `src/features/development-3d/DevelopmentWorkspace.tsx`, `src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx`, `src/features/development-3d/ViewportCanvas.tsx` |
| Decision Room, comparison, brief, sources | `src/components/DecisionRoomSummary.tsx`, `src/components/ScenarioControls.tsx`, `src/components/ScenarioComparisonModal.tsx`, `src/components/EvidenceLedger.tsx` |
| PDF and CSV report model | `src/lib/reporting/project-report.ts` |
| DAE export | `src/lib/geometry/engine.ts`, `src/app/api/export/dae/route.ts`, `src/components/ScenarioControls.tsx` |
| Browser persistence | `src/lib/storage/case-repository.ts` |
| Optional one-shot assessment | `src/app/api/assessment/route.ts`, `backend/server.js` |
| Taskmaster agent, run state, tools and approval boundary | `src/lib/taskmaster/adk-agent.ts`, `src/lib/taskmaster/schemas.ts`, `src/lib/taskmaster/tools.ts`, `src/lib/taskmaster/runner.ts` |
| Taskmaster APIs and worker | `src/app/api/taskmaster/runs/route.ts`, `src/app/api/taskmaster/runs/[runId]/route.ts`, `src/app/api/taskmaster/runs/[runId]/approval/route.ts`, `src/app/api/taskmaster/worker/route.ts` |
| Taskmaster persistence and queue adapters | `src/lib/taskmaster/repository.ts`, `src/lib/taskmaster/cloud-tasks.ts` |
| Cloud deployment configuration | `Dockerfile`, `cloudbuild.yaml`, `backend/Dockerfile`, `backend/cloudbuild.yaml`, `vercel.json` |
| Relevant tests | `tests/scheme-generation.test.ts`, `tests/geometry.test.ts`, `tests/assessment-security.test.ts`, remaining `tests/**` |

## Hackathon-facing conclusion

The current repository now has a bounded, persisted Taskmaster architecture using the official Google ADK package, Firestore and Cloud Tasks adapters, alongside the existing GenAI/Vertex/Cloud Run configuration. One synthetic hosted Vertex AI run is verified through `AWAITING_APPROVAL`, while the deployed worker has been restored to the honest deterministic/template fallback. The product should not be described as a formally compliant hackathon submission until transport-level budget enforcement, owner attestations, licensing decision and demonstration video are complete.
