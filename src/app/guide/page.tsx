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
    'A step-by-step guide to enter available site data, compare three options, review 2D and 3D massing, and export the study.',
};

const workflow = [
  ['01', 'Set up', 'Name the project and state what the study needs to test.'],
  ['02', 'Enter data', 'Add site dimensions, existing buildings, planning limits, and asking price.'],
  ['03', 'Check sources', 'Mark each value as confirmed, provided, calculated, or assumed.'],
  ['04', 'Compare options', 'Review the same site, planning, space, and cost measures for all three options.'],
  ['05', 'Refine the model', 'Check footprints in plan view and building massing in 3D.'],
  ['06', 'Export the study', 'Download the brief, comparison, data table, and 3D model.'],
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
    eyebrow: 'Project and site data',
    title: 'Start with available site data.',
    intro:
      'Enter what is already known about the site and leave unknown fields blank. Give the study a clear name, label it as synthetic when the data is illustrative, and state what you want to test.',
    image: '/guide/new-opportunity.webp',
    alt: 'SitePilot New Opportunity form with project, parcel, and development-intent inputs',
    actions: [
      ['Name the study', "Use a project name that others will recognise. Add 'Synthetic Study' when the parcel or planning limits are illustrative."],
      ['Enter the parcel data', 'Add the address, city, country, site area, frontage, and depth. Select the street edge that the frontage faces.'],
      ['State what you want to test', 'For example: retain the existing building, add active frontage, protect access, phase construction, or test the maximum building envelope.'],
      ['Check the first calculations', 'Review the working site area, the maximum GFA calculated from the entered limits, and the additional floor area above the existing building.'],
    ],
    rule: 'If a site dimension or planning limit is unknown, leave it blank and add it to the list of checks.',
  },
  {
    id: 'asset',
    number: '02',
    eyebrow: 'Existing buildings',
    title: 'Record what is already on the site.',
    intro:
      'For a developed site, record the building area, number of floors, current use, and operating status. Keep it in Option A unless the brief specifically allows demolition or replacement.',
    image: '/guide/existing-asset.webp',
    alt: 'SitePilot Existing Asset section for existing GFA, storeys, description, and operational status',
    actions: [
      ['Enter existing GFA', 'Use a measured or documented gross floor area. Do not estimate it from the footprint alone.'],
      ['Add floors, use, and status', 'State what the building is used for and whether it remains open. Leave unknown details blank.'],
      ['Choose what stays', 'Record whether the building will be retained, demolished, replaced, or kept open during phased work.'],
      ['Check the additional GFA', 'Confirm that the calculation subtracts the floor area you plan to retain.'],
    ],
    rule: 'Confirm which buildings must stay open, which may be removed, and which parts of the site cannot be disturbed.',
  },
  {
    id: 'planning',
    number: '03',
    eyebrow: 'Planning limits',
    title: 'Enter each planning limit and its source.',
    intro:
      'Add the zoning, FAR/KLB, site coverage/KDB, green area/KDH, height, and setbacks. A value supplied for the study is not a confirmed legal limit until its source has been checked.',
    image: '/guide/planning-limits.webp',
    alt: 'SitePilot Planning Limits section showing zoning, FAR, KDB, KDH, height, and setbacks',
    actions: [
      ['Enter the zoning reference', 'Copy the zoning code and subzone exactly as written in the source document.'],
      ['Add the main limits', 'Enter FAR/KLB, KDB, KDH, maximum height, and the correct unit for each value. Leave an unknown height blank.'],
      ['Record green area correctly', 'Enter landscaped or permeable area only when it has been measured. Do not count every unbuilt area as KDH.'],
      ['Add all setbacks', 'Enter front, rear, and side setbacks so the plan can show the correct buildable area.'],
    ],
    rule: 'Mark a planning limit as confirmed only when you have checked the authority, document, parcel, date, and meaning of the control.',
  },
  {
    id: 'commercial',
    number: '04',
    eyebrow: 'Price and benchmarks',
    title: 'Enter the asking price and benchmark data.',
    intro:
      'Use the asking price and a dated land-value benchmark to compare the options. Keep taxes, transaction costs, and valuation adjustments separate.',
    image: '/guide/commercials-review.webp',
    alt: 'SitePilot Commercials section with asking price, currency, tax benchmark, valuation notes, and review button',
    actions: [
      ['Enter the price and currency', 'Use the stated asking price. Do not add taxes, transaction costs, or other adjustments to this field.'],
      ['Add the benchmark source', 'Record the benchmark year, measurement basis, source, and reliability in the notes.'],
      ['Check the calculated rates', 'Review land price per square metre and land cost per permitted GFA for unit or scale errors.'],
      ['Review before generating options', 'Select Review Opportunity & 3 Schemes, then confirm the inputs and check whether the options are generated or loaded from the fallback template.'],
    ],
    rule: 'Use cost figures to compare options, not as proof that an option is feasible or better for the site.',
  },
  {
    id: 'evidence',
    number: '05',
    eyebrow: 'Sources and assumptions',
    title: 'Check the source behind every important value.',
    intro:
      'Open Sources & Assumptions to see who provided each value, how it was calculated, and where it is used in the study.',
    image: '/guide/sources-assumptions.webp',
    alt: 'SitePilot Sources and Assumptions panel beside the 3D model and scenario controls',
    actions: [
      ['Confirm the site basis', 'Check which site area and parcel geometry are used for the calculations and model.'],
      ['Filter the evidence', 'Review confirmed, provided, calculated, and assumed items separately.'],
      ['Check important values', 'For each key number, review its source, date, reliability, calculation, and the outputs that use it.'],
      ['Keep open checks visible', 'Make sure unresolved items appear in the comparison, brief, and exported files.'],
    ],
    rule: 'For every value that could change the preferred option, record who supplied it, what supports it, and where it is used.',
  },
] as const;

