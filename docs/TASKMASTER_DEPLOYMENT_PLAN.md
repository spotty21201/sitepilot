# SitePilot Taskmaster deployment plan

This document describes the bounded Taskmaster workflow and its non-production Google Cloud deployment. The hosted infrastructure below is limited to deterministic/mock execution; live Gemini inference remains separately unauthorized.

## Infrastructure gate — 25 August 2026

The authenticated Sentani inspection identified `project-528f858c-325a-45aa-ac0` as the active project. Firestore and Cloud Tasks APIs were enabled, then the owner-authorized non-production resources were created in `asia-southeast2`. No production service or Vercel environment was changed, and no model call was made.

The read-only inventory found:

- **Firestore:** Native database `(default)` exists in `asia-southeast2`, with optimistic concurrency, delete protection enabled, PITR disabled and free tier enabled.
- **Cloud Tasks:** queue `sitepilot-taskmaster` exists in `asia-southeast2`, with one dispatch/one concurrent task, three maximum attempts, five-second minimum backoff and 30-second maximum backoff.
- **Cloud Run:** existing `sitepilot-vertex` remains at 100% traffic on `sitepilot-vertex-00002-4wd`, using `sitepilot-runner`, with image digest `sha256:8f0034901aba58e4b8db1b7944e8e7fd39acd751302c4d2c95df9298f5cce6fa`. Its current IAM policy is public (`allUsers` / `roles/run.invoker`) and it must not be changed by this slice. The proposed `sitepilot-taskmaster` service does not conflict by name.
- **Artifact Registry:** existing `sitepilot` and `sitepilot-repo` Docker repositories are present in `asia-southeast2`.
- **Cloud Build:** Taskmaster image build `3bf4e08b-30d1-4634-b09a-55990b4b2fb9` completed successfully. The current immutable image digest is `sha256:13f99cd7d28955af75ee604dfcbabb32ffac7629858dbd53d44d8f026023dded`.
- **Logging:** read access was confirmed for existing Cloud Run revision logs.
- **IAM:** dedicated identities now exist: `sitepilot-taskmaster-runtime` and `sitepilot-taskmaster-invoker`. The runtime has Firestore user, logging writer and queue-level task-enqueuer permissions; it may act as the invoker identity. The invoker identity is intended only for Cloud Run invocation. Existing broad legacy bindings and the public `sitepilot-vertex` service were not changed.
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
- `TASKMASTER_MAX_MODEL_CALLS=3` (ADK planning, structured proposals, and at most one repair)
- `TASKMASTER_MAX_DURATION_MS=30000`
- `TASKMASTER_MAX_OUTPUT_TOKENS=4096`

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
5. ~~Run one synthetic Central Jakarta case~~ — complete for deterministic/mock execution; capture run IDs, source study versions, provider/model metadata, task names, revision and redacted logs.
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

## Authorization gate

The non-production Firestore database, queue, dedicated service identities and private Taskmaster worker were created only in the project/region recorded above. Live Gemini inference remains separately unauthorized. Vercel remains outside this boundary.
