# SitePilot Taskmaster deployment plan

This document describes the bounded Taskmaster workflow and its non-production Google Cloud deployment. The hosted infrastructure is restricted to synthetic data. A single owner-authorized live Vertex AI run was performed on 25 August 2026; the worker was restored to deterministic/template fallback immediately afterwards.

## Infrastructure gate — 25 August 2026

The authenticated Sentani inspection identified `project-528f858c-325a-45aa-ac0` as the active project. Firestore and Cloud Tasks APIs were enabled, then the owner-authorized non-production resources were created in `asia-southeast2`. No production service or Vercel environment was changed, and no model call was made.

The read-only inventory found:

- **Firestore:** Native database `(default)` exists in `asia-southeast2`, with optimistic concurrency, delete protection enabled, PITR disabled and free tier enabled.
- **Cloud Tasks:** queue `sitepilot-taskmaster` exists in `asia-southeast2`, with one dispatch/one concurrent task, three maximum attempts, five-second minimum backoff and 30-second maximum backoff.
- **Cloud Run:** existing `sitepilot-vertex` remains at 100% traffic on `sitepilot-vertex-00002-4wd`, using `sitepilot-runner`, with image digest `sha256:8f0034901aba58e4b8db1b7944e8e7fd39acd751302c4d2c95df9298f5cce6fa`. Its current IAM policy is public (`allUsers` / `roles/run.invoker`) and it must not be changed by this slice. The proposed `sitepilot-taskmaster` service does not conflict by name.
- **Artifact Registry:** existing `sitepilot` and `sitepilot-repo` Docker repositories are present in `asia-southeast2`.
- **Cloud Build:** Taskmaster image build `3bf4e08b-30d1-4634-b09a-55990b4b2fb9` completed successfully. The current immutable image digest is `sha256:13f99cd7d28955af75ee604dfcbabb32ffac7629858dbd53d44d8f026023dded`.
- **Logging:** read access was confirmed for existing Cloud Run revision logs.
- **IAM:** dedicated identities now exist: `sitepilot-taskmaster-runtime` and `sitepilot-taskmaster-invoker`. The runtime has Vertex AI User (permission prepared but live model disabled), Firestore User, logging writer and queue-level task-enqueuer permissions; it may act as the invoker identity. The invoker identity is intended only for Cloud Run invocation. Existing broad legacy bindings and the public `sitepilot-vertex` service were not changed.
- **Taskmaster worker:** private Cloud Run service `sitepilot-taskmaster` is serving revision `sitepilot-taskmaster-00004-qrv` from image digest `sha256:13f99cd7d28955af75ee604dfcbabb32ffac7629858dbd53d44d8f026023dded`, with the dedicated runtime identity, one maximum instance, one concurrent request and scale-to-zero.

The location gate was satisfied by the owner authorization because `asia-southeast2` is a supported location and no existing database or conflicting default resource was present. The inspection commands were:

```bash
gcloud auth list
gcloud config get-value project
gcloud firestore databases list --project=project-528f858c-325a-45aa-ac0
gcloud tasks queues list --location=asia-southeast2 --project=project-528f858c-325a-45aa-ac0
gcloud run services list --region=asia-southeast2 --project=project-528f858c-325a-45aa-ac0
```

The database was created before the queue and worker. This inventory is not itself evidence of hosted Taskmaster execution; that requires the deterministic mock workflow below.

## Hosted deterministic/mock evidence — 25 August 2026

Using synthetic Central Jakarta data only, the private worker was exercised through real Cloud Tasks deliveries. Run `tm-hosted-smoke-324aea9` (`corr-hosted-324aea9`) on revision `sitepilot-taskmaster-00004-qrv` reached `AWAITING_APPROVAL` with three Firestore proposals, nine bounded tool activities and provider `LOCAL_DEVELOPMENT`; `modelCalled=false`. Earlier runs `tm-hosted-smoke-20260825` and `tm-hosted-resume-20260825` established duplicate-name protection and resume from a persisted `FAILED_RETRYABLE` checkpoint. Recreating the first deterministic task name returned `ALREADY_EXISTS`, and its run remained at revision 25 with three proposals. Direct unauthenticated worker access returned HTTP 403. Cloud Logging contained only structured run/correlation/provider/model fields for the observed deliveries; no secrets, prompts or opportunity documents were logged.

This proves the Firestore/Cloud Tasks/private Cloud Run deterministic boundary only. It is not live Gemini or Vertex AI evidence.

## Owner-authorized live Vertex AI evidence — 25 August 2026

One post-packaging synthetic run used the existing runtime identity and no API key or service-account key:

