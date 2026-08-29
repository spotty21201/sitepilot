# SitePilot — Product Requirements Document

> Historical product-direction document. It includes deferred concepts and is not evidence of the implemented hackathon scope. The current demonstrated product is defined by `README.md`, `docs/HACKATHON_COMPLIANCE.md`, and the tested source.
## Intelligent Site Due Diligence, Development Analysis & Early Design Workspace

**Version:** 1.0  
**Product Status:** Product Definition / Pre-Build  
**Primary Orchestration Model:** Gemini 3.7 Flash  
**Primary Platform Direction:** Google Cloud + Gemini + Google ADK  
**Primary User:** Development adviser, architect, planner, developer or investor evaluating potential development sites

---

# 1. Executive Summary

SitePilot is an intelligent development workspace for rapidly understanding, investigating and testing potential real-estate development sites.

A user may begin with little more than:

- a WhatsApp message;
- a Google Maps location;
- a broker brochure;
- a land certificate photograph;
- a rough site boundary;
- a few site photographs;
- an investment idea.

SitePilot progressively turns this fragmented material into a structured development intelligence model containing:

- site information;
- mapped context;
- evidence;
- verified facts;
- claims;
- assumptions;
- unresolved questions;
- planning and physical constraints;
- risks and opportunities;
- development metrics;
- lightweight 3D development scenarios;
- recommended next actions.

The objective is not merely to produce a report.

The objective is to help a professional move from:

> **“Someone sent me a possible site.”**

to:

> **“I understand the opportunity, the risks, approximately what can be developed, what remains uncertain, and what I should do next.”**

SitePilot combines five normally fragmented workflows:

**Evidence + Mapping + Development Analysis + Lightweight 3D + Decision Support**

The product should feel like a professional spatial intelligence and development-design workspace rather than a chatbot, generic dashboard or traditional GIS application.

---

# 2. Product Vision

## 2.1 Vision

> **SitePilot is the intelligent workspace where a development opportunity becomes understandable.**

It should eventually become the place a user opens first when evaluating a new development site.

The product should help professionals reason about sites before significant money is committed to:

- acquisition;
- detailed surveys;
- specialist consultants;
- architectural design;
- planning submissions;
- financial modelling.

SitePilot does not attempt to replace these disciplines.

Instead, it creates the coherent early-stage intelligence layer that connects them.

---

# 3. Product Positioning

SitePilot sits between several existing software categories.

It is:

**not quite GIS;**

**not quite SketchUp;**

**not quite a feasibility spreadsheet;**

**not quite document AI;**

**not quite a real-estate investment dashboard;**

**not quite an architectural design application.**

Its opportunity is the gap between them:

> **the early development decision layer connecting evidence, location, planning, development capacity, design possibilities and investment thinking.**

---

# 4. Primary Job to Be Done

> **Given a site, available property information and a development objective, help me understand the opportunity, identify uncertainty and risk, explore what might be developed, and determine what should happen next.**

SitePilot should significantly reduce the time required to reach a credible initial understanding of a site.

---

# 5. Target Users

## 5.1 Primary User

A senior development professional evaluating land or property opportunities.

Typical roles:

- development adviser;
- architect;
- master planner;
- urban planner;
- developer;
- development manager;
- property consultant.

This user is capable of making professional judgments and should be treated as an expert, not guided through simplified consumer workflows.

---

## 5.2 Secondary Users

- real-estate investors;
- family offices;
- institutional investors;
- land acquisition teams;
- asset managers;
- investment analysts;
- development companies;
- planning consultants;
- multidisciplinary design teams.

---

# 6. Core User Problems

Site information normally arrives fragmented across multiple sources.

A professional may receive:

- contradictory land areas;
- poor-quality certificate scans;
- site plans;
- CAD exports;
- broker claims;
- planning regulations;
- photographs;
- maps;
- spreadsheets;
- messages;
- verbal assumptions;
- partially confirmed utility information.

The user must manually answer questions such as:

- Where exactly is the site?
- What is the real boundary?
- What information can be trusted?
- What contradicts something else?
- What planning rules apply?
- What remains unknown?
- What physically constrains development?
- How much development may fit?
- What assumptions are currently driving the model?
- What could make the site unattractive?
- What should be investigated next?
- Is the current asking price meaningful relative to net developable area?
- What alternative development strategies should be tested?

Existing software addresses individual parts of this process but rarely the whole early-stage decision workflow.

---

# 7. Core Product Questions

SitePilot should continuously answer five questions.

## 7.1 What Do We Know?

Verified site and project information.

---

## 7.2 What Don't We Know?

