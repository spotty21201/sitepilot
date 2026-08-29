# SitePilot four-minute demo package — not published

## Synthetic input set

- **Opportunity:** Sudirman Green Link — Hackathon Synthetic
- **Site:** 12,000 m²; 100 m frontage; 120 m depth
- **Existing asset:** 6,000 m², three storeys, operational
- **Intent:** transit-oriented retail, offices, residences, hotel, shaded pedestrian space, public plaza, phased investment
- **Supplied inputs:** FAR 7.0; KDB 50%; KDH 25% unverified; height 180 m; setbacks 10 m front, 8 m rear, 6 m sides
- **Commercial assumptions:** asking price Rp1.8T; NJOP benchmark Rp1.2T; both unverified
- **Additional Strategy Instructions:** “Every strategy must preserve a shaded east–west pedestrian link and a service route that can operate during phased construction. Compare retention-led continuity, a balanced courtyard phase, and comprehensive redevelopment; avoid three tower-only variants.”

## Timestamped shot list and narration

### 0:00–0:25 — problem and value

Show the Decision Room and three-scheme comparison.

Narration: “Early development decisions mix incomplete planning inputs, asset constraints, delivery priorities, and spatial consequences. SitePilot gives teams three genuinely different strategies while keeping one deterministic source of planning truth.”

### 0:25–0:58 — confirmed opportunity

Create the synthetic opportunity, move across all intake tabs, and show the review snapshot and Additional Strategy Instructions.

Narration: “The user confirms site, existing asset, supplied controls, commercial assumptions, owner priorities, and an optional design brief. The snapshot is versioned and hashed; instructions cannot override system rules or calculations.”

### 0:58–1:28 — Taskmaster and Gemini proof

Click **Confirm snapshot & create opportunity + 3 schemes**. Show real persisted progress, then provider `VERTEX_AI`, model `gemini-3.7-flash`, run/correlation IDs, schema result, request counts, and non-zero tokens.

Narration: “A private Cloud Run Taskmaster uses Google ADK to plan the bounded workflow. Cloud Tasks delivers the worker, Firestore records the run, and Gemini 3.7 Flash returns structured strategies. No browser token or service-account key is used.”

### 1:28–2:08 — three strategies and deterministic truth

Show Conservative, Balanced, and Boundary cards; highlight asset action, program, public realm, servicing, phasing, hypotheses, trade-offs, and rejection conditions. Open comparison and Spatial Console.

Narration: “Gemini shapes intent. SitePilot independently calculates geometry, achieved GFA, FAR, coverage, height, setbacks, KDH evidence, and collisions. Targets are not presented as achieved results, and statutory approval is never inferred.”

### 2:08–2:32 — human approval

Approve one strategy and show canonical revision/editing controls.

Narration: “Nothing becomes accepted geometry until a person approves it. Revisions, idempotency, and stale protection preserve that boundary.”

### 2:32–3:15 — grounded post-simulation assessment

Click **Prepare Planning Assessment**. Show Point, Strength, and Watch-out for all three; open active-scheme evidence, confidence, alternatives, and provider accounting.

Narration: “A separate bounded Gemini request compares the actual simulations. Its assessment is advisory and every evidence reference resolves to a server-created metric. Deterministic findings remain visibly separate.”

### 3:15–3:35 — persistence and exports

Reload, show the assessment remains and reuses without a request; make a relevant geometry edit and show **Needs updating**. Export CSV, PDF, and DAE.

Narration: “The assessment survives reload, unchanged inputs reuse it, relevant edits mark it stale, and accepted state drives every export.”

### 3:35–4:00 — Google Cloud proof and close

Show a safe Cloud Run revision screen, private IAM invokers, Cloud Tasks completion, Firestore event/proposal/simulation counts, and Vertex request/usage metadata. Do not show prompts, bodies, tokens, assertions, or credentials.

Narration: “The live path is Vercel to private Cloud Run through identity federation, then Cloud Tasks, Firestore, ADK, and Vertex AI. SitePilot combines AI strategy with deterministic accountability and human control.”

## Expected visible outputs

- Provider `VERTEX_AI`; model `gemini-3.7-flash`; non-zero requests, responses, accepted outputs, and tokens.
- Three materially different strategies influenced by the additional instructions.
- Exact existing GFA and 100% program reconciliation.
- Three deterministic simulations and a human approval gate.
- Grounded comments for every scheme and detailed active-scheme assessment.
- Reload persistence, unchanged-input reuse, relevant-edit stale message.
- Successful CSV, multi-page PDF, and metre-scale `Z_UP` DAE.

## Provider-failure recording contingency

Do not retry repeatedly on camera. Show the honest fallback disclosure, explain that deterministic planning remains available, and cut to a previously recorded safe proof shot from the same accepted release. Never present fallback as live Gemini output.