- **Project/region:** `project-528f858c-325a-45aa-ac0` / Cloud Run and Cloud Tasks `asia-southeast2`; Vertex location `global`.
- **Run:** `tm-live-gemini-20260825-actual2`; correlation ID `corr-tm-live-gemini-20260825-actual2`.
- **Task:** `taskmaster-tm-live-gemini-20260825-actual2` on queue `sitepilot-taskmaster`.
- **Worker:** revision `sitepilot-taskmaster-00012-6zj`, image digest `sha256:bf50c1fd2d6cd515d2142d5333671fbe1adcf41e624c09deec3e9766fb1053b8`.
- **Provider/model:** `VERTEX_AI` / `gemini-3.7-flash`; the run recorded `modelCalled=true` and `modelCallCount=2` (ADK planning phase plus structured proposal phase).
- **Result:** Firestore recorded 19 events, six bounded tool activities and three persisted proposals, then stopped at `AWAITING_APPROVAL`. No proposal was applied to an accepted study.
- **Deterministic authority:** SitePilot calculated all three simulations. The results were `OUTSIDE_SUPPLIED_LIMITS` where the model proposals exceeded supplied FAR/height or triggered collisions; KDH remained `not demonstrated` because no explicit landscaped/permeable input was supplied.
- **Proposal quality limitation:** The three names, theses and podium/tower arrangements were materially different (`4/38`, `3/42`, `5/30` storeys), but all three selected `ADAPT` for the existing asset and returned empty `programGFAByUse` objects. The schema accepted those fields, while the current deterministic validator correctly rejected the resulting massing on planning grounds. This is evidence of a working model/validation boundary, not evidence that the generated schemes are ready for professional use without a semantic completeness check.
- **Audit:** Cloud Logging contained correlation/run/state/provider/model metadata and ADK request markers, but no prompts, secrets or private documents. Firestore retained the structured proposals and simulations; hidden reasoning was not stored.

The application-level counter is not a transport-level inference meter. Cloud Run logs contained seven ADK `Sending out request` events during this run, so the configured two logical model phases did **not** prove a hard two-request transport cap. Token usage and estimated cost were not returned or persisted by the current adapter and are therefore **unavailable**, not estimated. No repair, fallback or approval occurred.

The live run exposed two follow-up engineering items: the ADK runtime currently emits a deprecation warning for `GOOGLE_GENAI_USE_VERTEXAI` (the deployed configuration now uses explicit Vertex client configuration with `VERTEX_AI_LOCATION`), and the request budget needs enforcement at the provider boundary rather than only at the logical phase counter. Provider transport budgeting is now persisted per run and applies to every Vertex request, including ADK turns and one repair request.

## Local behavior

- `@google/adk@2.0.0` is pinned as the official TypeScript Agent Development Kit.
- `InMemoryTaskmasterRunRepository` is the local Firestore substitute.
- The local task queue executes one checkpointed worker delivery in-process.
- `TASKMASTER_ALLOW_LIVE_MODEL=false` keeps ADK/Gemini disabled. The deterministic study templates are labelled as templates—not model-generated.
- The browser never receives ADK, Google credentials, unrestricted prompts, or privileged tools.

## Google services and APIs required for an authorized hosted test

1. Vertex AI API (`aiplatform.googleapis.com`) for Gemini through Vertex AI.
2. Firestore API (`firestore.googleapis.com`) for `taskmasterRuns` and `taskmasterIdempotency`.
3. Cloud Tasks API (`cloudtasks.googleapis.com`) for the Taskmaster queue.
4. Cloud Run API (`run.googleapis.com`) for the authenticated worker.
5. Cloud Build and Artifact Registry APIs for the existing build path.
6. Cloud Logging API for correlation-only operational events.

## Environment and data model

Set these only in an owner-approved non-production environment:

- `TASKMASTER_ALLOW_LIVE_MODEL=true`
- `TASKMASTER_ALLOW_MODEL_REPAIR=false` (enable only for one bounded repair call)
- `TASKMASTER_FIRESTORE_ENABLED=true`
- `TASKMASTER_FIRESTORE_COLLECTION=taskmasterRuns`
- `TASKMASTER_FIRESTORE_IDEMPOTENCY_COLLECTION=taskmasterIdempotency`
- `TASKMASTER_CLOUD_TASKS_QUEUE=<queue-name>`
- `TASKMASTER_WORKER_URL=<authenticated-worker-url>`
- `TASKMASTER_TASK_AUDIENCE=<worker-audience>`
- `TASKMASTER_SERVICE_ACCOUNT_EMAIL=<cloud-tasks-service-account>`
- `TASKMASTER_WORKER_SECRET=<server-side-only-secret>`
- `TASKMASTER_MAX_TOOL_CALLS=16`
- `TASKMASTER_MAX_RETRIES=2`
- `TASKMASTER_MAX_MODEL_CALLS=2` for the bounded planning/proposal phases; the transport guard independently enforces `TASKMASTER_MAX_PROVIDER_REQUESTS=8` and `TASKMASTER_MAX_TOTAL_TOKENS=32768`.
- `TASKMASTER_MAX_DURATION_MS=30000`
- `TASKMASTER_MAX_OUTPUT_TOKENS=4096`
- `TASKMASTER_DAILY_RUN_LIMIT=20` and `TASKMASTER_SESSION_RUN_LIMIT=2` provide conservative public-demo allowances. Exhaustion selects explicitly labelled study templates without calling Vertex AI.

## Vercel-to-Google boundary

