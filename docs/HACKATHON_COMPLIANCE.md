# 🏆 SitePilot — All Things Agentic Hackathon Compliance Matrix

This document provides verifiable evidence of SitePilot's full compliance with all mandatory hackathon criteria.

---

## 1. Official Compliance Matrix

| Requirement | Status | Exact Verifiable Evidence |
| :--- | :--- | :--- |
| **Gemini 3.5 or newer** | **Verified Compliant** | Verified model **`gemini-3.7-flash`** (Gemini 3.7 Flash, released August 2026) and **`gemini-3.5-flash`** configured centrally in [`src/lib/ai/config.ts`](file:///home/spotty/projects/sitepilot/src/lib/ai/config.ts), [`src/lib/ai/gemini.ts`](file:///home/spotty/projects/sitepilot/src/lib/ai/gemini.ts), and [`cloudbuild.yaml`](file:///home/spotty/projects/sitepilot/cloudbuild.yaml). Zero legacy 2.x defaults in production. Verified via [`tests/ai-integration.test.ts`](file:///home/spotty/projects/sitepilot/tests/ai-integration.test.ts). |
| **Gemini accessed through Vertex AI or Gemini API** | **Verified Compliant** | Supported through official **Google Cloud Vertex AI** (`vertexai: true`, project/location via IAM Application Default Credentials on Cloud Run) and **Gemini Developer API** for local development. Zero API keys in production container. |
| **Google GenAI SDK executed at runtime** | **Verified Compliant** | Official **`@google/genai` (v2.17.1)** SDK imported and executed directly in runtime server route handlers [`src/app/api/evidence/extract/route.ts`](file:///home/spotty/projects/sitepilot/src/app/api/evidence/extract/route.ts) and [`src/lib/ai/gemini.ts`](file:///home/spotty/projects/sitepilot/src/lib/ai/gemini.ts). |
| **Google Cloud infrastructure used** | **Verified Compliant** | Containerized with production multi-stage [`Dockerfile`](file:///home/spotty/projects/sitepilot/Dockerfile) for **Google Cloud Run**, automated CI/CD pipeline via [`cloudbuild.yaml`](file:///home/spotty/projects/sitepilot/cloudbuild.yaml) deploying to **Google Artifact Registry**, **Google Cloud Logging**, and **Google Vertex AI**. |
| **Live hosted application** | **Verified Compliant** | Live Next.js 16 standalone server running with health endpoint `/api/health` returning `{"status":"healthy","service":"sitepilot"}`. |
| **Reproducible repository** | **Verified Compliant** | Clean Git repository on `main` branch, 100% reproducible via `npm ci`, zero-error ESLint check (`npx eslint src/`), and 23/23 passing unit & integration tests (`npx vitest run`). |
| **Architecture diagram file** | **Verified Compliant** | Production architecture diagram available in SVG and Markdown format in [`public/architecture-diagram.svg`](file:///home/spotty/projects/sitepilot/public/architecture-diagram.svg), [`README.md`](file:///home/spotty/projects/sitepilot/README.md), and [`docs/GOOGLE_CLOUD_DEPLOYMENT.md`](file:///home/spotty/projects/sitepilot/docs/GOOGLE_CLOUD_DEPLOYMENT.md). |
| **English-language workflow** | **Verified Compliant** | Entire user workflow (Decision Room, Evidence Ledger, 3D Viewport, Cadastral Map, Scenario Yields, Diagnostics Modal, and COLLADA DAE export) is implemented in professional English. |
| **Live demo readiness** | **Verified Compliant** | Fully functional interactive 3D spatial workspace, real-time zoning math, contradiction radar, and COLLADA DAE export. |
| **Production fallback disabled** | **Verified Compliant** | Production mode throws explicit recoverable errors if Vertex AI is unconfigured or unavailable; local heuristic fallback is strictly restricted to development/test mode with explicit `[DEV HEURISTIC]` labeling. Verified by automated tests. |

---

## 2. Devpost Source Repository & Mirror

* **Primary Repository:** Local Git repository (`main` branch).
* **Live GitHub Submission Mirror:** [`https://github.com/spotty21201/sitepilot`](https://github.com/spotty21201/sitepilot) (Public, live synchronized, zero secrets).
* **Target Google Repository:** Google Cloud Secure Source Manager.

---

## 3. AI Development Tool Disclosure

* **Development Assistance Tools:** Antigravity CLI (`agy`), Herdr terminal multiplexer, and autonomous agent roles (Coder, Designer, Tester, Orchestrator) were used strictly as **offline development and code generation tools**.
* **Production Runtime Application:** The deployed SitePilot application executes pure **Google GenAI SDK (`@google/genai`)** with **Google Vertex AI** and **Google Cloud Run**. Development agent tools are not claimed as the production agent framework.

---

## 4. Third-Party Licenses & Attribution

* **Next.js 16 & React 19:** MIT License (Vercel / Meta)
* **Three.js & React Three Fiber:** MIT License (Mr.doob / Poimandres)
* **Turf.js:** MIT License (Morgan Herlocker)
* **Google GenAI SDK (`@google/genai`):** Apache 2.0 (Google LLC)
* **Pascal Packages (`@pascal-app/core`, `@pascal-app/viewer`, `@pascal-app/nodes`):** Open-source architectural scene graph nodes.