Missing evidence, assumptions, unresolved issues and contradictory information.

---

## 7.3 Why Does It Matter?

Development, planning, investment, cost or schedule implications.

---

## 7.4 What Could Be Developed?

Preliminary development capacity and scenario possibilities.

---

## 7.5 What Should Happen Next?

Recommended investigation, negotiation, design or specialist actions.

Every major product feature should contribute to one or more of these five questions.

---

# 8. Core Product Principles

## 8.1 Start With Incomplete Information

The user should not need a complete project brief before creating a project.

SitePilot should be useful from the first fragment of information.

---

## 8.2 Organize Before Asking

SitePilot should first interpret what the user has provided.

It should then ask only questions that materially improve the analysis.

Avoid lengthy setup forms.

---

## 8.3 Spatial First

Sites are physical.

The map and spatial canvas should therefore be a primary interface, not a secondary visualization.

---

## 8.4 Evidence Before Opinion

Important conclusions should be traceable to their sources.

---

## 8.5 Separate Fact From Assumption

SitePilot must never silently transform uncertain information into project truth.

---

## 8.6 Professional User Remains in Control

The user can:

- correct the system;
- override assumptions;
- select preferred evidence;
- test speculative scenarios;
- mark issues as resolved;
- change development objectives.

AI recommendations are advisory.

---

## 8.7 Design Exploration and Due Diligence Can Overlap

The user should be able to test an eight-storey development while the allowable height remains uncertain.

SitePilot should simply identify the height as an unverified assumption.

The workflow must not force due diligence to be complete before design exploration begins.

---

## 8.8 Project Intelligence Matures Over Time

A project may evolve for weeks or months.

SitePilot should maintain a living project model rather than produce one-off analyses.

---

# 9. Information Classification

Every important project statement should be classifiable.

## FACT

Supported by reliable evidence.

Example:

> Certificate area: 11,870 m².

---

## CLAIM

Provided by another party but not independently verified.

Example:

> Seller states 8 MVA electrical capacity is available.

---

## ASSUMPTION

Temporary basis used for analysis.

Example:

> Assume 5 m side setbacks pending detailed planning confirmation.

---

## INFERENCE

SitePilot's interpretation of available information.

Example:

> Existing road width may constrain the proposed intensity of development.

---

## RECOMMENDATION

Suggested professional action.

Example:

> Confirm road status before finalizing acquisition assumptions.

---

## USER OVERRIDE

A deliberate professional instruction that supersedes the current automated interpretation for a specific purpose.

Example:

> Use 12 floors for Scenario C even though maximum permitted height has not yet been confirmed.

SitePilot must retain:

- original evidence;
- current working value;
- source of override;
- status of verification.

---

# 10. User Journey Overview

The core workflow consists of six broad activities:

**1. Capture**  
→ **2. Understand**  
→ **3. Investigate**  
→ **4. Explore**  
→ **5. Decide**  
→ **6. Advance**

These activities are not a mandatory wizard.

The user may move between them freely.

---

# 11. User Journey — Stage 1: Capture

## Scenario

A user receives:

> “There is a 1.8 ha site available. Owner wants Rp X. Can you look at it?”

The user may only have:

- a location;
- a message;
- broker brochure;
- certificate image;
- photographs.

---

## 11.1 Create Project

Minimum inputs:

- site/project name;
- address, coordinate or map pin;
- short development objective.

Example:

> Evaluate this site for premium residential or boutique mixed-use development.

Optional:

- asking price;
- land area;
- investor;
- acquisition objective;
- known planning data;
- target development mix;
- notes.

---

## 11.2 Quick Capture

User can:

- paste text;
- paste coordinates;
- upload files;
- drag photographs;
- add links;
- draw approximate boundary;
- type informal notes.

The interface should tolerate messy inputs.

---

## 11.3 Expected System Response

SitePilot organizes the information and presents:

### What I Found

- approximate location;
- known site area;
- apparent development objective;
- uploaded evidence;
- initial site context.

### What Appears Uncertain

- verified boundary;
- zoning;
- road status;
- utilities;
- legal status;
- accurate area.

The user is not forced to resolve these immediately.

---

# 12. User Journey — Stage 2: Understand

The main workspace appears.

SitePilot creates an initial structured interpretation.

---

## 12.1 Initial Site Summary

Example:

**Site Area**  
Approximately 18,200 m²

**Location**  
Menteng, Jakarta

**Development Objective**  
Residential / Boutique Mixed-Use

**Evidence Received**  
7 sources

**Evidence Confidence**  
Low–Medium

**Major Unknowns**  
5

---

## 12.2 User Correction

