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

export function massFromProposal(
  input: TaskmasterInput,
  proposal: SchemeProposal,
  bounds: CanonicalParcelBounds,
): BuildingMass[] {
  const maxCoverage = input.planningLimits.maxCoveragePct ?? 50;
  const maxCoverageArea = input.siteAreaM2 * maxCoverage / 100;
  const podiumFloorHeight = proposal.floorToFloorAssumptions.podium ?? 4;
  const towerFloorHeight = proposal.floorToFloorAssumptions.tower ?? 3.5;
  const requestedPodiumFloors = proposal.podiumStoreys ?? 0;
  const podiumFloors = input.planningLimits.maxHeightMeters === undefined
    ? requestedPodiumFloors
    : Math.min(requestedPodiumFloors, Math.max(0, Math.floor(input.planningLimits.maxHeightMeters / podiumFloorHeight)));
  const maximumTowerFloors = input.planningLimits.maxHeightMeters === undefined
    ? proposal.towerStoreys ?? 0
    : Math.max(0, Math.floor((input.planningLimits.maxHeightMeters - podiumFloors * podiumFloorHeight) / towerFloorHeight));
  const towerFloors = Math.min(proposal.towerStoreys ?? 0, maximumTowerFloors);
  const alternativeFloorHeight = proposal.floorToFloorAssumptions.alternative ?? 3.5;
  const alternativeFloors = input.planningLimits.maxHeightMeters === undefined
    ? proposal.alternativeStoreys ?? 0
    : Math.min(proposal.alternativeStoreys ?? 0, Math.max(0, Math.floor(input.planningLimits.maxHeightMeters / alternativeFloorHeight)));
  const podiumHeight = podiumFloors * podiumFloorHeight;
  const targetGfa = Math.max(0, proposal.targetGFA);
  const retainedGfa = input.existingAsset ? proposal.existingGfaRetainedM2 : 0;
  const retainedFloors = input.existingAsset?.floors ?? 1;
  const retainedFootprintTarget = retainedGfa / Math.max(1, retainedFloors);
  const retainedWidth = retainedGfa > 0 ? Math.max(1, Math.min(bounds.buildableWidth * 0.42, Math.sqrt(retainedFootprintTarget))) : 0;
  const retainedLength = retainedWidth > 0 ? Math.max(1, Math.min(bounds.buildableLength * 0.55, retainedFootprintTarget / retainedWidth)) : 0;
  const availableCoverage = Math.max(1, maxCoverageArea - retainedWidth * retainedLength);
  const targetNewGfa = Math.max(1, targetGfa - retainedGfa);
  const towerShare = proposal.strategy === 'CONSERVATIVE' ? 0.52 : proposal.strategy === 'BALANCED' ? 0.68 : 0.82;
  const towerFootprintTarget = towerFloors > 0 ? targetNewGfa * towerShare / towerFloors : 0;
  const towerFootprint = towerFloors > 0 ? Math.max(120, Math.min(availableCoverage * 0.7, towerFootprintTarget || availableCoverage * 0.45)) : 0;
  const podiumFootprintTarget = podiumFloors > 0 ? Math.max(towerFootprint, (targetNewGfa - towerFootprint * towerFloors) / podiumFloors) : towerFootprint;
  const podiumFootprint = Math.max(0, Math.min(availableCoverage, podiumFootprintTarget));
  const maxSeparatedPodiumLength = Math.max(1, bounds.buildableLength - retainedLength - 2);
  const podiumLength = podiumFootprint > 0 ? Math.max(1, Math.min(maxSeparatedPodiumLength, Math.sqrt(podiumFootprint))) : 0;
  const podiumWidth = podiumLength > 0 ? Math.max(1, Math.min(bounds.buildableWidth, podiumFootprint / podiumLength)) : 0;
  const towerWidth = towerFootprint > 0 ? Math.max(1, Math.min(podiumWidth * 0.72, Math.sqrt(towerFootprint))) : 0;
  const towerLength = towerWidth > 0 ? Math.max(1, Math.min(podiumLength * 0.72, towerFootprint / towerWidth)) : 0;
  const centerX = (bounds.buildableMinX + bounds.buildableMaxX) / 2;
  const retainedCenterZ = bounds.buildableMinY + retainedLength / 2;
  const podiumCenterZ = bounds.buildableMaxY - podiumLength / 2;
  const masses: BuildingMass[] = [];

  const existingDecision = proposal.existingAssetDecision;
  if (input.existingAsset && existingDecision !== 'REPLACE' && existingDecision !== 'NOT_APPLICABLE') {
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
      position: { x: centerX, y: 0, z: retainedCenterZ },
      dimensions: { width: retainedWidth, length: retainedLength, height: retainedFloors * 4 },
    });
  }

  if (podiumFloors > 0) {
    masses.push({
      id: `${proposal.id}-podium`,
      name: `${proposal.name} · podium`,
      type: 'PODIUM',
      footprintArea: round(podiumWidth * podiumLength),
      floors: podiumFloors,
      floorToFloorHeight: proposal.floorToFloorAssumptions.podium ?? 4,
      height: podiumHeight,
      gfa: round(podiumFootprint * podiumFloors),
      program: 'MIXED_USE',
      position: { x: centerX, y: 0, z: podiumCenterZ },
      dimensions: { width: podiumWidth, length: podiumLength, height: podiumHeight },
    });
  }

  if (alternativeFloors > 0) {
    const alternativeFootprint = Math.max(1, Math.min(availableCoverage, targetNewGfa / alternativeFloors));
    const alternativeLength = Math.max(1, Math.min(maxSeparatedPodiumLength, Math.sqrt(alternativeFootprint)));
    const alternativeWidth = Math.max(1, Math.min(bounds.buildableWidth, alternativeFootprint / alternativeLength));
    const alternativeCenterZ = bounds.buildableMaxY - alternativeLength / 2;
    masses.push({
      id: `${proposal.id}-alternative`,
      name: `${proposal.name} · low-rise courtyard wings`,
      type: 'GENERAL',
      footprintArea: round(alternativeWidth * alternativeLength),
      floors: alternativeFloors,
      floorToFloorHeight: alternativeFloorHeight,
      height: alternativeFloors * alternativeFloorHeight,
      gfa: round(alternativeWidth * alternativeLength * alternativeFloors),
      program: 'MIXED_USE',
      position: { x: centerX, y: 0, z: alternativeCenterZ },
      dimensions: { width: alternativeWidth, length: alternativeLength, height: alternativeFloors * alternativeFloorHeight },
    });
  }

  if (towerFloors > 0) {
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
      position: { x: centerX, y: podiumHeight, z: podiumCenterZ },
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
  const landscapedPermeableAreaM2 = input.landscapedPermeableAreaM2 ?? (
    input.landscapedPermeablePct === undefined ? undefined : input.siteAreaM2 * input.landscapedPermeablePct / 100
  );
  const metrics = calculateDevelopmentMetrics(
    input.siteAreaM2,
    masses,
    input.planningLimits.setbacks,
    input.frontageMeters,
    landscapedPermeableAreaM2,
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
  const kdhWarning = input.planningLimits.minKDHPct !== undefined && landscapedPermeableAreaM2 === undefined;
  if (kdhWarning) {
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
    planningStatus: checks.hasViolations || intersections.hasOverlap ? 'OUTSIDE_SUPPLIED_LIMITS' : 'WITHIN_SUPPLIED_LIMITS',
    warnings,
    assumptions: [
      'Figures are calculated from the rectangular study parcel and supplied setbacks.',
      proposal.existingAssetDecision === 'REPLACE' ? 'Existing asset is replaced in this study.' : proposal.existingAssetScope,
    ],
    programGFAByUse: proposal.programGFAByUse,
    masses,
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
