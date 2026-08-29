# SitePilot Google Cloud deployment

## Current backend

- Project: `project-528f858c-325a-45aa-ac0`
- Region: `asia-southeast2`
- Service: `sitepilot-taskmaster`
- Runtime: Node 22
- Runtime identity: `sitepilot-taskmaster-runtime@project-528f858c-325a-45aa-ac0.iam.gserviceaccount.com`
- Vertex location/model/API: `global` / `gemini-3.7-flash` / stable `v1`
- Queue: `sitepilot-taskmaster`
- Firestore: Native `(default)` database

Cloud Run must remain private. The only service-level invokers are the existing Taskmaster delivery and Vercel API service accounts. Never use `--allow-unauthenticated`, `allUsers`, `allAuthenticatedUsers`, an API key, or a service-account key.

Vercel server routes exchange Vercel OIDC through Google STS, impersonate the existing Vercel API service account, generate an ID token whose audience is the exact Cloud Run service origin, and invoke Cloud Run server-to-server. Browser code never receives these credentials.

## Release procedure

1. Record current traffic, serving revision, image digest, environment, scaling, service account, and service IAM policy.
2. Build one immutable image from the tested feature-branch commit.
3. Deploy a named private revision with zero traffic and the existing runtime service account.
4. Preserve all existing environment values; update only the explicitly authorized model/release variables.
5. Verify Ready state, direct unauthenticated HTTP 403, authenticated Vercel invocation, Cloud Tasks delivery, Firestore persistence, deterministic fallback, and logs.
6. Run bounded live acceptance only after deterministic gates pass.
7. Route traffic only after acceptance; retain the prior Ready revision and rollback command.

Recommended bounded public settings are live model enabled, one structured repair per structured stage, maximum three logical model stages, no more than eight provider requests including repair, 4,096 maximum output tokens per stage, 32,768 total workflow tokens, maximum one Cloud Run instance, two session workflows, and a reasonable daily demo allowance. Firestore-backed allowances must reserve before provider calls.

The legacy `backend/` gateway is not the demonstrated architecture. Its Cloud Build file is marked legacy and private.
