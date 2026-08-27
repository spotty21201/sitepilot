import { describe, expect, it } from 'vitest';
import { createCase } from '@/lib/storage/case-repository';
import {
  buildSchemeInputHash,
  createStudyTemplateProposals,
  generateSchemeProposals,
  validateSchemeProposals,
  type SchemeGenerationInput,
} from '@/lib/schemes/proposal-contract';
import { buildProjectReport, generateProjectReportPdf, serializeProjectReportCsv } from '@/lib/reporting/project-report';

function input(overrides: Partial<SchemeGenerationInput> = {}): SchemeGenerationInput {
  const base: SchemeGenerationInput = {
    opportunityId: 'opportunity-test',
    name: 'Thamrin Transit Quarter',
    address: 'Jl. M.H. Thamrin, Central Jakarta',
    objective: 'Mixed-use transit-oriented development with a shaded public realm.',
    siteAreaM2: 9600,
    frontageMeters: 80,
    depthMeters: 120,
    existingAsset: { gfa: 4500, floors: 2, currentStatus: 'Underutilized' },
    planningLimits: { maxFAR: 8, maxCoveragePct: 50, minKDHPct: 20, maxHeightMeters: 220, setbacks: { front: 10, rear: 6, sideLeft: 6, sideRight: 6 } },
    studyVersion: 'Study version 1',
    inputHash: 'input-test',
    priorities: {
      existingBuildingRetention: 'adapt',
      developmentYield: 'balanced',
      publicRealm: 'strong',
      programMix: 'active retail, offices, residences and hotel',
      phasing: 'phased',
      planningRiskTolerance: 'medium',
      investmentHorizon: 'medium',
      allowNonCompliantStretch: false,
    },
  };
  return { ...base, ...overrides };
}

describe('model-assisted scheme contract and truthful fallbacks', () => {
  it('produces three distinct strategy templates without pretending they are model output', async () => {
    const result = await generateSchemeProposals(input());
    expect(result.modelCalled).toBe(false);
    expect(result.disclosure).toContain('Template schemes used');
    expect(result.disclosure).toContain('No model request was made');
    expect(result.proposals).toHaveLength(3);
    expect(new Set(result.proposals.map((proposal) => proposal.thesis)).size).toBe(3);
    expect(result.proposals.map((proposal) => proposal.existingAssetDecision)).toEqual(['ADAPT', 'PARTIALLY_RETAIN', 'REPLACE']);
    expect(result.proposals.every((proposal) => proposal.commercialPremise && proposal.planningResponse && proposal.informationStillRequired.length > 0)).toBe(true);
    expect(result.proposals[2].allowNonCompliantStretch).toBe(false);
  });

  it('rejects unauthorized stretch proposals and changes the input hash when priorities change', () => {
    const study = input();
    const proposals = createStudyTemplateProposals(study).map((proposal, index) => index === 2 ? { ...proposal, allowNonCompliantStretch: true } : proposal);
    expect(validateSchemeProposals(proposals, study).valid).toBe(false);
    const { inputHash: _hash, ...hashable } = study;
    void _hash;
    expect(buildSchemeInputHash(hashable)).not.toBe(
      buildSchemeInputHash({ ...hashable, priorities: { ...study.priorities, publicRealm: 'generous' } }),
    );
  });
});

describe('existing asset, rear setback, KDH and reporting truth', () => {
  it('keeps entered existing GFA independent from podium editing and labels retention honestly', () => {
    const project = createCase({ name: 'Thamrin Transit Quarter', address: 'Jl. M.H. Thamrin, Jakarta', grossSiteArea: 9600, frontageLength: 80, lotDepth: 120, existingGFA: 4500, existingFloors: 2, existingAssetStatus: 'Underutilized', maxFAR: 8, maxCoveragePct: 50, minKDHPct: 20, maxHeightMeters: 220, setbacks: { front: 10, rear: 6, sideLeft: 6, sideRight: 6 } });
    expect(project.scenarios[0].masses[0].gfa).toBe(4500);
    expect(project.scenarios[1].masses.find((mass) => mass.name === 'Existing Asset Wing')?.gfa).toBe(4500);
    expect(project.scenarios[1].existingAssetStrategy).toBe('PARTIALLY_RETAIN');
    expect(project.scenarios[1].description).not.toContain('retaining existing operations');
    expect(project.scenarios[0].description).not.toContain('capital expenditure');
    expect(project.findings.find((finding) => finding.extractedValue?.key === 'existing_building_gfa')?.statement).toContain('provided by the user, not yet confirmed');
    expect(project.executiveSummary.topOpportunities.join(' ')).not.toContain('cashflow');
    expect(project.scenarios.every((scenario) => scenario.assumptionsUsed.setbacks.rear === 6)).toBe(true);
  });

  it('does not call unbuilt remainder KDH and exports rear setback and source status', () => {
    const project = createCase({ name: 'Export Study', address: 'Jl. Merdeka No. 7, Bandung', grossSiteArea: 2400, frontageLength: 40, lotDepth: 60, maxFAR: 3.2, maxCoveragePct: 55, minKDHPct: 20, setbacks: { front: 8, rear: 5, sideLeft: 4, sideRight: 4 } });
    const report = buildProjectReport(project, project.scenarios[1].id, '2026-08-25T12:00:00Z');
    expect(report.options[0].kdhDemonstrated).toBe(false);
    expect(report.options[0].constraints.find((constraint) => constraint.label === 'KDH demonstration')?.result).toBe('UNVERIFIED');
    expect(report.options[0].rearSetbackMeters).toBe(5);
    const csv = serializeProjectReportCsv(report);
    expect(csv).toContain('Rear Setback (m)');
    expect(csv).toContain('KDH not demonstrated');
    expect(csv).toContain('Target GFA (m2)');
    expect(csv).toContain('Calculated Achieved GFA (m2)');
    expect(csv).toContain('Variance Explanation');
    expect(csv).not.toContain('51,495');
    const pdf = generateProjectReportPdf({ ...report, options: report.options.map((option) => option.option === 'Option B' ? { ...option, scenarioName: 'Phased Expansion with a deliberately long title for print' } : option) });
    expect(Buffer.from(pdf.slice(0, 8)).toString('latin1')).toContain('%PDF-1.4');
    expect(pdf.length).toBeGreaterThan(10000);
  });
});
