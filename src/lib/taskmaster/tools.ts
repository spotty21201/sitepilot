import {
  calculateDevelopmentMetrics,
  calculateMassPairwiseIntersections,
  checkConstraintViolations,
  getCanonicalParcelBounds,
  type CanonicalParcelBounds,
} from '@/lib/geometry/engine';
import type { BuildingMass, SchemeProposal } from '@/types';
import { createStudyTemplateProposals, validateSchemeProposals } from '@/lib/schemes/proposal-contract';
import type { TaskmasterInput, TaskmasterSimulation, TaskmasterToolName } from './schemas';

export interface TaskmasterToolContext {
  input: TaskmasterInput;
  proposals: SchemeProposal[];
  simulations: TaskmasterSimulation[];
}

export interface TaskmasterToolResult {
  tool: TaskmasterToolName;
  result: unknown;
}

function round(value: number, decimals = 2): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function siteBounds(input: TaskmasterInput): CanonicalParcelBounds {
  return getCanonicalParcelBounds(input.siteAreaM2, input.planningLimits.setbacks, input.frontageMeters);
}

function massFromProposal(
  input: TaskmasterInput,
  proposal: SchemeProposal,
  bounds: CanonicalParcelBounds,
): BuildingMass[] {
  const maxCoverage = input.planningLimits.maxCoveragePct ?? 50;
  const coverageTarget = proposal.name.includes('Adaptive')
    ? Math.min(35, maxCoverage)
    : proposal.name.includes('Balanced')
      ? Math.min(45, maxCoverage)
      : maxCoverage;
  const targetFootprint = Math.min(bounds.netBuildableArea, input.siteAreaM2 * coverageTarget / 100);
  const podiumFloors = proposal.podiumStoreys ?? 0;
  const towerFloors = proposal.towerStoreys ?? 0;
  const podiumHeight = podiumFloors * (proposal.floorToFloorAssumptions.podium ?? 4);
  const towerFloorHeight = proposal.floorToFloorAssumptions.tower ?? 3.5;
  const podiumWidth = Math.max(0, Math.min(bounds.buildableWidth, Math.sqrt(Math.max(1, targetFootprint))));
  const podiumLength = Math.max(0, Math.min(bounds.buildableLength, targetFootprint / Math.max(1, podiumWidth)));
  const podiumFootprint = round(podiumWidth * podiumLength);
  const centerX = (bounds.buildableMinX + bounds.buildableMaxX) / 2;
  const centerZ = (bounds.buildableMinY + bounds.buildableMaxY) / 2;
  const masses: BuildingMass[] = [];

  const existingDecision = proposal.existingAssetDecision;
  if (input.existingAsset && existingDecision !== 'REPLACE') {
    const retainedGfa = existingDecision === 'PARTIALLY_RETAIN'
      ? input.existingAsset.gfa * 0.5
      : input.existingAsset.gfa;
    const retainedFloors = input.existingAsset.floors ?? 1;
    const retainedFootprint = Math.min(
      bounds.netBuildableArea,
      retainedGfa / Math.max(1, retainedFloors),
    );
    const retainedWidth = Math.max(1, Math.min(bounds.buildableWidth * 0.45, Math.sqrt(retainedFootprint)));
    const retainedLength = Math.max(1, Math.min(bounds.buildableLength * 0.55, retainedFootprint / retainedWidth));
    masses.push({
      id: `${proposal.id}-existing-asset`,
      name: existingDecision === 'PARTIALLY_RETAIN' ? 'Existing asset · partial retention' : 'Existing asset · retained',
      type: 'GENERAL',
      footprintArea: round(retainedWidth * retainedLength),
      floors: retainedFloors,
      floorToFloorHeight: 4,
      height: retainedFloors * 4,
      gfa: round(retainedGfa),
      preserveGfa: true,
      program: 'MIXED_USE',
      position: { x: bounds.buildableMinX + retainedWidth / 2, y: 0, z: centerZ },
      dimensions: { width: retainedWidth, length: retainedLength, height: retainedFloors * 4 },
    });
  }

  if (podiumFloors > 0) {
    masses.push({
      id: `${proposal.id}-podium`,
      name: `${proposal.name} · podium`,
      type: 'PODIUM',
      footprintArea: podiumFootprint,
      floors: podiumFloors,
      floorToFloorHeight: proposal.floorToFloorAssumptions.podium ?? 4,
      height: podiumHeight,
      gfa: round(podiumFootprint * podiumFloors),
      program: 'MIXED_USE',
      position: { x: centerX, y: 0, z: centerZ },
      dimensions: { width: podiumWidth, length: podiumLength, height: podiumHeight },
    });
  }

  if (towerFloors > 0) {
    const towerFootprint = round(Math.min(podiumFootprint * 0.42, bounds.netBuildableArea * 0.42));
    const towerWidth = Math.max(1, Math.min(podiumWidth * 0.62, Math.sqrt(Math.max(1, towerFootprint))));
    const towerLength = Math.max(1, Math.min(podiumLength * 0.62, towerFootprint / towerWidth));
    masses.push({
      id: `${proposal.id}-tower`,
      name: `${proposal.name} · tower`,
      type: 'TOWER',
      footprintArea: round(towerWidth * towerLength),
      floors: towerFloors,
      floorToFloorHeight: towerFloorHeight,
      height: towerFloors * towerFloorHeight,
      gfa: round(towerWidth * towerLength * towerFloors),
      program: 'MIXED_USE',
      position: { x: centerX, y: podiumHeight, z: centerZ },
      dimensions: { width: towerWidth, length: towerLength, height: towerFloors * towerFloorHeight },
    });
  }

  return masses;
}

