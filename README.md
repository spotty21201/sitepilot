# 🏙️ SitePilot — Intelligent Site Due Diligence & Spatial Decision Room

> **Built for the Google Cloud & All Things Agentic Hackathon**  
> *Transforming weeks of fragmented real estate due diligence, zoning bylaws, and manual CAD modeling into an instant, evidence-grounded 3D spatial decision room.*

---

## 🌟 Executive Summary

SitePilot is an AI-powered site intelligence and spatial design workspace for property developers, urban planners, and investment committees. It ingests complex, conflicting property documentation (title deeds, zoning excerpts, broker brochures, and site surveys), extracts traceable facts and claims using **Google Vertex AI** and **Google GenAI SDK**, and recalculates deterministic 3D massing yields, zoning envelopes, setbacks, and building compliance in real-time.

```mermaid
graph TD
  User([Investment Committee / Urban Architect]) --> UI["Decision Room (3-Column Layout)"]
  
  subgraph Frontend ["Next.js 16 (React 19) Full-Stack App"]
    UI --> LeftCol["Executive Brief & Evidence Ledger"]
    UI --> CenterCol["3D Spatial Model & 2D Cadastral View"]
    UI --> RightCol["Scenario Yields & Compliance Controls"]
    CenterCol --> ThreeJS["Three.js / React Three Fiber Viewport"]
    CenterCol --> PascalHandles["Pascal Direct Transform Handles & HUD"]
  end

  subgraph CloudRun ["Google Cloud Platform (Cloud Run)"]
    API_Extract["/api/evidence/extract (Node.js)"]
    API_Export["/api/export/dae (Node.js)"]
    API_Health["/api/health (Liveness Probe)"]
  end

  subgraph GoogleAI ["Google Vertex AI / Gemini API"]
    VertexAI["Gemini 2.5 Flash<br/>(Structured Schema Output)"]
  end

  UI --> API_Extract
  UI --> API_Export
  API_Extract -->|IAM ADC Auth| VertexAI
```

---

## 🚀 Key Features

1. **3D Spatial Development Workspace:** Live 3D WebGL/WebGPU massing canvas with on-canvas chevron handles (`+X`, `-X`, `+Z`, `-Z`, `+Y`), live measurement pill HUD ($0.5\text{m}$ grid snap), interactive compass widget, and pairwise collision detection.
2. **Restrained Spatial Camera Bar:** Precision orthographic elevations (`SOUTH`, `NORTH`, `EAST`, `WEST`), plan view (`TOP`), and axonometric view (`ISO`, `RESET`) with spatial height ticks (`+0m`, `+9m`, `+30m`, `+32m`).
3. **2D Cadastral Map View:** Non-colliding SVG plan view with normalized indexed badges (`[1] Podium`, `[2] West Wing`, `[3] East Wing`).
4. **Deterministic Zoning & Geometry Engine:** Pure mathematical computation of Gross Floor Area (GFA), Floor Area Ratio (FAR / KLB), Building Coverage (KDB), open green space (KDH), and Subzone R.9 height limits.
5. **Evidence Ledger & Contradiction Detection:** Classifies property documentation into **FACT**, **CLAIM**, **ASSUMPTION**, and **INFERENCE** with line-item traceability.
6. **Multi-Scenario Comparison & Reset:** Immediate switching between Scenario A (4 Fl), Scenario B (8 Fl Preferred), and Scenario C (12 Fl Height Overrun) with explicit state badges (`[BASE CONCEPT]`, `[USER OVERRIDE]`, `[FITTED TO SETBACK]`).
7. **COLLADA DAE Export:** Full 3D geometric scene export ready for import into Blender, SketchUp, Rhino, or Revit.

---

## 🛠️ Technology Stack

* **Frontend:** Next.js 16.3.1 (React 19.2.8, React DOM 19.2.8, Turbopack, Tailwind CSS 4)
* **3D Graphics & Engine:** Three.js `0.185.1`, React Three Fiber `9.7.0`, React Three Drei `10.7.8`, Turf.js `7.4.0`
* **Pascal Framework:** `@pascal-app/core` `0.9.2`, `@pascal-app/viewer` `0.9.2`, `@pascal-app/nodes` `0.1.1`
* **AI & Agent Framework:** Google GenAI SDK (`@google/genai` v2.17.1)
* **AI Model:** Google Vertex AI (`gemini-2.5-flash`)
* **Cloud Infrastructure:** Google Cloud Run, Google Artifact Registry, Google Cloud Build, Google Cloud Logging
* **Testing & Quality:** Vitest `4.1.10`, Testing Library React `16.3.2`, ESLint 9

---

## 💻 Local Quickstart

### Prerequisites
* Node.js `>= 20.14.0` (Node 20 or 22 recommended)
* npm `>= 10.0.0`

### Installation & Execution
```bash
# 1. Clone repository
git clone https://github.com/your-org/sitepilot.git
cd sitepilot

# 2. Install dependencies
npm ci

# 3. Configure environment variables (optional for local mock mode)
cp .env.example .env.local

# 4. Run automated test suite
npm run test # or: npx vitest run

# 5. Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or `http://localhost:3005`) to view the application.

---

## 🧪 Testing & Quality Gates

SitePilot enforces strict quality gates across linting, type-checking, and unit/integration tests:

```bash
# Run unit & integration tests (22 tests across 5 suites)
npx vitest run

# Run full-codebase ESLint
npx eslint src/

# Run Next.js production build
npm run build
```

---

## 🐳 Docker Containerization

SitePilot includes a production-grade multi-stage `Dockerfile` optimized for Cloud Run:

```bash
# Build Docker image
docker build -t sitepilot:local .

# Run container locally on port 8080
docker run -p 8080:8080 sitepilot:local

# Check health endpoint
curl http://localhost:8080/api/health
```

---

## ☁️ Google Cloud Deployment

See the comprehensive [Google Cloud Deployment Guide](docs/GOOGLE_CLOUD_DEPLOYMENT.md) for step-by-step instructions on:
1. Setting up Google Cloud IAM with least-privilege service accounts (`sitepilot-runner`).
2. Creating the Artifact Registry repository (`sitepilot-repo`).
3. Deploying via Cloud Build CI/CD (`cloudbuild.yaml`).
4. Configuring Cloud Run scale-to-zero, timeouts, and Vertex AI IAM authentication.

---

## 🏆 Hackathon Compliance & Disclosures

See [Hackathon Compliance Matrix](docs/HACKATHON_COMPLIANCE.md) for full compliance verification.
* **AI Tool Disclosure:** Antigravity CLI and autonomous agents were used strictly as development and testing assistants.
* **Production Runtime:** The running application executes `@google/genai` against Google Vertex AI and Google Cloud Run.

---

## 📄 License

MIT License. See individual package disclosures for third-party open-source components.