const finalChecks = [
  ['Purpose', 'The brief states what the study needs to test and who will use it.'],
  ['Site', 'Area, frontage, depth, street edge, and parcel geometry are recorded.'],
  ['Existing buildings', 'Retention, demolition, phasing, and continued operation are recorded.'],
  ['Planning limits', 'FAR/KLB, KDB, KDH, height, and setbacks include a source status.'],
  ['Green area', 'Measured landscaped or permeable area is separate from other unbuilt area.'],
  ['Options', 'A, B, and C test different site strategies, not only different densities.'],
  ['2D and 3D', 'Both views show the same selected option without overlapping building masses.'],
  ['Measurements', 'GFA, FAR, coverage, height, floors, and setbacks match the selected geometry.'],
  ['Sources', 'Confirmed, provided, calculated, and assumed values remain separate.'],
  ['Downloads', 'The brief, PDF, CSV, and DAE match the selected option shown on screen.'],
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
          <h1>From available site data to a 3D simulation.</h1>
          <p className={styles.lede}>
            Enter site dimensions, existing buildings, planning limits, and price data.
            Compare three options in 2D and 3D, then export the study with its sources
            and open checks. The result is not a survey, planning approval, or valuation.
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
          <p>Working principle</p>
          <strong>Show the source, the number, and its effect on the site plan together.</strong>
        </aside>
      </section>

      <section id="prepare" className={styles.prepareSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Before opening the app</p>
          <h2>Collect the data you already have.</h2>
          <p>You can begin with incomplete information. Keep missing items visible and do not replace them with guesses.</p>
        </div>
        <div className={styles.prepareGrid}>
          <article><BookOpenCheck aria-hidden="true" /><span>01</span><h3>Purpose of the study</h3><p>Write down the option, constraint, or development question you need to test.</p></article>
          <article><Ruler aria-hidden="true" /><span>02</span><h3>Site measurements</h3><p>Bring the site area, frontage, depth or survey geometry, street edge, and access limits.</p></article>
          <article><FileSearch aria-hidden="true" /><span>03</span><h3>Source notes</h3><p>Record where each value came from and whether it is confirmed, provided, calculated, or assumed.</p></article>
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>The complete journey</p>
          <h2>Six steps to decision.</h2>
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
          <h2>Know where to enter, view, and export data.</h2>
          <p>The left panel contains the brief and sources. The centre shows the site in 2D or 3D. The right panel contains the options, measurements, and export buttons.</p>
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
          <h2>Check the plan first, then review the 3D model.</h2>
          <p>In 2D, check the parcel, frontage, setbacks, access, and spacing between buildings. In 3D, check building height, overall massing, and how each volume fits on the site.</p>
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
          <div><p>Edit and check</p><h3>Select a building → choose Move, Resize, or Floors → enter exact values or use snap → fit the parcel or proposal in view → turn on planning checks → review the updated measurements.</h3></div>
        </div>
      </section>

      <section id="compare" className={styles.compareSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Step 07 / Scenario comparison</p>
          <h2>Use the same measures for all three options.</h2>
          <p>Before choosing an option, compare A, B, and C using the same site, planning, space, and cost information.</p>
        </div>
        <figure className={styles.compareFigure}>
          <Image src="/guide/scenario-comparison.webp" alt="SitePilot comparison matrix for three development scenarios" width={1223} height={704} sizes="(max-width: 900px) 100vw, 1200px" />
        </figure>
        <div className={styles.questionGrid}>
          <article><Scale aria-hidden="true" /><p>Does the option test the purpose stated at the start?</p></article>
          <article><Building2 aria-hidden="true" /><p>Does the reported GFA match the building geometry?</p></article>
          <article><Landmark aria-hidden="true" /><p>Does the option remain within the planning limits entered for the study?</p></article>
          <article><Leaf aria-hidden="true" /><p>Which missing or unconfirmed value could change the result?</p></article>
        </div>
      </section>

      <section id="export" className={styles.exportSection}>
        <div className={styles.exportIntro}>
          <p className={styles.eyebrow}>Steps 08-09 / Export and final check</p>
          <h2>Download and check each study file.</h2>
          <p>Each file should show the project, selected option, study version, source status, and open checks. Open every download and compare it with the option shown on screen before sharing it.</p>
          <a href="/guide/sitepilot-illustrative-use-guide.pdf" className={styles.downloadAction} download><FileDown aria-hidden="true" />Download the full PDF guide</a>
        </div>
        <div className={styles.exportGrid}>
          <article><span>01</span><h3>Executive Brief PDF</h3><p>Purpose, current status, open checks, risks, and next actions.</p></article>
          <article><span>02</span><h3>Option PDF and CSV</h3><p>A visual comparison and a table of the values behind it.</p></article>
          <article><span>03</span><h3>COLLADA DAE</h3><p>A 3D model of the selected option for use in other design software.</p></article>
          <article><span>04</span><h3>Final check</h3><p>Confirm the project name, option, units, values, labels, layout, and assumptions.</p></article>
        </div>
      </section>

      <section className={styles.checklistSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Close-out</p>
          <h2>Check the study before sharing it.</h2>
          <p>Use this list to confirm that the site data, model, measurements, sources, and downloads agree.</p>
        </div>
        <ul className={styles.checklist}>
          {finalChecks.map(([label, description]) => <li key={label}><span aria-hidden="true" /><div><strong>{label}</strong><p>{description}</p></div></li>)}
        </ul>
      </section>

      <section className={styles.stopRule}>
        <span className={styles.stopIcon}><Check aria-hidden="true" /></span>
        <div><p>Important limit</p><h2>Do not label an option “approved” or “compliant” only because it fits the limits entered in SitePilot. Verify the controls with the relevant authority.</h2></div>
      </section>

      <footer className={styles.footer}>
        <div><span className={styles.brandMark}>SP</span><p><strong>SitePilot</strong><br />Better places begin with better questions.</p></div>
        <div><p>Illustrative workflow only. Check the title, survey, planning limits, and price data before using the study for a decision.</p><Link href="/">Return to Decision Room <ArrowRight aria-hidden="true" /></Link></div>
      </footer>
    </main>
  );
}
