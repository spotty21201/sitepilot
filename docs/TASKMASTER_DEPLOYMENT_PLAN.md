# SitePilot Taskmaster deployment plan

This document describes the owner-authorization boundary for the bounded Taskmaster workflow. It is preparation only: this pass does not create Google Cloud resources, change IAM, deploy Cloud Run, or invoke paid Gemini inference.

## Local behavior

- `@google/adk@2.0.0` is pinned as the official TypeScript Agent Development Kit.
- `InMemoryTaskmasterRunRepository` is the local Firestore substitute.
- The local task queue executes one checkpointed worker delivery in-process.
- `TASKMASTER_ALLOW_LIVE_MODEL=false` keeps ADK/Gemini disabled. The deterministic study templates are labelled as templates—not model-generated.
- The browser never receives ADK, Google credentials, unrestricted prompts, or privileged tools.

## Google services and APIs required for an authorized hosted test

1. Vertex AI API (`aiplatform.googleapis.com`) for Gemini through Vertex AI.
2. Firestore API (`firestore.googleapis.com`) for `sitepilot_taskmaster_runs`.
3. Cloud Tasks API (`cloudtasks.googleapis.com`) for the Taskmaster queue.
4. Cloud Run API (`run.googleapis.com`) for the authenticated worker.
5. Cloud Build and Artifact Registry APIs for the existing build path.
6. Cloud Logging API for correlation-only operational events.

## Environment and data model

Set these only in an owner-approved non-production environment:

- `TASKMASTER_ALLOW_LIVE_MODEL=true`
- `TASKMASTER_ALLOW_MODEL_REPAIR=false` (enable only for one bounded repair call)
- `TASKMASTER_FIRESTORE_ENABLED=true`
- `TASKMASTER_FIRESTORE_COLLECTION=sitepilot_taskmaster_runs`
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

Each run document stores the run ID, correlation ID, opportunity ID, source study version, input hash, goal, validated plan, state transitions, concise tool activities, proposal set, deterministic simulations, approval decision, completion report, and provider/model metadata. Cloud Run emits correlation-only JSON events without private opportunity documents, unrestricted prompts, or secrets. Hidden chain-of-thought is never persisted.

## IAM plan

Use separate least-privilege service identities:

- Cloud Run worker: Vertex AI User, Firestore User, Cloud Logging Writer.
- Task enqueueing service: Cloud Tasks Enqueuer on the selected queue.
- Cloud Tasks service agent: Cloud Run Invoker on the worker target.
- Cloud Build identity: existing Artifact Registry writer and Cloud Run deployer roles only where already approved.

Do not expose the worker as publicly writable. Validate Cloud Tasks OIDC audience and the server-side worker secret at the boundary; the `x-sitepilot-taskmaster: cloud-task` marker alone is not accepted in production.

## Deployment sequence

1. Create or verify the Firestore database and `sitepilot_taskmaster_runs` collection in a non-production project.
2. Create the Cloud Tasks queue with a bounded retry policy and rate limit.
3. Deploy the worker revision with the service identity and the environment variables above.
4. Deploy the application revision with the enqueue/status/approval routes enabled.
5. Run one synthetic Central Jakarta case; capture run ID, source study version, provider/model metadata, task name, Cloud Run revision, and redacted logs.
6. Verify a duplicate task delivery, a retryable failure, a stale approval, a human rejection, and a successful approval/completion.

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

Before any hosted test, the owner must separately authorize cloud resource changes, IAM/service-account changes, enabling live Gemini inference, and the non-production deployment. Until then, the local fallback is the only verified generation path.