User can correct:

- project objective;
- land area;
- boundary;
- source priority;
- assumptions;
- classification;
- confidence.

Example:

> The broker brochure says 18,200 m², but use 16,800 m² as our current working area.

The broker figure remains stored as a claim.

---

# 13. User Journey — Stage 3: Investigate

SitePilot progressively investigates available information.

This investigation may run automatically when new evidence is added.

---

## 13.1 Evidence Inventory

For each source store:

- file name;
- type;
- date;
- source;
- page count;
- relevance;
- extraction status;
- confidence.

---

## 13.2 Evidence Extraction

Potential findings include:

- land area;
- title information;
- parcel information;
- road width;
- frontage;
- planning controls;
- permitted use;
- maximum height;
- FAR/KLB;
- site coverage/KDB;
- green/open-space requirements;
- utilities;
- existing structures;
- environmental conditions;
- access.

---

## 13.3 Evidence Ledger

Every important finding should include:

- statement;
- classification;
- source;
- page/location;
- confidence;
- date;
- related issue;
- current working status.

---

## 13.4 Contradiction Detection

Example:

| Evidence | Site Area |
|---|---:|
| Broker Brochure | 18,200 m² |
| Certificate | 16,850 m² |
| Survey | 16,920 m² |

SitePilot creates:

**Critical Issue — Site Area Discrepancy**

with:

- affected assumptions;
- likely impact;
- recommended verification.

---

## 13.5 Fact → Implication

The system should translate raw facts into professional consequences.

Example:

**Finding**

> Existing access approximately 5.5 m wide.

**Potential implication**

> Current access may limit development intensity or require further review of servicing, emergency access and planning requirements.

The user can accept, edit or dismiss the inference.

---

# 14. User Journey — Spatial Investigation

The user will often investigate spatially before reading detailed reports.

The spatial canvas should therefore support:

- map;
- satellite imagery;
- site boundary;
- surrounding context;
- roads;
- access;
- zoning;
- constraints;
- measurements;
- annotations.

---

## 14.1 Core Spatial Layers

Initial simplified categories:

### BASE

- map;
- satellite;
- parcels;
- roads.

### PLANNING

- land use;
- zoning;
- development controls.

### CONSTRAINTS

- setbacks;
- easements;
- water;
- slope;
- no-build areas;
- disputed areas.

### OPPORTUNITIES

- frontage;
- access;
- views;
- commercial edges;
- transit;
- strategic adjacencies.

Avoid conventional GIS complexity unless required.

---

# 15. User Journey — Stage 4: Explore

At any point the user can choose:

**Explore Development**

This switches the spatial canvas into development mode.

---

# 16. Lightweight 3D Development Simulator

The 3D simulator is intended for **development capacity and early massing exploration**.

It is not BIM.

It is not intended to replace SketchUp.

Its purpose is to answer:

> **What may approximately fit here under these assumptions?**

---

## 16.1 Initial Inputs

Potential parameters:

- site boundary;
- buildable boundary;
- setbacks;
- site coverage;
- FAR/KLB;
- maximum height;
- floor-to-floor height;
- number of floors;
- green/open-space requirement;
- access zones;
- no-build zones.

---

## 16.2 Geometry Capabilities

Initial geometry should support:

- site polygon;
- setback polygon;
- buildable envelope;
- simple rectangular/polygonal masses;
- multiple building masses;
- podium;
- tower;
- roads/access;
- open spaces;
- water/no-build areas;
- basic terrain if available.

---

## 16.3 Direct Manipulation

User should be able to:

- draw footprint;
- move footprint;
- resize footprint;
- rotate;
- split mass;
- duplicate;
- delete;
- change height;
- change floor count.

Interaction should remain simple and responsive.

---

## 16.4 Parameter Editing

Example:

**KDB / Coverage**  
55%

**KLB / FAR**  
3.0

**Maximum Height**  
32 m

**Floors**  
8

**Front Setback**  
8 m

Changes should update geometry and metrics immediately where possible.

---

# 17. Development Metrics

Deterministic geometry logic should calculate:

- gross site area;
- buildable site area;
- building footprint;
- total GFA;
- FAR/KLB;
- coverage/KDB;
- open space;
- percentage of site affected by constraints;
- floor count;
- height;
- parking assumption;
- selected program areas where available.

AI should interpret these results.

The language model should not be responsible for basic arithmetic.

---

# 18. Scenario Workflow

The user can save multiple alternatives.

Example:

### Scenario A
Low-rise premium residential

### Scenario B
Mid-rise residential

### Scenario C
Mixed-use frontage + residential rear