export function calculateBuildableEnvelopeTool(input: TaskmasterInput) {
  const bounds = siteBounds(input);
  return {
    width: bounds.width,
    depth: bounds.length,
    grossSiteArea: bounds.grossSiteArea,
    buildableWidth: bounds.buildableWidth,
    buildableLength: bounds.buildableLength,
    buildableAreaM2: bounds.netBuildableArea,
    setbacks: input.planningLimits.setbacks,
    heightLimit: input.planningLimits.maxHeightMeters ?? 'not supplied',
    note: 'Rectangular study envelope; not surveyed cadastral geometry.',
  };
}

export function simulateDevelopmentSchemeTool(input: TaskmasterInput, proposal: SchemeProposal): TaskmasterSimulation {
  const bounds = siteBounds(input);
  const masses = massFromProposal(input, proposal, bounds);
  const metrics = calculateDevelopmentMetrics(
    input.siteAreaM2,
    masses,
    input.planningLimits.setbacks,
    input.frontageMeters,
    input.landscapedPermeableAreaM2,
  );
  const intersections = calculateMassPairwiseIntersections(masses);
  const checks = checkConstraintViolations(metrics, {
    maxHeightMeters: input.planningLimits.maxHeightMeters,
    maxFAR: input.planningLimits.maxFAR,
    maxCoveragePct: input.planningLimits.maxCoveragePct,
    outOfBoundsAreaM2: metrics.outOfBoundsAreaM2,
  });
  const warnings = [...checks.warnings];
  if (intersections.hasOverlap) warnings.push(`Mass collision detected (${round(intersections.overlapVolumeM3)} m³).`);
  if (input.planningLimits.minKDHPct !== undefined && input.landscapedPermeableAreaM2 === undefined) {
    warnings.push('KDH not demonstrated: explicit landscaped/permeable area is still required.');
  }
  return {
    proposalId: proposal.id,
    totalGFA: metrics.totalGFA,
    farKLB: metrics.farKLB,
    coverageKDB: metrics.siteCoveragePercentage,
    heightMeters: metrics.totalHeightMeters,
    totalFloors: metrics.totalFloors,
    buildableAreaM2: metrics.netBuildableArea,
    landscapedPermeableAreaM2: metrics.landscapedPermeableAreaM2,
    kdhDemonstrated: metrics.kdhDemonstrated ?? false,
    planningStatus: warnings.length === 0 ? 'WITHIN_SUPPLIED_LIMITS' : 'OUTSIDE_SUPPLIED_LIMITS',
    warnings,
    assumptions: [
      'Figures are calculated from the rectangular study parcel and supplied setbacks.',
      proposal.existingAssetDecision === 'REPLACE' ? 'Existing asset is replaced in this study.' : proposal.existingAssetScope,
    ],
  };
}

