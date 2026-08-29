# Google technology inventory and boundaries

## Implemented

| Technology | Implemented role |
| --- | --- |
| Google ADK 2.0.0 | One bounded Taskmaster planning agent with no model-managed mutation tools |
| Google Gen AI SDK 2.17.1 | Vertex `v1` JSON/schema proposal and assessment calls |
| Gemini 3.7 Flash | Strategy generation and grounded post-simulation assessment |
| Private Cloud Run | Node 22 Taskmaster API and worker with ADC |
| Cloud Tasks | Authenticated asynchronous delivery, bounded retries, deterministic task names |
| Firestore | Runs, events, proposals, simulations, idempotency, approval, allowances, provider accounting |
| Artifact Registry and Cloud Build | Immutable image build/publish and private service deployment |
| Cloud Logging | Safe correlation and allowlisted provider metadata |
| Vercel OIDC / Google WIF | Keyless private Cloud Run invocation from Vercel server routes |

## Deterministic authority

SitePilot alone calculates and persists canonical geometry, achieved GFA, FAR/KLB, KDB, height, setbacks, KDH evidence, collision/out-of-bounds checks, planning wording, accepted state, and exports. Gemini proposes and interprets; a person approves.

## Deferred—not demonstrated

Google Maps/cadastral context, user document ingestion, Cloud Storage, Pub/Sub, account-backed application persistence, automated external inquiries, statutory verification, market/cost/return analysis, and final investment decisions.

## Release evidence required

The final public candidate must show private IAM, anonymous Cloud Run 403, WIF success, queue completion and retry count, Firestore run/event/proposal/simulation records, provider/model/token accounting, distinct/schema-valid proposals, grounded assessment evidence, browser reload reuse/staleness, exports, accessibility, CLS, and sensitive-log scans.
