# 🏆 SitePilot — All Things Agentic Hackathon Compliance Matrix

This document provides verifiable evidence of SitePilot's full compliance with all mandatory hackathon criteria.

---

## 1. Mandatory Requirements Compliance Matrix

| Requirement | Status | Verifiable Implementation Evidence | Gap / Notes |
| :--- | :--- | :--- | :--- |
| **1. Gemini Model (Eligible Model)** | **Compliant** | Configured for `gemini-2.5-flash` in [`src/lib/ai/config.ts`](file:///home/spotty/projects/sitepilot/src/lib/ai/config.ts) and [`src/lib/ai/gemini.ts`](file:///home/spotty/projects/sitepilot/src/lib/ai/gemini.ts). Generates structured JSON findings with strict Zod/JSON schemas. | Fully verified via automated test suite [`tests/ai-integration.test.ts`](file:///home/spotty/projects/sitepilot/tests/ai-integration.test.ts). |
| **2. Gemini Access (Gemini API or Vertex AI)** | **Compliant** | Runtime natively supports both **Google Cloud Vertex AI** (using IAM Application Default Credentials on Cloud Run) and **Gemini Developer API** (for local development). | No service account keys or API keys committed. Zero credential leakage. |
| **3. Google Qualifying Framework** | **Compliant** | Officially imports and executes **Google GenAI SDK (`@google/genai` v2.17.1)** inside application runtime routes (`/api/evidence/extract`). | Real runtime invocation, not a dummy or development-only wrapper. |
| **4. Google Cloud Infrastructure Service** | **Compliant** | Complete multi-service Google Cloud architecture: **Cloud Run**, **Artifact Registry**, **Cloud Build**, **Vertex AI**, and **Cloud Logging**. | Production `Dockerfile` and `cloudbuild.yaml` ready for automated serverless execution. |
| **5. Reproducible from Repository** | **Compliant** | Full clean build from lockfile (`npm ci`, `npm run build`), zero-error ESLint check (`npx eslint src/`), and 100% passing tests (`npx vitest run`). Containerized with multi-stage `Dockerfile`. | `Dockerfile` and `cloudbuild.yaml` provide 100% reproducible execution. |
| **6. Architecture Diagram Available** | **Compliant** | Complete Mermaid architecture, data flow, and sequence diagrams embedded in [`README.md`](file:///home/spotty/projects/sitepilot/README.md) and [`docs/GOOGLE_CLOUD_DEPLOYMENT.md`](file:///home/spotty/projects/sitepilot/docs/GOOGLE_CLOUD_DEPLOYMENT.md). | Fully documented and exportable. |
| **7. English-Language User Workflow** | **Compliant** | Entire UI, executive brief, spatial controls, evidence extraction ledger, diagnostics modal, and COLLADA DAE export are presented in professional English. | Compliant. |
| **8. Demo-Ready Working Application** | **Compliant** | Fully functional 3D spatial development workspace, cadastral 2D mapping, multi-scenario yield comparison, compliance verification, and COLLADA export. | Verified live with automated test suite and running server. |

---

## 2. AI Development Tool Disclosure

* **Assisting Tools:** Antigravity CLI (`agy`), Herdr terminal multiplexer, and autonomous developer agents (Coder, Designer, Tester, Orchestrator) were used strictly as **development acceleration and testing tools**.
* **Production Runtime:** The deployed SitePilot application runtime executes pure **Google GenAI SDK (`@google/genai`)** against **Google Cloud Vertex AI** and **Google Cloud Run**. The development agents are not claimed as part of the production runtime.

---

## 3. Third-Party Code & Licensing Disclosure

* **Next.js & React:** MIT License (Vercel & Meta)
* **Three.js & React Three Fiber:** MIT License
* **Turf.js:** MIT License
* **Google GenAI SDK (`@google/genai`):** Apache 2.0 (Google LLC)
* **Pascal Packages (`@pascal-app/core`, `@pascal-app/viewer`, `@pascal-app/nodes`):** Used in accordance with open-source specifications.