Each scenario retains:

- assumptions;
- geometry;
- planning basis;
- area metrics;
- notes;
- risks;
- opportunities.

---

## 18.1 Scenario Comparison

Compare:

- footprint;
- GFA;
- FAR;
- site coverage;
- height;
- open space;
- program;
- parking;
- planning risk;
- infrastructure risk;
- key assumptions.

SitePilot may summarize:

> Scenario B provides approximately 18% more GFA than Scenario A but relies on an unverified height assumption.

---

# 19. Due Diligence and Scenarios Must Remain Linked

This is a critical workflow.

Example:

### Day 1

Scenario A assumes:

**Maximum height = 12 floors**

Classification:

**ASSUMPTION**

### Day 5

User uploads official planning information.

SitePilot identifies:

**Maximum height = 8 floors**

The system should:

1. update planning evidence;
2. identify affected assumptions;
3. flag affected scenarios;
4. show which geometry exceeds the confirmed constraint;
5. request review rather than silently destroying the scenario.

Example:

> **Scenario A and Scenario C are affected by newly verified height information.**

The user chooses how to respond.

---

# 20. User Journey — Stage 5: Decide

SitePilot helps the user form a clear development position.

---

## 20.1 Decision Summary

Possible recommendation labels:

- PROCEED;
- CONDITIONAL PROCEED;
- INVESTIGATE;
- HOLD;
- DO NOT PROCEED.

These are advisory.

The professional user can edit them.

---

## 20.2 Site Readiness

Example:

**Site Readiness — 68%**

This represents how much critical project information has been sufficiently resolved.

It is not a probability of project success.

---

## 20.3 Evidence Confidence

Displayed separately.

Example:

**Evidence Confidence — Medium**

---

## 20.4 Executive View

A senior investor should quickly see:

### Opportunity

3–5 strongest positive findings.

### Concerns

3–5 material risks.

### Critical Unknowns

Important unresolved issues.

### Development Potential

Preferred scenario(s).

### Recommended Next Move

What the team should do next.

---

# 21. Investigation Queue

SitePilot maintains a prioritized next-action list.

Example:

### Critical

1. Verify certificate area.
2. Confirm planning controls.
3. Confirm legal road access.

### Important

4. Obtain utility confirmation.
5. Request topographic survey.

### Later

6. Commission detailed market study.

Each item should include:

- why it matters;
- source of concern;
- likely impact;
- affected scenario;
- status;
- owner where relevant.

---

# 22. User Journey — Stage 6: Advance

Once the site deserves continued work, SitePilot supports transition into the next development stage.

This may include:

- client/investor discussion;
- site visit;
- specialist consultant appointment;
- survey commission;
- negotiation;
- SketchUp design;
- financial feasibility;
- master planning.

SitePilot remains the project intelligence layer.

---

# 23. Site Visit Workflow

A later mobile-responsive workflow should allow the user to collect site observations.

Potential actions:

- take photograph;
- record voice/text note;
- place observation on map;
- identify access;
- mark neighbouring building;
- record road width;
- mark utilities;
- mark potential secondary access;
- flag issue.

Example:

> Main northern access approximately 7 m. Significant traffic during afternoon peak.

Site observations become evidence and can influence project analysis.

---

# 24. SketchUp Workflow

SitePilot should complement SketchUp.

Preferred workflow:

**SitePilot**
→ understand site  
→ establish constraints  
→ test development massing  
→ select scenario  
→ export  
→ continue architectural development in SketchUp

---

## 24.1 Initial Export Requirement

Support a geometry format that imports reliably into SketchUp.

The initial implementation may use:

- COLLADA `.dae`;
- another reliable SketchUp-compatible geometry format.

Direct `.skp` generation can be explored later.

---

## 24.2 Export Requirements

Preserve where practical:

- correct scale;
- site coordinate relationship;
- site boundary;
- buildable boundary;
- building masses;
- access;
- open spaces;
- constraint areas.

Logical object groups should remain distinct.

Example:

- `SITE_BOUNDARY`
- `BUILDABLE_AREA`
- `SETBACK`
- `BUILDING_MASS_A`
- `BUILDING_MASS_B`
- `ACCESS`
- `OPEN_SPACE`
- `CONSTRAINT_WATER`

---

# 25. Decision Room — Core Interface

The principal interface should be an aesthetically refined professional workspace.

The aspiration is:

> **premium spatial design software + investment intelligence + evidence workspace**

not:

> **enterprise dashboard + chatbot**

---

# 26. Main Workspace Composition

## 26.1 Spatial Canvas

Primary visual area.

Modes:

