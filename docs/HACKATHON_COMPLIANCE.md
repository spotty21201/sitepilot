# SitePilot — Hackathon Compliance and Submission Readiness

## Official authority

- **Event:** [All Things Agentic Hackathon](https://allthingsagentichackathon.devpost.com/)
- **Official rules:** [Official Eligibility and Rules](https://allthingsagentichackathon.devpost.com/rules) — authoritative when another page or repository note differs
- **FAQ:** [Frequently Asked Questions](https://allthingsagentichackathon.devpost.com/details/faqs)
- **Resources and track guidance:** [Resources](https://allthingsagentichackathon.devpost.com/resources)
- **Submission Period:** August 3, 2026 at 9:00 AM Pacific Time through August 31, 2026 at 5:00 PM Pacific Time
- **Deadline:** August 31, 2026 at 5:00 PM Pacific Time

The rules URLs are known and were inspected read-only on August 23, 2026. Formal compliance is no longer blocked by missing authority. It remains **conditional on an implementation gap and owner attestations** described below.

## Binding requirements and current status

The rules require a newly created, functional autonomous AI agent that operates beyond a standard chat loop. Every track must use Gemini 3.5 or newer through the Gemini API or Vertex AI, at least one listed Google agent framework (including the Google GenAI SDK), and at least one Google Cloud infrastructure service. The entry must select one of **Taskmaster**, **Collaborative Partner**, or **Fortified Enterprise Fleet**.

| Requirement | Repository/runtime evidence | Status |
| :--- | :--- | :--- |
| Gemini 3.5 or newer | The configured model is `gemini-3.7-flash`. | **READY in source; live inference unverified in this pass** |
| Gemini API or Vertex AI | The executed production assessment gateway constructs `GoogleGenAI({ vertexai: true, project, location })`. The separate evidence route can use Vertex AI or a Gemini API key. | **READY in source** |
| Google agent framework | `@google/genai` 2.17.1 is imported and called by the Cloud Run backend and evidence extraction implementation; it is not merely an unused dependency. | **READY in source** |
| Google Cloud infrastructure | Cloud Run, Cloud Build, Artifact Registry, Vertex AI, Secret Manager, and Cloud Logging configuration is present. | **READY in source; current deployment and video proof unverified** |
| Autonomous agent beyond chat | The visible planning assessment is one request and one model call. There is no model-driven plan, tool/action loop, persistent agent run, autonomous routing, or background execution. | **BLOCKED — implementation gap** |
| New project during Submission Period | Git and public-repository evidence begin during the period, but the initial commit imports an already working MVP and does not prove its original authoring date. | **OWNER ATTESTATION REQUIRED** |
| Rights and third-party authorization | Package metadata is permissive; production contains no stock model, texture, or imagery. The repository has no root license file, and AI-provider/output rights require owner acceptance. | **PARTIAL / OWNER ACTION** |

No authenticated or paid inference was invoked during this compliance pass. Source configuration, prior deployment evidence, current live health, and demonstrated video evidence are separate claims.

## Project-newness audit

Evidence inspected includes all local and remote Git refs, author and committer dates, reflogs, the public GitHub repository metadata, the initial tree, PRD, August 21 audit and ADRs, Golden Project data, untracked prototype, production Spatial Console source, and dated browser reports. Filesystem modification times were not used as sole evidence.

| Material | Evidence | Classification |
| :--- | :--- | :--- |
| Public GitHub repository | `spotty21201/sitepilot` reports creation at `2026-08-19T14:39:32Z`; it is not a fork. | Created during Submission Period |
| Git history | Root commit `8066193` is dated August 19, 2026; all 18 reachable commits across all branches are dated August 19–21. | Created during Submission Period as recorded by Git |
| Initial SitePilot MVP, geometry, evidence UI, DAE, Golden Project, PRD, and 3D research | All first appear together in root commit `8066193`, described as an “initial baseline commit of audited working MVP.” No earlier Git object or branch was found. Because the commit imports a completed baseline, Git does not prove when those files were first authored. | Date unclear — owner attestation required |
| Case foundation and canonical persistence | Commit `0f6612d`, August 20, with later remediation on August 21. | Created during Submission Period |
| Phase 0 architecture decisions and audit | Commit `0667aca`, August 21; `Audit 20260821.md` and the ADRs identify the same period. | Created during Submission Period |
| Spatial Console prototype | Untracked, so Git provides no creation history. Its design-thesis addendum identifies an August 21 hardening pass, and independent browser artifacts record execution on August 22. Those facts establish activity during the period but not original creation by themselves. | Date unclear — owner attestation required |
| Production Spatial Console and canonical editing integration | Untracked source plus independent integration and browser evidence generated August 22–23. | Created during Submission Period, subject to owner confirmation that no earlier private source was imported |
| Next.js/React/TypeScript scaffolding and npm packages | Standard framework, tooling, libraries, and starter assets permitted by the rules, subject to their licenses. | Pre-existing standard framework/tooling |
| Default Next.js public SVGs and likely starter favicon | Standard starter-template assets; they are not material to the SitePilot submission story. | Pre-existing standard framework/tooling |
| Pascal, Three.js, React Three Fiber, Turf, MapLibre, Lucide, Google GenAI SDK, fonts, and other dependencies | Third-party libraries/packages, not claimed as SitePilot-authored work. | Pre-existing standard framework/tooling / third-party |
| “Golden Project” | SitePilot-specific illustrative data first present in the root commit; it is fixture/mock data, not evidence of an earlier external application. | Date unclear with initial baseline; disclose as illustrative data |
| Copied or adapted earlier project code | No copyright header, copied-source attribution, repository fork relationship, or code-level reference to an earlier application was found. This cannot exclude private or off-repository sources. | Owner attestation required |
| Work before August 3, 2026 | No repository evidence was found. Absence of evidence is not proof that no off-repository design, code, data, or prototype existed. | Owner attestation required |

### Honest pre-existing-work disclosure draft

> SitePilot was developed for the All Things Agentic Hackathon during the August 3–31, 2026 Submission Period. The public repository and recorded Git history begin on August 19, 2026. The initial commit imported a working SitePilot MVP, so the entrant has separately verified that the SitePilot-specific code, PRD, design, mock data, and prototype represented by that baseline were first created during the Submission Period. The project uses standard pre-existing frameworks, libraries, starter assets, fonts, and development tools under their respective licenses. AI coding and design assistants—including Antigravity and Kimi—were used under the entrant's direction. Any material code, design, data, or assets that the entrant confirms predated August 3 will be listed here specifically before submission.

The sentence asserting separate verification must not be used until the owner makes that attestation. If any material SitePilot-specific work predates August 3, it must be named and disclosed; because the rules also require the described/submitted project to be built during the Submission Period, disclosure may not cure a materially pre-existing project.

## Executed Gemini and Google GenAI SDK path

### Planning assessment shown in the Decision Room

1. A user enters an optional investor question and selects **Generate Comprehensive Assessment** in `src/components/ScenarioControls.tsx`.
2. The browser posts the active scenario, canonical masses, setbacks, zoning inputs, and commercial context to `src/app/api/assessment/route.ts`.
3. The Next.js route authenticates the request boundary, validates every geometry field, and recomputes metrics, intersections, setbacks, and the compliance verdict using the deterministic geometry engine.
4. When `CLOUDRUN_SERVICE_URL` is configured, the route sends one grounded prompt and a bearer secret to the Cloud Run backend `/analyze` endpoint.
5. `backend/server.js` authenticates before parsing the body, constructs `GoogleGenAI` with `vertexai: true`, and makes one `ai.models.generateContent` call to `gemini-3.7-flash` on Vertex AI.
6. The Next.js route validates model/project/location/revision provenance. Model text is used only to populate supporting-evidence prose; deterministic SitePilot logic remains authoritative for decision, status, risks, recommendation, metrics, and compliance.
7. Without Cloud Run configuration, local development returns a clearly labelled `DEV_HEURISTIC`; production fails closed instead of silently substituting it.

### Evidence extraction

`src/app/api/evidence/extract/route.ts` calls `extractDocumentFindings` / `createAiClient` in `src/lib/ai/gemini.ts`. The Google GenAI SDK produces structured evidence findings from text, PDF, or image inputs and the route normalizes findings, detects contradictions, and deterministically recalculates supplied geometry. Vertex AI is selected when a Google Cloud project is configured; the Gemini API is selected only when an API key is configured without a project; local development uses a labelled heuristic. No current Decision Room client call to this endpoint was found, so the route is executable production source but not a demonstrated end-user workflow in this pass.

## Google Cloud evidence matrix

| Layer | Source configured | Previously deployed | Currently live | Browser/video proof |
| :--- | :--- | :--- | :--- | :--- |
| Next.js application on Cloud Run | Root `Dockerfile` and `cloudbuild.yaml` build and deploy `sitepilot`. | Prior repository reports exist, not re-authenticated here. | Unverified in this pass. | Missing for submission. |
| Vertex assessment gateway on Cloud Run | `backend/Dockerfile`, `backend/cloudbuild.yaml`, and `backend/server.js` build/deploy `sitepilot-vertex`. | Prior reports identify a deployment, not re-authenticated here. | Unverified in this pass. | Missing for submission. |
| Vertex AI | ADC/IAM source uses project/location and `gemini-3.7-flash`; Cloud Build assigns the runtime service account. | Previously reported, not independently called here. | Unverified in this pass. | Vertex logs or equivalent must be captured. |
| Cloud Build / Artifact Registry | Both Cloud Build files contain container build, push, and Cloud Run deployment steps. | Repository configuration only in this pass. | Unverified. | Missing. |
| Authentication boundary | Same-origin/server authentication in Next.js; bearer secret checked before body parsing in the gateway; ADC/IAM from gateway to Vertex AI; Secret Manager binding in backend Cloud Build. | Mocked security tests cover the boundary. | Unverified against hosted services. | Missing. |

## Agentic-behavior and track audit

### Current behavior

- **User goal:** an optional investor question about the active development scenario.
- **Planning/decomposition:** none by the model; the server constructs a fixed prompt.
- **Tools or structured actions:** no model-selected tools. Deterministic geometry runs before the model call, and evidence extraction is a separate endpoint.
- **Data read:** one submitted scenario snapshot and selected business/zoning inputs. The assessment path does not read the Evidence Ledger's findings.
- **Data transformed:** Gemini produces assessment prose. It does not mutate canonical geometry, evidence, scenarios, persistence, or external systems.
- **Multi-step/autonomous work:** none. The user explicitly starts each one-shot request; no background or asynchronous agent run exists.
- **Evidence produced:** supporting-evidence prose and provenance metadata; authoritative metrics and compliance come from deterministic code.
- **Human approval:** canonical geometry edits have robust preview/accept/reject controls, but those edits are user-proposed rather than agent-proposed.

The visible **Investigate** framing and assessment button do not establish an autonomous agent. The current product is a strong deterministic decision workspace with a Gemini-assisted assessment and a structured extraction API, but it does not yet meet the event's autonomous-agent requirement.

### Track comparison and recommendation

| Track | Current fit | Verdict |
| :--- | :--- | :--- |
| **Taskmaster** | SitePilot already has a bounded multi-step due-diligence workflow, deterministic tools, canonical commands, revisions, persistence, and human approval controls. The AI does not yet route or execute that workflow. | **Recommended, conditional on remediation** |
| Collaborative Partner | The product presents evidence and accepts an investor question, but lacks stateful multi-turn dialogue, clarifying questions, persistent agent memory, and adaptation from feedback. | Not selected |
| Fortified Enterprise Fleet | No agent registry, multi-agent delegation, long-running agent runtime, memory bank, policy gateway, or agent observability is present. | Not selected |

**Recommended category: Taskmaster.** This is based on SitePilot's actual end-to-end workflow and existing action infrastructure, not its name. Selection on Devpost remains an owner action and should occur only after the remediation below is implemented and demonstrated.

### Minimum honest agentic-remediation vertical slice (not implemented in this pass)

Add one persisted, bounded **site-investigation run** that:

1. accepts a user goal such as “investigate this opportunity and prepare the safest viable scenario”;
2. uses Gemini to create a structured plan over existing tools: extract evidence, identify contradictions/unknowns, evaluate scenarios, and propose canonical spatial commands;
3. executes read-only tools automatically, records each result and revision, and routes failures explicitly;
4. pauses for human approval before any canonical geometry mutation;
5. applies accepted proposals only through the existing canonical command service, rejects stale revisions safely, and resumes the run;
6. produces an auditable completion report linking evidence, actions, accepted/rejected proposals, metrics, and remaining unknowns.

This slice should be tested in mock mode and shown performing the multi-step workflow live. Merely renaming the current assessment or adding chain-of-thought prose is insufficient.

## Submission-asset readiness

| Asset or action | Status | Evidence / next action |
| :--- | :--- | :--- |
| Devpost registration | **OWNER ACTION** | Register/confirm eligible entrant or team and representative. |
| Selected track | **OWNER ACTION** | Select exactly one; Taskmaster is recommended after remediation. |
| Project description | **PARTIAL** | README provides a basis; submission-specific agent behavior, findings, and limitations still need drafting. |
| Technology list | **READY** | Current source and package versions are documented. |
| Data-source disclosure | **PARTIAL** | Disclose user uploads, illustrative Menteng/Golden Project fixtures, and absence of authoritative parcel/GIS data. |
| Repository accessibility | **PARTIAL** | Public GitHub repository exists, but it does not contain this uncommitted release worktree. |
| Private-repository judge access | **OWNER ACTION** | Not needed while public; if made private, add both official judge email addresses before submission. |
| README spin-up instructions | **PARTIAL** | Local steps and the public clone URL exist; hosted/Cloud Run assessment setup still needs a concise reproducible path. |
| Architecture diagram | **PARTIAL** | `public/architecture-diagram.svg` now reflects the current app/gateway/Vertex path and explicitly labels the one-shot gap; it must be updated again for the final agentic path. |
| Hosted application URL | **MISSING** | No authoritative hosted URL is documented. |
| Demo credentials if required | **BLOCKED** | Determine after the hosted access model is fixed. |
| Four-minute video | **MISSING** | Must be public on YouTube or Vimeo; only the first four minutes are evaluated. |
| English narration/subtitles | **OWNER ACTION** | Required for the final video and submission materials. |
| Live action demonstration | **MISSING** | Must show an unedited run of the implemented agent taking action. |
| Cloud Run / Vertex proof | **MISSING** | Capture Cloud Run dashboard, Vertex logs, or `.run` URL in the video and retain repository evidence. |
| Screenshots | **READY locally** | Release screenshots exist under ignored `artifacts/`; select only submission-safe images later. |
| License/provenance | **PARTIAL** | Spatial provenance is documented; owner/provider attestation and a root project license decision/file remain. |
| Pre-existing-work disclosure | **PARTIAL** | Draft above; owner must confirm dates and identify any omitted earlier work. |
| Optional public build article | **OWNER ACTION** | Not created. |
| Optional social post | **OWNER ACTION** | Not created. |
| Optional additional Google AI model | **MISSING** | Optional only; do not add solely to claim bonus points without a real product use. |

## Eligibility and ownership confirmations required from the owner

Before submission, the entrant/representative must factually confirm:

1. age-of-majority and residence eligibility; no sanctions/export-control restriction;
2. no employment, contest-entity relationship, government role, or other conflict that makes the entrant ineligible;
3. employer/client awareness and consent if any work was performed within employment or contract scope;
4. SitePilot-specific code, PRD, design, mock data, and prototype in the initial August 19 baseline were first created on or after August 3, or identify every earlier material item;
5. no undisclosed code, design, data, imagery, model, texture, trademark, or confidential material was copied from another project;
6. authority under the applicable Kimi and other AI-provider terms to submit and license the generated/assisted output;
7. sufficient rights to all project content and acceptance of the official rules' ownership representations;
8. whether the entry is individual, team, or organization, with every eligible team member and the authorized representative listed.

These are factual submission attestations, not legal advice.

## Commit and submission boundary

This document is safe to include in the release documentation commit because it states the gap honestly. The four release commits may be authorized as a technically verified baseline, but **must not be represented as a hackathon-compliant autonomous-agent submission** until the agentic vertical slice is implemented, tested, and demonstrated and the owner attestations are complete.
