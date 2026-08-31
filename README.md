# SitePilot — Better Places Begin With Better Questions

SitePilot turns a confirmed development opportunity into three comparable spatial strategies while keeping AI interpretation separate from calculated planning truth.

**[Open the public hackathon build](https://sitepilot-hackathon.vercel.app)** ·
**[View the Devpost submission](https://devpost.com/software/sitepilot-yromc5)**

## Demo video

[![Watch the SitePilot demo on YouTube](https://img.youtube.com/vi/FwUcc0RxXLA/maxresdefault.jpg)](https://youtu.be/FwUcc0RxXLA)

**[Watch the SitePilot demo on YouTube](https://youtu.be/FwUcc0RxXLA)**

![SitePilot Decision Room and Spatial Console.](docs/readme/sitepilot-hero.png)

## Current workflow

1. The user records and confirms the site, dimensions, existing asset, development intent, supplied planning inputs, commercial assumptions, priorities, and optional strategy instructions.
2. The private Taskmaster backend persists a run, uses Google ADK with Vertex AI Gemini 3.7 Flash to plan the bounded workflow, and asks Gemini for exactly three structured strategies: Conservative, Balanced, and Boundary.
3. Cloud Tasks delivers the asynchronous worker job and Firestore records the run, events, proposals, simulations, idempotency, correlation, and provider accounting.
4. SitePilot—not Gemini—calculates geometry, achieved GFA, FAR/KLB, KDB, height, setbacks, KDH evidence, collisions, and supplied-envelope status for every proposal.
5. The user reviews the three strategies and must explicitly approve one before it becomes the accepted editable study.
6. On request, Gemini compares all three canonical simulations and prepares a grounded advisory assessment. Deterministic findings remain authoritative.
7. The accepted state powers the Decision Room, 2D plan, 3D Spatial Console, comparison table, Executive Brief, Sources & Assumptions, and CSV/PDF/DAE exports.

If live inference is unavailable or an allowance is exhausted, SitePilot returns clearly labelled template schemes or a deterministic assessment. Fallback never claims that Gemini was called.

## AI authority boundary

Gemini may interpret the confirmed brief, propose strategic intent and structured program/massing parameters, identify trade-offs, and compare server-created evidence. It cannot alter confirmed inputs, canonical geometry, calculated metrics, planning status, persistence, approval state, or exports.

“Within supplied study envelope” is a deterministic study result, not statutory approval. KDH is reported only from explicit landscaped/permeable evidence; residual site area is reported separately.

## Three decision-ready strategies

- **Conservative:** prioritizes asset retention or adaptation, continuity, restrained intervention, lower supplied-envelope risk, and early deliverability.
- **Balanced:** balances achieved yield, public realm, program quality, servicing, phasing, continuity, and planning risk.
- **Boundary:** tests the productive upper edge of the supplied study envelope without inventing permissions or ignoring access, public realm, or operational constraints.

The distinctness gate requires meaningful differences across at least three strategic dimensions. Existing retained and removed GFA must reconcile exactly, program shares must total 100%, and strategic targets remain separate from deterministically achieved results.

## Architecture

![SitePilot technical architecture.](docs/architecture/sitepilot-technical-architecture.svg)

- Next.js 16.3.1, React 19.2.8, TypeScript, Zod, Three.js, and the SitePilot Spatial Console.
- Google ADK 2.0.0 and `@google/genai` 2.17.1.
- Vertex AI stable `v1`, location `global`, model exactly `gemini-3.7-flash`, JSON MIME, and server-owned response schemas.
- Private Cloud Run with runtime service-account ADC; no API key or service-account key.
- Cloud Tasks for asynchronous delivery and Firestore for Taskmaster run/event/proposal/simulation durability.
- Vercel server routes invoke private Cloud Run through Vercel OIDC → Google STS → service-account ID-token impersonation. Tokens remain server-only.
- Browser cases remain local to the browser; there is no account-backed project-sharing claim.

Unsupported or deferred product claims include user document upload, three specialist agents, Pub/Sub, Cloud Storage, automated external information requests, statutory approval, financial-return calculation, and final investment Go/No-Go decisions.

## Screens

![Opportunity intake.](docs/readme/opportunity-intake.png)
![Three-scheme comparison.](docs/readme/three-scheme-comparison.png)
![Spatial Console.](docs/readme/spatial-console.png)
![Sources and assumptions.](docs/readme/sources-and-assumptions.png)
![Development report.](docs/readme/development-report.png)

## Run and verify locally

### Requirements

- Node.js 22.22.2 LTS
- npm, as bundled with Node.js
- Git
- No Google Cloud credentials or Gemini API key for the default local path

### Clean-clone quick start

```bash
git clone https://github.com/spotty21201/sitepilot.git
cd sitepilot
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Do not create an environment file for the default local test. With no AI or
Google Cloud variables configured, SitePilot runs in safe local mode:

- the intake, comparison, deterministic simulation, review, and export
  surfaces remain available;
- Taskmaster identifies the provider as `LOCAL_DEVELOPMENT`;
- runtime evidence reports `modelCalled=false`;
- strategy generation uses explicitly labelled template schemes and assessment
  uses deterministic evidence;
- no Gemini, Vertex AI, Firestore, or Cloud Tasks request is made.

The visible fallback disclosure is:

> Template schemes used. No model request was made; SitePilot calculated and
> validated all planning figures deterministically.

### Verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Each command should exit successfully. The production build can then be tested
with:

```bash
npm start
```

### Optional live Gemini test

Live inference is opt-in and makes external, potentially billable requests.
For local Gemini API development, create `.env.local` containing only:

```dotenv
TASKMASTER_ALLOW_LIVE_MODEL=true
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.7-flash
```

On a successful live run, runtime evidence should report:

- provider `GEMINI_API`;
- model `gemini-3.7-flash`;
- `modelCalled=true`;
- non-zero provider and token accounting.

If the provider is unavailable or its allowance is exhausted, SitePilot returns
the disclosed template/deterministic fallback and does not claim that Gemini
was called.

Never commit `.env.local`, expose credentials through `NEXT_PUBLIC_*`
variables, or copy `.env.example` unchanged: it contains placeholders for the
full deployment configuration.

The hosted Vertex AI architecture uses private Cloud Run, runtime
service-account ADC, Cloud Tasks, and Firestore. See
[Google Cloud deployment](docs/GOOGLE_CLOUD_DEPLOYMENT.md) for its environment
requirements and security boundaries.

## Current limitations and owner gates

- Parcel, street, setback, and context geometry are study representations, not cadastral surveys.
- User-supplied planning and commercial figures remain unverified unless their provenance says otherwise.
- Browser-local case persistence is not account-backed, collaborative, or suitable for confidential production data.
- The public inference path is quota-limited and preserves deterministic fallback.
- A configured provider or model name is not proof of live inference. Use the
  runtime `modelCalled`, provider, model, and token evidence.
- Entrant eligibility, project-newness, third-party/AI-provider rights, team details, and final submission attestations remain owner-controlled factual confirmations.

See [hackathon readiness](docs/HACKATHON_COMPLIANCE.md), the
[Devpost submission source](docs/DEVPOST_DRAFT.md), and the
[four-minute demo plan](docs/DEMO_VIDEO_PLAN.md).

## License

SitePilot is licensed under the [MIT License](LICENSE). Third-party packages,
fonts, assets, and tools remain subject to their respective licenses.