- 2D map;
- satellite;
- constraints;
- planning;
- 3D development view.

---

## 26.2 Project Intelligence Panel

Contains:

- current recommendation;
- site readiness;
- evidence confidence;
- opportunities;
- critical risks;
- unresolved assumptions.

---

## 26.3 Evidence Panel

Contains:

- sources;
- extracted findings;
- supporting citations;
- contradictions;
- missing evidence.

---

## 26.4 Development Panel

Contains:

- current scenario;
- parameters;
- development metrics;
- scenario controls.

---

## 26.5 Activity / Investigation Panel

Shows:

- what SitePilot is currently processing;
- recently added evidence;
- issues created;
- assumptions changed;
- scenarios affected.

---

## 26.6 Contextual Assistant

Available without dominating the interface.

Example questions:

> Why is road access classified as high risk?

> Show all unverified assumptions.

> Which evidence supports the 16,850 m² land area?

> Compare Scenarios A and B.

> What changes if the acquisition price drops 10%?

> What should I investigate before my meeting tomorrow?

---

# 27. UI/UX Principles

## 27.1 Aesthetically Excellent

UI quality is a product requirement.

SitePilot should be credible when displayed in front of:

- investor;
- client;
- developer;
- planning official;
- design team.

---

## 27.2 Calm and Sophisticated

Avoid:

- excessive cards;
- gradient-heavy AI styling;
- colourful status overload;
- playful iconography;
- dashboard clutter.

---

## 27.3 Spatial Dominance

The map/model should receive significant screen area.

---

## 27.4 Progressive Disclosure

Show:

1. what matters;
2. why it matters;
3. evidence detail only when requested.

---

## 27.5 Limited Status Colour

Colour should primarily convey:

- critical issue;
- warning;
- verified;
- assumption;
- selection.

---

## 27.6 Typography

Use professional editorial typography.

Data-heavy tables should remain highly readable.

---

## 27.7 Smooth Transitions

Switching between:

- map;
- planning;
- evidence;
- scenario;
- 3D;

should feel coherent rather than like opening separate applications.

---

# 28. AI Behaviour

SitePilot should automatically perform appropriate tasks such as:

- classify new evidence;
- extract structured findings;
- connect findings to sources;
- identify missing information;
- detect contradictions;
- assess confidence;
- identify affected assumptions;
- interpret development implications;
- generate investigation actions;
- compare scenarios;
- synthesize executive findings.

---

# 29. AI Must Not

AI should not:

- silently convert claims into facts;
- invent legal certainty;
- invent planning controls;
- perform critical arithmetic without deterministic verification;
- modify user scenarios without notification;
- obscure source provenance;
- represent preliminary massing as architectural design;
- claim regulatory approval.

---

# 30. Runtime Intelligence Architecture

The product may use a compact set of logical agent roles.

These are runtime functions, not necessarily visible as characters to the user.

---

## 30.1 Investigation Orchestrator

Responsibilities:

- understand project objective;
- determine what work is required;
- route tasks;
- monitor project state;
- react to new evidence;
- coordinate follow-up investigations.

---

## 30.2 Evidence Intelligence

Responsibilities:

- multimodal document analysis;
- extraction;
- classification;
- source citation;
- evidence ledger.

---

## 30.3 Spatial & Development Intelligence

Responsibilities:

- interpret planning/site evidence;
- derive development implications;
- connect spatial conditions to scenarios.

---

## 30.4 Verification / Critic

Responsibilities:

- detect contradictions;
- challenge unsupported conclusions;
- identify evidence gaps;
- validate confidence.

---

## 30.5 Decision Intelligence

Responsibilities:

- summarize project state;
- identify key risks/opportunities;
- prioritize next actions;
- support decision view.

---

# 31. Google AI & Agent Architecture

## 31.1 Primary Model

**Gemini 3.7 Flash**

Primary orchestration and product intelligence model.

Use cases:

- routing;
- multimodal understanding;
- extraction;
- reasoning;
- summarization;
- structured outputs;
- contextual user interaction.

Additional Gemini models may be used when a task requires deeper reasoning or specialized multimodal performance.

---

## 31.2 Agent Framework

**Google Agent Development Kit — ADK**

Preferred primary orchestration framework.

Use for:

- tool-enabled agents;
- investigation workflows;
- delegation;
- stateful execution;
- parallel tasks;
- workflow control;
- retry logic.

Architecture should remain modular enough to replace individual AI components if required.

---

## 31.3 Google GenAI SDK

May be used for direct Gemini model operations where a full agent abstraction is unnecessary.

Suitable uses include:

- structured document extraction;
- image understanding;
- direct multimodal calls.