export function compareDevelopmentSchemes(simulations: TaskmasterSimulation[]) {
  return simulations.map((simulation) => ({
    proposalId: simulation.proposalId,
    totalGFA: simulation.totalGFA,
    farKLB: simulation.farKLB,
    coverageKDB: simulation.coverageKDB,
    heightMeters: simulation.heightMeters,
    planningStatus: simulation.planningStatus,
    warningCount: simulation.warnings.length,
  }));
}

export function executeTaskmasterTool(
  name: TaskmasterToolName,
  context: TaskmasterToolContext,
  input: Record<string, unknown> = {},
): TaskmasterToolResult {
  switch (name) {
    case 'get_opportunity_context':
      return { tool: name, result: { opportunityId: context.input.opportunityId, name: context.input.name, address: context.input.address, objective: context.input.objective } };
    case 'get_site_and_planning_inputs':
      return { tool: name, result: { siteAreaM2: context.input.siteAreaM2, frontageMeters: context.input.frontageMeters, depthMeters: context.input.depthMeters, existingAsset: context.input.existingAsset, planningLimits: context.input.planningLimits } };
    case 'list_assumptions_and_missing_information':
      return { tool: name, result: {
        assumptions: ['Rectangular study parcel; not surveyed cadastral geometry.'],
        missing: [
          context.input.planningLimits.maxHeightMeters === undefined ? 'Maximum building height' : undefined,
          context.input.planningLimits.minKDHPct !== undefined && context.input.landscapedPermeableAreaM2 === undefined ? 'Landscaped/permeable KDH area' : undefined,
        ].filter(Boolean),
      } };
    case 'calculate_buildable_envelope':
      return { tool: name, result: calculateBuildableEnvelopeTool(context.input) };
    case 'prepare_scheme_proposals': {
      if (context.proposals.length === 3) {
        const validation = validateSchemeProposals(context.proposals, context.input);
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        return { tool: name, result: { proposals: validation.proposals, validation, source: 'model' } };
      }
      const proposals = createStudyTemplateProposals(context.input);
      const validation = validateSchemeProposals(proposals, context.input);
      if (!validation.valid) throw new Error(validation.errors.join(' '));
      context.proposals = validation.proposals;
      return { tool: name, result: { proposals: validation.proposals, validation } };
    }
    case 'simulate_development_scheme': {
      const proposalId = typeof input.proposalId === 'string' ? input.proposalId : undefined;
      const proposal = context.proposals.find((candidate) => candidate.id === proposalId) || context.proposals[0];
      if (!proposal) throw new Error('No validated proposal is available for simulation.');
      const simulation = simulateDevelopmentSchemeTool(context.input, proposal);
      context.simulations = [...context.simulations.filter((item) => item.proposalId !== proposal.id), simulation];
      return { tool: name, result: simulation };
    }
    case 'get_scheme_planning_checks':
      return { tool: name, result: context.simulations.find((item) => item.proposalId === input.proposalId) || null };
    case 'compare_development_schemes':
      return { tool: name, result: compareDevelopmentSchemes(context.simulations) };
    default: {
      const unreachable: never = name;
      throw new Error(`Unsupported Taskmaster tool: ${unreachable}`);
    }
  }
}