The browser remains a same-origin client. When `TASKMASTER_API_URL` is configured on the Vercel server runtime, the Next route exchanges the Vercel OIDC subject token through Google Workload Identity Federation and calls the private `sitepilot-taskmaster-api` Cloud Run service. The API creates the Firestore run and enqueues an identifier-only Cloud Task; only the dedicated Cloud Tasks identity can invoke `sitepilot-taskmaster`. No service-account key is used in Vercel and the API identity cannot invoke Vertex AI.

The Vercel provider must restrict the verified team, project and Preview environment claims. The Cloud Run API uses `TASKMASTER_API_MODE=true`, `TASKMASTER_ALLOW_LIVE_MODEL=false`, Firestore Native mode and the existing queue. The worker separately enables Vertex only during an explicitly authorized synthetic run.

Firestore stores `taskmasterRuns/{runId}`, `events/{eventId}`, `proposals/{proposalId}`, and `taskmasterIdempotency/{keyHash}`. Run writes use optimistic transactions, a monotonic revision, a lease owner/expiry, and deterministic idempotency documents. Each run document stores the run ID, correlation ID, opportunity ID, source study version, input hash, goal, validated plan, state transitions, concise tool activities, proposal set, deterministic simulations, approval decision, completion report, and provider/model metadata. Cloud Run emits correlation-only JSON events without private opportunity documents, unrestricted prompts, or secrets. Hidden chain-of-thought is never persisted.

## IAM plan

Use separate least-privilege service identities:

- Cloud Run worker: Vertex AI User, Firestore User, Cloud Logging Writer.
- Task enqueueing service: Cloud Tasks Enqueuer on the selected queue.
- Cloud Tasks delivery uses the dedicated `sitepilot-taskmaster-invoker` service account with `roles/run.invoker` on the Taskmaster service. The Cloud Tasks service agent has only `roles/iam.serviceAccountUser` on that identity so it can mint the OIDC token. The runtime identity has queue-level enqueue permission and `roles/iam.serviceAccountUser` on the invoker identity.
- Cloud Build identity: existing Artifact Registry writer and Cloud Run deployer roles only where already approved.

Do not expose the worker as publicly writable. Validate Cloud Tasks OIDC audience and the server-side worker secret at the boundary; the `x-sitepilot-taskmaster: cloud-task` marker alone is not accepted in production.

## Deployment sequence

1. ~~Create or verify the Firestore Native database~~ — complete for `(default)` in `asia-southeast2`; use `taskmasterRuns` / `taskmasterIdempotency`.
2. ~~Create the `sitepilot-taskmaster` queue~~ — complete with bounded retry policy and rate limit.
3. ~~Deploy the private worker revision~~ — complete as `sitepilot-taskmaster-00004-qrv` with the dedicated runtime and OIDC task identity.
4. Deploy the Vercel/server application revision with the enqueue/status/approval routes enabled; this remains outside the current hosted infrastructure pass.
5. ~~Run one synthetic Central Jakarta case~~ — deterministic/mock execution and one owner-authorized Vertex AI execution are complete. Capture run IDs, source study versions, provider/model metadata, task names, revision and redacted logs; do not treat the live run as approval or production integration.
6. Duplicate-name protection and persisted retry resume are verified. Stale approval, rejection and accepted-study application remain application-level checks to run before enabling a live model path.

No step should use a confidential opportunity or an unbounded prompt.

## Cost and scale safeguards

- Keep the queue and Cloud Run worker at scale-to-zero outside the test window.
- Bound model calls, tool calls, execution time, retries, and output size.
- Use one synthetic case and one authorized live call for the first proof.
- Alert on unexpected task volume and Vertex AI spend.
- Do not enable general evidence ingestion, Maps, Pub/Sub, or multi-agent orchestration in this slice.

## Rollback

1. Set `TASKMASTER_ALLOW_LIVE_MODEL=false` and remove the Cloud Tasks queue environment variables.
2. Route new creation back to the existing deterministic/template endpoint.
3. Stop the worker revision and pause the queue; do not delete run documents until audit retention is agreed.
4. Restore the prior application revision or feature-flag the Taskmaster route off.
5. Confirm browser-local accepted studies and exports remain unchanged.

## Restoration after live test

The worker was restored to fallback revision `sitepilot-taskmaster-00013-drs` using the same immutable image digest, with `TASKMASTER_ALLOW_LIVE_MODEL=false`, `TASKMASTER_ALLOW_MODEL_REPAIR=false`, `TASKMASTER_MAX_MODEL_CALLS=0`, `GOOGLE_CLOUD_LOCATION=asia-southeast2`, scale-to-zero and maximum one instance. The Cloud Tasks queue was restored to three maximum attempts, one dispatch per second and one concurrent dispatch. Direct unauthenticated worker access still returns HTTP 403. The synthetic live run remains in Firestore at `AWAITING_APPROVAL` for audit; no accepted study was changed.

## Authorization gate

The non-production Firestore database, queue, dedicated service identities and private Taskmaster worker were used only in the project/region recorded above. Vercel, `main`, production aliases, IAM administration and billing configuration remain outside this boundary. A future live run requires explicit owner authorization, a transport-level request budget, token/cost telemetry, and review of the ADK environment marker.