Avoid duplicating functionality unnecessarily between frameworks.

---

## 31.4 Genkit / Antigravity

Not mandatory to the runtime architecture.

They may be introduced where they provide a clear product or engineering advantage.

Do not add technologies solely to increase stack complexity.

---

# 32. Google Cloud Infrastructure

Preferred infrastructure:

## 32.1 Cloud Run

Primary application/backend runtime.

Host:

- API;
- agent orchestration service;
- geometry services;
- asynchronous processing endpoints.

Use serverless scaling where practical.

---

## 32.2 Firestore

Primary structured project-state datastore.

Potential collections:

- users;
- projects;
- sites;
- sources;
- evidence;
- findings;
- assumptions;
- risks;
- actions;
- scenarios;
- geometry references;
- agent tasks.

---

## 32.3 Pub/Sub

Event backbone for asynchronous workflows.

Example events:

- `project.created`
- `source.uploaded`
- `source.processed`
- `finding.created`
- `contradiction.detected`
- `assumption.changed`
- `scenario.created`
- `planning.constraint.updated`
- `scenario.affected`
- `decision.updated`

This allows SitePilot to react to project changes without requiring the user to manually restart analysis.

---

## 32.4 Cloud Storage

Store:

- PDFs;
- images;
- drone photographs;
- survey drawings;
- spatial files;
- exported model files;
- generated reports.

Structured findings should remain separate from raw files.

---

## 32.5 Vertex AI

Preferred managed access to Gemini where appropriate.

Use for:

- enterprise-grade Gemini access;
- observability;
- controlled model integration.

---

## 32.6 Supporting Services

Potential:

- Secret Manager;
- Cloud Logging;
- Cloud Monitoring;
- Cloud Tasks if required;
- Cloud Scheduler if future monitoring features require periodic checks.

---

# 33. Simplified System Architecture

```text
USER
  │
  ▼
SITEPILOT WEB APPLICATION
  │
  ├─────────────── Spatial / 3D Workspace
  │
  ▼
CLOUD RUN API
  │
  ├────────────► FIRESTORE
  │                Project State
  │
  ├────────────► CLOUD STORAGE
  │                Evidence / Files / Exports
  │
  └────────────► PUB/SUB
                   Event Pipeline
                       │
                       ▼
                GOOGLE ADK
             Investigation Orchestrator
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
      Evidence      Spatial /      Verification
    Intelligence   Development        Critic
                     Analysis
          └────────────┼─────────────┘
                       ▼
                GEMINI 3.7 FLASH
                  / VERTEX AI
                       │
                       ▼
               Decision Intelligence
                       │
                       ▼
                   FIRESTORE
                       │
                       ▼
                 DECISION ROOM
```

---

# 34. Spatial & Geometry Architecture

Geometry calculations should remain deterministic.

Potential web technology direction:

- React / Next.js;
- MapLibre or equivalent;
- Three.js / React Three Fiber;
- Turf.js or similar geometry tools;
- server-side geometry service where necessary.

Functions include:

- polygon area;
- polygon buffering/setbacks;
- intersections;
- buildable area;
- extrusion;
- geometry grouping;
- area summaries;
- SketchUp-compatible export preparation.

The AI interprets geometry.

The geometry engine calculates it.

---

# 35. Project Data Model — Conceptual

## PROJECT

- id;
- name;
- objective;
- location;
- status;
- recommendation;
- readiness;
- confidence.

---

## SITE

- boundary;
- area;
- coordinate system;
- frontage;
- access;
- context.

---

## SOURCE

- source type;
- file;
- origin;
- date;
- status.

---

## FINDING

- statement;
- category;
- classification;
- confidence;
- source reference.

---

## ASSUMPTION

- parameter;
- value;
- source;
- verification status;
- affected scenarios.

---

## ISSUE

- category;
- severity;
- evidence;
- implication;
- status;
- recommended action.

---

## SCENARIO

- name;
- objective;
- geometry;
- assumptions;
- metrics;
- status.

---

## ACTION

- description;
- priority;
- reason;
- affected issue;
- owner;
- status.

---

# 36. Core Product Requirements

## PR-01 — Fast Project Creation

A user must be able to create a project with incomplete information.

---

## PR-02 — Evidence Upload

User must be able to add documents, photographs and structured files.

---

## PR-03 — Automatic Evidence Interpretation

SitePilot should automatically classify and extract useful information.

---

## PR-04 — Evidence Traceability

Important findings must link back to source evidence.

---

## PR-05 — User Correction

User must be able to correct or override AI interpretation.

---

## PR-06 — Contradiction Detection

