# SitePilot Taskmaster release contract

## Flow

Browser → Vercel server → private Cloud Run API → Cloud Tasks → private worker → Firestore → Google ADK and Vertex AI Gemini 3.7 Flash → deterministic SitePilot simulation → human approval → on-demand grounded assessment.

## Pre-simulation stages

1. Persist confirmed input snapshot, version, hash, provenance, priorities, and optional instructions.
2. Reserve session/daily allowance and provider budget.
3. Use ADK for one bounded structured plan.
4. Use Gemini for exactly three schema-validated strategies.
5. Deterministically reconcile existing assets, program, geometry, targets/results, supplied planning inputs, distinctness, and component consistency.
6. Persist proposals and simulations, then stop at `AWAITING_APPROVAL`.

## Post-simulation stage

On explicit user request, the server recomputes all three canonical simulations, builds allowlisted evidence, reserves assessment allowance, and requests one structured Gemini assessment. `deterministicAssessment` remains authoritative; `aiAssessment` remains advisory. Exact input, question, simulation, and revision hashes bind reuse and staleness.

## Accounting and failure behavior

Persist provider attempts, responses, successful requests, model outputs, schema-accepted outputs, repair requests, prompt/candidate/tool/thought/total tokens, safe response metadata, cost estimate when configured, and the first authoritative failure layer. A later empty ADK event or candidate classification cannot replace an earlier transport failure.

Fallback uses zero provider counters when no request is made and is labelled as template/deterministic. Provider failure or allowance exhaustion never presents fallback as Gemini output.

## Rollback

Keep the previous Ready Gemini-disabled revision. If authentication, queue delivery, persistence, structured output, accounting, browser flow, or security fails, stop provider calls and route 100% traffic back to that recorded revision. The Vercel alias must likewise return to its recorded deployment if the public experience is impaired.
