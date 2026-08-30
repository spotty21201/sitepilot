import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  Check,
  CircleCheckBig,
  Download,
  FileDown,
  FileSearch,
  Landmark,
  Layers3,
  Leaf,
  Map,
  PencilRuler,
  Ruler,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import styles from './guide.module.css';

export const metadata: Metadata = {
  title: 'Illustrated Use Guide | SitePilot',
  description:
    'A human urban designer workflow for moving from opportunity intake to a decision-ready SitePilot spatial study.',
};

const workflow = [
  ['01', 'Frame', 'Name the opportunity and the decision the study must support.'],
  ['02', 'Input', 'Record parcel, asset, planning, and commercial facts.'],
  ['03', 'Verify', 'Separate confirmed evidence from supplied and calculated inputs.'],
  ['04', 'Compare', 'Read every option through the same planning and spatial measures.'],
  ['05', 'Shape', 'Use 2D for discipline and 3D for massing and character.'],
  ['06', 'Export', 'Issue a decision package with unresolved checks attached.'],
] as const;

const chapters = [
  ['prepare', 'Prepare'],
  ['intake', 'Intake'],
  ['asset', 'Existing asset'],
  ['planning', 'Planning'],
  ['commercial', 'Commercial'],
  ['evidence', 'Evidence'],
  ['spatial', 'Spatial'],
  ['compare', 'Compare'],
  ['export', 'Export'],
] as const;

const guideSteps = [
  {
    id: 'intake',
    number: '01',
    eyebrow: 'Frame the opportunity',
    title: 'Start with the decision, not the yield.',
    intro:
      'Enter only facts you can explain and defend. Give the study a precise name, make its synthetic status explicit when needed, and describe the spatial question it must answer.',
    image: '/guide/new-opportunity.webp',
    alt: 'SitePilot New Opportunity form with project, parcel, and development-intent inputs',
    actions: [
      ['Name the study', "Use a specific title. Add 'Synthetic Study' when the parcel or controls are illustrative."],
      ['Define the parcel', 'Enter address, city, country, site area, frontage, and depth. Use the street override when the frontage edge is ambiguous.'],
      ['Write the intent', 'Describe a spatial objective such as public realm, active frontage, retention, access, phasing, or development envelope.'],
      ['Read the provisional panel', 'Check the working area, permissible GFA, expansion headroom, and input-basis warning before moving on.'],
    ],
    rule: 'State what success looks like in place-making terms, then add the measurable planning and investment question.',
  },
  {
    id: 'asset',
    number: '02',
    eyebrow: 'Existing-asset baseline',
    title: 'Protect what is already there.',
    intro:
      'Brownfield work begins with the physical and operational baseline. The existing asset should remain intact in Scenario A unless replacement is explicitly part of the brief.',
    image: '/guide/existing-asset.webp',
    alt: 'SitePilot Existing Asset section for existing GFA, storeys, description, and operational status',
    actions: [
      ['Record existing GFA', 'Use measured or documented floor area. Do not infer it from footprint alone.'],
      ['Record floors and use', 'Describe the asset and its operational status. Leave unknown fields blank rather than inventing precision.'],
      ['Define the baseline', 'Make retention, demolition, replacement, and phasing assumptions explicit.'],
      ['Read expansion headroom', 'Reconcile the displayed headroom with retained GFA and operational continuity.'],
    ],
    rule: 'Before comparing yield, ask what must remain open, what may be replaced, and what cannot be disturbed.',
  },
  {
    id: 'planning',
    number: '03',
    eyebrow: 'Planning envelope',
    title: 'Build the envelope from traceable controls.',
    intro:
      'A supplied limit is not automatically a confirmed statutory limit. Record the source status of every planning control and preserve unknowns as unknowns.',
    image: '/guide/planning-limits.webp',
    alt: 'SitePilot Planning Limits section showing zoning, FAR, KDB, KDH, height, and setbacks',
    actions: [
      ['Identify the control', 'Enter zoning code and subzone exactly as they appear in the source.'],
      ['Enter the core limits', 'Keep FAR/KLB, KDB, KDH, height, and their units distinct. Leave an unknown height blank.'],
      ['Demonstrate KDH', 'Enter landscaped or permeable area only when measured. Unbuilt area is not a substitute.'],
      ['Set every setback', 'Front, rear, and side setbacks define the buildable envelope used by plans, checks, and exports.'],
    ],
    rule: 'Call a control confirmed only when the authority, document, parcel, date, and interpretation are traceable.',
  },
  {
    id: 'commercial',
    number: '04',
    eyebrow: 'Commercial context',
    title: 'Add the deal context without letting it drive the design silently.',
    intro:
      'Price and benchmarks inform comparison, but they do not turn a spatial study into a valuation opinion. Keep the assumptions and dates visible.',
    image: '/guide/commercials-review.webp',
    alt: 'SitePilot Commercials section with asking price, currency, tax benchmark, valuation notes, and review button',
    actions: [
      ['Enter price and currency', 'Use the stated asking price. Keep taxes, transaction costs, and adjustments separate.'],
      ['Add a benchmark', 'Record the benchmark year, basis, and reliability in the valuation notes.'],
      ['Read derived figures', 'Check land-price and GFA-basis calculations for scale and unit errors.'],
      ['Pause at review', 'Use Review Opportunity & 3 Schemes to confirm every input and how model-generated versus template proposals are labelled.'],
    ],
    rule: 'A lower land-cost-per-GFA figure is not automatically a better urban outcome or a feasible investment.',
  },
  {
    id: 'evidence',
    number: '05',
    eyebrow: 'Sources and assumptions',
    title: 'Trace the chain of custody before trusting the number.',
    intro:
      'The evidence panel should explain where each working value came from, how it was derived, and which plans, metrics, scenarios, and exports depend on it.',
    image: '/guide/sources-assumptions.webp',
    alt: 'SitePilot Sources and Assumptions panel beside the 3D model and scenario controls',
    actions: [
      ['Choose the working basis', 'Confirm which site area and geometry basis drives the study.'],
      ['Filter by evidence type', 'Review confirmed, provided, calculated, and assumed items separately.'],
      ['Trace every dependency', 'Check source, date, reliability, calculation, and downstream use.'],
      ['Carry uncertainty forward', 'Keep unresolved items visible in readiness, comparison, the brief, and exports.'],
    ],
    rule: 'For any number that changes a decision, ask who supplied it, what proves it, and which outputs depend on it.',
  },
] as const;