System should detect conflicting information across sources.

---

## PR-07 — Spatial Workspace

User must be able to view and edit site location/boundary.

---

## PR-08 — Constraint Representation

SitePilot should support mapped development constraints.

---

## PR-09 — Lightweight 3D

User must be able to test basic development massing.

---

## PR-10 — Live Metrics

Geometry changes should update development metrics.

---

## PR-11 — Scenario Saving

User must be able to create and retain multiple scenarios.

---

## PR-12 — Scenario Comparison

User should be able to compare key scenario metrics and assumptions.

---

## PR-13 — Assumption Awareness

Every scenario must retain its assumptions and verification status.

---

## PR-14 — Scenario Impact Detection

When evidence changes, SitePilot should identify affected scenarios.

---

## PR-15 — Risk & Opportunity Register

System must maintain structured project issues.

---

## PR-16 — Investigation Queue

System should recommend next actions.

---

## PR-17 — Executive Decision View

A project should produce a concise professional decision summary.

---

## PR-18 — SketchUp-Compatible Export

User should be able to export selected site/massing geometry for continued architectural work.

---

# 37. Acceptance Criteria

## AC-01 Project Creation

Given only a project name, location and development objective, SitePilot creates a functioning workspace.

---

## AC-02 Incomplete Data

The system remains usable even when important project information is missing.

---

## AC-03 Evidence Source

A user can inspect where an important finding originated.

---

## AC-04 Contradiction

When two sources contain materially conflicting values, SitePilot exposes the conflict.

---

## AC-05 User Override

The user can replace the working value without deleting the original evidence.

---

## AC-06 Map

The user can view, create or edit the approximate site boundary.

---

## AC-07 Development Envelope

SitePilot can calculate a basic buildable envelope from site + setback assumptions.

---

## AC-08 3D Massing

A user can generate and manipulate at least one simple building mass.

---

## AC-09 Live Metrics

Changing massing geometry updates footprint and approximate GFA.

---

## AC-10 Multiple Scenarios

At least two alternative development scenarios can be saved and compared.

---

## AC-11 Evidence Impact

New evidence can invalidate or challenge an assumption used by a scenario.

---

## AC-12 Affected Scenario

The system identifies which scenarios are affected by changed assumptions.

---

## AC-13 Decision Summary

A project displays:

- opportunity;
- concern;
- unknowns;
- development potential;
- recommended actions.

---

## AC-14 SketchUp Workflow

Selected development geometry can be exported at correct scale in a SketchUp-compatible format.

---

# 38. Error and Edge Cases

The product must anticipate:

## Missing Boundary

Allow approximate user-drawn site.

---

## Low-Quality Document

Mark extraction confidence and request user verification.

---

## Conflicting Evidence

Do not automatically choose without indicating the conflict.

---

## Unsupported Format

Preserve file and explain what conversion is required.

---

## Missing Planning Data

Allow user-defined assumption.

---

## Incorrect AI Extraction

User correction must be easy and auditable.

---

## Scenario Exceeds Constraint

Warn and highlight rather than automatically modifying geometry.

---

## AI Service Failure

Preserve project state and retry safely.

---

## Processing Delay

Show clear status rather than blocking workspace.

---

# 39. Product Scope

The scope should remain flexible.

Use three categories rather than permanent “out of scope” declarations.

---

## 39.1 Core Product

Current priority:

- project creation;
- evidence ingestion;
- evidence intelligence;
- map workspace;
- site boundary;
- constraints;
- assumptions;
- risk/opportunity register;
- investigation queue;
- development metrics;
- lightweight 3D;
- scenario comparison;
- SketchUp-compatible export;
- contextual AI;
- executive decision view.

---

## 39.2 Progressive Capabilities

Potential:

- automated zoning retrieval;
- Indonesian RDTR integrations;
- parcel data;
- market comparables;
- land-value analysis;
- acquisition modelling;
- financial feasibility;
- terrain;
- solar;
- viewshed;
- environmental constraints;
- transportation;
- infrastructure;
- utilities;
- automated site-visit workflows;
- scenario optimization;
- AI-assisted master planning;
- presentation/report generation.

---

## 39.3 Specialist Integrations

Prefer integration over rebuilding mature professional tools.

Potential integrations:

- SketchUp;
- Google Earth;
- GIS;
- spreadsheets;
- Google Drive;
- document repositories;
- financial modelling tools;
- presentation tools.

---

# 40. Product Success Measures

## User Efficiency

Reduce time from receiving a site to forming a credible initial development position.

---

## Evidence Quality

Increase traceability of decisions to source material.

---

