# SitePilot Google technology inventory and gap register

Source revision: `324aea9` plus the bounded hosted-infrastructure documentation update on 25 August 2026. This document is a source audit, not a claim of live Gemini generation or hackathon compliance.

## Verification boundary

- The fresh local production build verified a persisted Taskmaster fallback run through `AWAITING_APPROVAL`, canonical approval/application, completion, stale blocking, and one Spatial Console renderer.
- On 25 August 2026 the authorized non-production hosted mock path created Firestore runs, delivered real Cloud Tasks to a private Cloud Run worker, persisted three proposals, resumed a `FAILED_RETRYABLE` checkpoint, and stopped at `AWAITING_APPROVAL`. Duplicate task creation was rejected by deterministic task naming; unauthenticated worker access returned `403`.
- Project `project-528f858c-325a-45aa-ac0` now has Firestore Native `(default)` in `asia-southeast2`, queue `sitepilot-taskmaster`, and private service `sitepilot-taskmaster` revision `sitepilot-taskmaster-00004-qrv`. The worker image is pinned by digest `sha256:13f99cd7d28955af75ee604dfcbabb32ffac7629858dbd53d44d8f026023dded`. Existing `sitepilot-vertex` was not changed.
- Hosted mock execution used only deterministic templates; no authenticated Gemini or Vertex AI request and no paid inference occurred.
- `gemini-3.7-flash` is the repository default/configured identifier. It is not evidence that a live request occurred.
- The browser application stores cases in `localStorage`; Taskmaster has a Firestore adapter but local verification uses an in-memory substitute. There is no Firebase, Cloud Storage, Google Maps, Places, or Geocoding integration.

## A. Implemented and locally verified

| Google technology | Current role | Source evidence | What was verified |
|---|---|---|---|
| Google GenAI SDK (`@google/genai` 2.17.1) | Shared client factory and structured-generation adapter for scheme proposals and document finding extraction. | `src/lib/ai/gemini.ts`, `src/lib/schemes/proposal-contract.ts`, `src/app/api/evidence/extract/route.ts` | The local application selected `LOCAL_DEVELOPMENT`; the deterministic fallback and proposal contract were exercised. No authenticated SDK call was made. |
| Gemini proposal contract | Three proposal objects are requested as JSON-shaped structured output when a provider is configured; Zod validates the returned array before use. | `src/lib/schemes/proposal-contract.ts`, `src/app/api/schemes/generate/route.ts` | Mock/local proposal path returned three distinct, schema-valid studies and deterministic validation passed. |
| Google ADK for TypeScript (`@google/adk` 2.0.0) | Defines the server-side single Taskmaster agent and bounded read-only tool boundary; it is loaded only when live model execution is explicitly enabled. | `src/lib/taskmaster/adk-agent.ts`, `package.json` | Official ADK agent construction and tool registration were tested without invoking a model. |
| Firestore adapter and Cloud Tasks boundary | Durable run repository and authenticated worker/enqueue interfaces for hosted execution. | `src/lib/taskmaster/repository.ts`, `src/lib/taskmaster/cloud-tasks.ts`, `src/app/api/taskmaster/worker/route.ts` | Hosted deterministic runs reached `AWAITING_APPROVAL`; Firestore events/proposals, resume, duplicate protection and Cloud Tasks OIDC delivery were observed. |

## B. Implemented or configurable, but not live-verified

| Product or model | Existing adapter/configuration | Missing evidence | Required test |
|---|---|---|---|
| Gemini model identifier `gemini-3.7-flash` | `GEMINI_MODEL` in `.env.example`, `src/lib/ai/config.ts`, `backend/server.js`, and both Cloud Build files. | No authorized live response proving the configured model was called. | Configure a non-production test environment, make one approved request, capture returned provider/model metadata and cost boundary. |
| Vertex AI | `createAiClient()` constructs `GoogleGenAI({ vertexai: true, project, location })` when `GOOGLE_CLOUD_PROJECT` is present; `backend/server.js` uses the same Vertex AI mode. | No current Cloud Run URL, IAM execution, Vertex log, or authenticated response was verified in this pass. | Run a controlled Cloud Run/Vertex smoke test with owner-approved credentials and retain model, project, location, revision, and correlation evidence. |
| Gemini Developer API | `createAiClient()` uses `GEMINI_API_KEY`/`GOOGLE_API_KEY` when no Google Cloud project is configured. | No API key was configured or used locally. | Use a separately authorized, budget-limited test key and confirm the response path and disclosure. |
| Taskmaster live ADK + Gemini proposal generation | `TASKMASTER_ALLOW_LIVE_MODEL`, `@google/adk@2.0.0`, structured proposal adapter, model metadata and output-token limit. | No authenticated model call was authorized; local runs explicitly disclose template fallback. | One synthetic, budget-limited hosted run with returned provider/model metadata and redacted correlation logs. |
| Firestore Taskmaster repository | `TASKMASTER_FIRESTORE_ENABLED`, `@google-cloud/firestore@9.0.0`, `taskmasterRuns` and `taskmasterIdempotency` collections. | Hosted deterministic access is verified; concurrent production-scale behavior and retention policy remain untested. | Add emulator/concurrency coverage and confirm retention/TTL policy before broader use. |
| Cloud Tasks worker delivery | `TASKMASTER_CLOUD_TASKS_QUEUE`, OIDC audience/service identity fields, `@google-cloud/tasks@7.0.0`. | Hosted OIDC delivery, duplicate-name rejection and bounded queue policy are verified; retry behavior under injected infrastructure failure remains untested. | Exercise one controlled retryable failure and inspect delivery-attempt correlation. |
| Cloud Run | Root `Dockerfile`/`cloudbuild.yaml` container deployed privately as `sitepilot-taskmaster`; existing `backend/*` remains the separate Vertex gateway path. | Private non-production revision and image digest are verified; live Gemini route is intentionally disabled. | One separately authorized synthetic Gemini run after Vertex IAM/configuration review. |
| Cloud Build and Artifact Registry | `cloudbuild.yaml` and `backend/cloudbuild.yaml` run lint/tests, build images, push to Artifact Registry, and deploy Cloud Run. | Taskmaster build `91d148e8-c269-43ec-afa4-816171a3ca54` and immutable digest are verified. | Keep commit/image/revision provenance in subsequent deployments. |
| Cloud Logging / Secret Manager | Taskmaster worker emits structured correlation-only JSON; existing backend references Secret Manager for its own boundary. | Correlation IDs and provider/model metadata were observed without secrets or opportunity documents. | Keep redaction checks in hosted smoke tests; no new secret was created in this slice. |

## C. Missing or recommended next implementation

| Priority | Google technology | Product value | Current status | Missing work | Verification needed |
|---|---|---|---|---|---|
| 1 | Live Gemini through Vertex AI, executed by the persisted Taskmaster run | Demonstrates the complete Google agent story rather than only local fallback. | **Recommended next verification**; local workflow is implemented and honest but model-disabled. | Authorize one synthetic hosted run, capture provider/model/correlation metadata, and retain redacted logs. | Live non-production request with cost cap and returned model metadata. |
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

The current repository now has a bounded, persisted Taskmaster architecture using the official Google ADK package, Firestore and Cloud Tasks adapters, alongside the existing GenAI/Vertex/Cloud Run configuration. The locally verified path is still the honest deterministic/template fallback: live authenticated Gemini, Firestore and Cloud Tasks execution remain unverified. The product should not be described as a formally compliant hackathon submission until the hosted Google proof, owner attestations, licensing decision and demonstration video are complete.