const finalChecks = [
  ['Decision', 'The brief states what decision is being made and for whom.'],
  ['Parcel', 'Area, frontage, depth, street edge, and geometry basis are explicit.'],
  ['Existing asset', 'Retention, demolition, phasing, and continuity are reconciled.'],
  ['Controls', 'FAR/KLB, KDB, KDH, height, and setbacks have traceable status.'],
  ['KDH', 'Landscaped or permeable area is measured; unbuilt area is separate.'],
  ['Scenarios', 'A, B, and C differ in a meaningful strategy, not density alone.'],
  ['Geometry', '2D and 3D use the same active scenario and show no hidden overlap.'],
  ['Metrics', 'GFA, FAR, coverage, height, floors, and setbacks update together.'],
  ['Evidence', 'Confirmed, provided, calculated, and assumed items stay distinct.'],
  ['Exports', 'Downloaded brief, PDF, CSV, and DAE match the visible active study.'],
] as const;

export default function SitePilotGuidePage() {
  return (
    <main className={styles.page}>
      <header className={styles.siteHeader}>
        <Link href="/" className={styles.brand} aria-label="Return to the SitePilot Decision Room">
          <span className={styles.brandMark}>SP</span>
          <span>
            <strong>SitePilot</strong>
            <small>Illustrated field guide</small>
          </span>
        </Link>
        <div className={styles.headerActions}>
          <a href="/guide/sitepilot-illustrative-use-guide.pdf" className={styles.pdfLink} download>
            <Download aria-hidden="true" />
            <span>PDF guide</span>
          </a>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" />
            Decision Room
          </Link>
        </div>
      </header>

      <nav className={styles.chapterNav} aria-label="Guide chapters">
        <div>
          {chapters.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Urban designer workflow / 01</p>
          <h1>From opportunity intake to a decision-ready spatial study.</h1>
          <p className={styles.lede}>
            Use SitePilot to structure a study, compare options, and expose uncertainty.
            Treat the geometry and metrics as a working decision model, not as a survey,
            planning approval, or investment recommendation.
          </p>
          <div className={styles.heroActions}>
            <a href="#prepare" className={styles.primaryAction}>
              Start the guide
              <ArrowRight aria-hidden="true" />
            </a>
            <span className={styles.captureNote}>
              <ShieldCheck aria-hidden="true" />
              Live interface walkthrough · 30 Aug 2026
            </span>
          </div>
        </div>
        <aside className={styles.principleCard}>
          <Map aria-hidden="true" />
          <p>Urban designer&apos;s working principle</p>
          <strong>Make the evidence, spatial consequence, and unresolved question visible at the same time.</strong>
        </aside>
      </section>

      <section id="prepare" className={styles.prepareSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Before opening the app</p>
          <h2>Prepare three things.</h2>
          <p>A clean SitePilot result begins with disciplined inputs and an explicit decision question.</p>
        </div>
        <div className={styles.prepareGrid}>
          <article><BookOpenCheck aria-hidden="true" /><span>01</span><h3>A decision question</h3><p>What choice must the study support, and what place-making outcome would make it successful?</p></article>
          <article><Ruler aria-hidden="true" /><span>02</span><h3>A parcel basis</h3><p>Bring site area, frontage, depth or survey geometry, street edge, and access constraints.</p></article>
          <article><FileSearch aria-hidden="true" /><span>03</span><h3>A verification trail</h3><p>Separate confirmed evidence, supplied facts, calculated values, and design assumptions.</p></article>
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>The complete journey</p>
          <h2>Six moves. One auditable study.</h2>
        </div>
        <ol className={styles.workflowGrid}>
          {workflow.map(([number, label, description]) => (
            <li key={number}><span>{number}</span><div><h3>{label}</h3><p>{description}</p></div></li>
          ))}
        </ol>
      </section>

      <section className={styles.workspaceSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Workspace map / 02</p>
          <h2>Know where each decision lives.</h2>
          <p>Read the Decision Room from left to right: evidence and decision status, spatial consequence, then scenario controls and measurable outputs.</p>
        </div>
        <figure className={styles.workspaceFigure}>
          <Image src="/guide/decision-room-overview.webp" alt="SitePilot Decision Room showing the executive brief, 3D spatial model, and scenario controls" width={1224} height={704} priority sizes="(max-width: 900px) 100vw, 1200px" />
          <figcaption>
            <span><b>1</b> Decision brief and evidence</span>
            <span><b>2</b> 2D and 3D spatial console</span>
            <span><b>3</b> Scenarios, parameters, metrics, and exports</span>
          </figcaption>
        </figure>
      </section>

      <div className={styles.steps}>
        {guideSteps.map((step, stepIndex) => (
          <section id={step.id} key={step.id} className={styles.stepSection}>
            <div className={styles.stepIntro}>
              <span className={styles.stepNumber}>{step.number}</span>
              <div><p className={styles.eyebrow}>{step.eyebrow}</p><h2>{step.title}</h2><p>{step.intro}</p></div>
            </div>
            <div className={`${styles.stepLayout} ${stepIndex % 2 ? styles.stepLayoutReverse : ''}`}>
              <figure className={styles.stepFigure}>
                <Image src={step.image} alt={step.alt} width={1224} height={704} sizes="(max-width: 900px) 100vw, 62vw" />
              </figure>
              <ol className={styles.actionList}>
                {step.actions.map(([label, description], index) => (
                  <li key={label}><span>{index + 1}</span><div><h3>{label}</h3><p>{description}</p></div></li>
                ))}
              </ol>
            </div>
            <aside className={styles.stepRule}>
              <CircleCheckBig aria-hidden="true" />
              <div><p>Urban designer check</p><strong>{step.rule}</strong></div>
            </aside>
          </section>
        ))}
      </div>

      <section id="spatial" className={styles.spatialSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Step 06 / Spatial reading</p>
          <h2>Use plan for discipline. Use 3D for consequence.</h2>
          <p>Start in 2D to verify the parcel, frontage, buildable envelope, setbacks, access, and relationships between masses. Then use 3D to test scale, fit, and spatial character.</p>
        </div>
        <div className={styles.spatialGrid}>
          <figure className={styles.spatialFigure}>
            <Image src="/guide/two-dimensional-plan.webp" alt="SitePilot 2D plan showing frontage, setbacks, parcel dimensions, and three labelled building masses" width={1223} height={704} sizes="(max-width: 900px) 100vw, 62vw" />
          </figure>
          <div className={styles.readOrder}>
            <PencilRuler aria-hidden="true" /><p>Read in this order</p>
            <ol>
              <li><span>01</span>Status and study basis</li>
              <li><span>02</span>Parcel, street, and setbacks</li>
              <li><span>03</span>Mass labels, dimensions, and area legend</li>
              <li><span>04</span>Scenario parameters and containment</li>
            </ol>
          </div>
        </div>
        <div className={styles.editLoop}>
          <Layers3 aria-hidden="true" />
          <div><p>Safe edit loop</p><h3>Select a mass → Move, Resize, or Floors → work with snap and exact values → Fit parcel or proposal → turn on planning checks → verify every metric.</h3></div>
        </div>
      </section>

      <section id="compare" className={styles.compareSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Step 07 / Scenario comparison</p>
          <h2>Compare every option on one consistent basis.</h2>
          <p>Select a scheme only after reading the same planning, spatial, and commercial measures across A, B, and C.</p>
        </div>
        <figure className={styles.compareFigure}>
          <Image src="/guide/scenario-comparison.webp" alt="SitePilot comparison matrix for three development scenarios" width={1223} height={704} sizes="(max-width: 900px) 100vw, 1200px" />
        </figure>
        <div className={styles.questionGrid}>
          <article><Scale aria-hidden="true" /><p>Does each option meet the stated intent?</p></article>
          <article><Building2 aria-hidden="true" /><p>Is target GFA reconciled to deterministic geometry?</p></article>
          <article><Landmark aria-hidden="true" /><p>Are controls inside the supplied envelope?</p></article>
          <article><Leaf aria-hidden="true" /><p>Which uncertainty could change the recommendation?</p></article>
        </div>
      </section>

      <section id="export" className={styles.exportSection}>
        <div className={styles.exportIntro}>
          <p className={styles.eyebrow}>Steps 08-09 / Refine and issue</p>
          <h2>Export a decision package, not just an image.</h2>
          <p>Every export should state the active case, scenario, study version, evidence status, and unresolved checks. Open each downloaded file before issuing it.</p>
          <a href="/guide/sitepilot-illustrative-use-guide.pdf" className={styles.downloadAction} download><FileDown aria-hidden="true" />Download the full PDF guide</a>
        </div>
        <div className={styles.exportGrid}>
          <article><span>01</span><h3>Executive Brief PDF</h3><p>Decision statement, readiness, due diligence, risks, and action queue.</p></article>
          <article><span>02</span><h3>Scenario PDF and CSV</h3><p>Human comparison plus an independently checkable numeric record.</p></article>
          <article><span>03</span><h3>COLLADA DAE</h3><p>Downstream spatial coordination tied to the active scenario and study version.</p></article>
          <article><span>04</span><h3>Final human check</h3><p>Confirm names, units, values, labels, layout, and visible assumptions.</p></article>
        </div>
      </section>

      <section className={styles.checklistSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Close-out</p>
          <h2>Urban designer&apos;s decision checklist.</h2>
          <p>A recommendation is ready only when the proposition, metrics, evidence, and uncertainty tell the same story.</p>
        </div>
        <ul className={styles.checklist}>
          {finalChecks.map(([label, description]) => <li key={label}><span aria-hidden="true" /><div><strong>{label}</strong><p>{description}</p></div></li>)}
        </ul>
      </section>

      <section className={styles.stopRule}>
        <span className={styles.stopIcon}><Check aria-hidden="true" /></span>
        <div><p>Stop rule</p><h2>Never translate “within supplied limits” into “approved” or “compliant” without verified statutory evidence.</h2></div>
      </section>

      <footer className={styles.footer}>
        <div><span className={styles.brandMark}>SP</span><p><strong>SitePilot</strong><br />Better places begin with better questions.</p></div>
        <div><p>Illustrative workflow only. Confirm title, survey, planning controls, and commercial inputs before reliance.</p><Link href="/">Return to Decision Room <ArrowRight aria-hidden="true" /></Link></div>
      </footer>
    </main>
  );
}