## Decision Quality

Help users identify material issues earlier.

---

## Scenario Speed

Allow users to test development possibilities rapidly.

---

## Project Continuity

Maintain coherent project intelligence as new information arrives.

---

## Professional Adoption

Target outcome:

> **“SitePilot is where I start every new site.”**

---

# 41. Experience Benchmark

The product should feel credible in three situations.

## Working Alone

Fast and efficient enough for everyday professional work.

---

## Working With a Team

Spatial and analytical enough to facilitate design and development discussion.

---

## Presenting to an Investor

Visually polished enough that opening SitePilot in the meeting enhances professional credibility.

---

# 42. Signature Product Experience

A project starts as:

> **a pin, a short brief and a collection of messy files.**

It progressively becomes:

> **an organized spatial development intelligence model containing evidence, uncertainty, opportunities, constraints, development scenarios and recommended actions.**

That transformation is the core SitePilot experience.

---

# 43. Handoff to Build Orchestrator

The implementation Orchestrator should treat this PRD as the product-level source of truth.

The next stage should decompose the product into:

1. UX architecture;
2. technical architecture;
3. implementation epics;
4. user stories;
5. acceptance tests;
6. sequenced build tasks.

The Orchestrator should actively protect against unnecessary complexity.

It should prioritize a coherent working product over broad feature coverage.

---

# 44. Designer Responsibilities

The Designer should translate this PRD into a visually sophisticated, high-utility interface.

Primary design areas:

- first-run project creation;
- Decision Room;
- spatial canvas;
- evidence navigation;
- status/confidence language;
- issue hierarchy;
- 2D/3D mode transition;
- development parameter controls;
- scenario comparison;
- investigation queue;
- contextual assistant;
- responsive site-visit experience.

Key design objective:

> **A senior professional should understand the status of a site within approximately 30 seconds without the interface feeling simplistic.**

Visual quality is a first-class requirement.

---

# 45. Coder Responsibilities

The Coder should implement the product as modular subsystems.

Primary technical domains:

- web application shell;
- authentication/project persistence;
- map engine;
- geometry engine;
- 3D massing;
- evidence ingestion;
- Google Cloud Storage;
- Firestore;
- Pub/Sub event architecture;
- Cloud Run backend;
- Gemini integration;
- ADK orchestration;
- structured AI outputs;
- scenario system;
- SketchUp-compatible export;
- observability;
- error recovery.

The Coder should avoid allowing AI logic to replace deterministic calculations.

---

# 46. Tester Responsibilities

Testing must cover more than UI correctness.

Primary domains:

## Evidence Testing

- extraction accuracy;
- incorrect extraction;
- source traceability;
- duplicate evidence;
- contradiction detection.

## Geometry Testing

- site area;
- setbacks;
- buildable polygons;
- footprint;
- GFA;
- height;
- scale;
- export integrity.

## Scenario Testing

- save/load;
- independent assumptions;
- comparison;
- affected-scenario detection.

## Workflow Testing

- asynchronous processing;
- Pub/Sub events;
- agent failures;
- retries;
- incomplete data;
- user overrides.

## UX Testing

- first-run clarity;
- navigation;
- information hierarchy;
- responsiveness;
- map interaction;
- 3D interaction.

A controlled **golden project dataset** should be created early with known source information and expected results.

---

# 47. Suggested Build Priorities

## Priority 1 — Project + Spatial Foundation

- project creation;
- map;
- site boundary;
- project persistence.

---

## Priority 2 — Evidence Intelligence

- upload;
- extraction;
- structured evidence;
- traceability.

---

## Priority 3 — Project Intelligence

- facts;
- claims;
- assumptions;
- contradictions;
- risks;
- actions.

---

## Priority 4 — Development Geometry

- setbacks;
- buildable envelope;
- metrics;
- simple 3D.

---

## Priority 5 — Scenarios

- save;
- duplicate;
- modify;
- compare.

---

## Priority 6 — Evidence ↔ Scenario Relationship

- changed assumption;
- affected scenario;
- warnings.

---

## Priority 7 — Decision Room Refinement

- executive presentation;
- visual hierarchy;
- professional polish.

---

## Priority 8 — SketchUp Export

- selected scenario;
- grouped geometry;
- correct scale.

---

# 48. Final Product Definition

> **SitePilot is an intelligent development workspace that transforms fragmented property evidence into spatial understanding, development scenarios and actionable investment decisions.**

Its defining strength is not any single technology.

It is the ability to connect:

**what the evidence says,**

**what the site allows,**

**what may be developed,**

**what remains uncertain,**

and

**what the professional should do next.**
