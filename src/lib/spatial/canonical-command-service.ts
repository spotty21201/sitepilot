import {
  BuildingMass,
  CanonicalScenarioRevision,
  DevelopmentScenario,
  Project,
  Setbacks,
} from '@/types';
import {
  calculateDevelopmentMetrics,
  calculateMassPairwiseIntersections,
  detectScenarioEditClassification,
  evaluateScenarioCompliance,
  fitMassesToBuildableEnvelope,
} from '@/lib/geometry/engine';
import { deriveScenarioFloorLimit, getScenarioFloorToFloorHeight } from '@/lib/opportunity/canonical-opportunity';

export type CanonicalSpatialCommandType =
  | 'MOVE_MASS'
  | 'RESIZE_MASS'
  | 'SET_MASS_FLOORS'
  | 'SET_MASS_TYPE_FLOORS'
  | 'SET_FLOOR_TO_FLOOR_HEIGHT'
  | 'SET_MASS_PROGRAM'
  | 'ADD_MASS'
  | 'DUPLICATE_MASS'
  | 'DELETE_MASS'
  | 'SET_SCENARIO_FLOORS'
  | 'SET_SETBACKS'
  | 'FIT_TO_ENVELOPE'
  | 'RESET_SCENARIO'
  | 'ACCEPT_SCHEME_PROPOSAL'
  | 'DUPLICATE_SCENARIO';

interface CommandBase {
  id: string;
  caseId: string;
  scenarioId: string;
  targetId: string;
  expectedSourceRevisionId: string;
  issuedAt: string;
  source: 'LEGACY_EDITOR' | 'SPATIAL_EDITOR_ADAPTER' | 'SYSTEM';
  description: string;
}

export type CanonicalSpatialCommand =
  | (CommandBase & { type: 'MOVE_MASS'; payload: { position: BuildingMass['position'] } })
  | (CommandBase & { type: 'RESIZE_MASS'; payload: { width: number; length: number } })
  | (CommandBase & { type: 'SET_MASS_FLOORS'; payload: { floors: number } })
  | (CommandBase & { type: 'SET_MASS_TYPE_FLOORS'; payload: { massType: 'PODIUM' | 'TOWER'; floors: number } })
  | (CommandBase & { type: 'SET_FLOOR_TO_FLOOR_HEIGHT'; payload: { floorToFloorHeight: number } })
  | (CommandBase & { type: 'SET_MASS_PROGRAM'; payload: { program: BuildingMass['program'] } })
  | (CommandBase & { type: 'ADD_MASS'; payload: { mass: BuildingMass } })
  | (CommandBase & { type: 'DUPLICATE_MASS'; payload: { mass: BuildingMass; sourceMassId: string } })
  | (CommandBase & { type: 'DELETE_MASS'; payload: Record<string, never> })
  | (CommandBase & { type: 'SET_SCENARIO_FLOORS'; payload: { floors: number } })
  | (CommandBase & { type: 'SET_SETBACKS'; payload: { setbacks: Setbacks } })
  | (CommandBase & { type: 'FIT_TO_ENVELOPE'; payload: Record<string, never> })
  | (CommandBase & { type: 'RESET_SCENARIO'; payload: Record<string, never> })
  | (CommandBase & { type: 'ACCEPT_SCHEME_PROPOSAL'; payload: { proposalId: string } })
  | (CommandBase & {
      type: 'DUPLICATE_SCENARIO';
      payload: { newScenarioId: string; name: string };
    });

export type CommittedSpatialCommand = CanonicalSpatialCommand & {
  resultingRevisionId: string;
  resultingRevisionHash: string;
  resultingRevisionSequence: number;
};

export type CommandRejectionCode =
  | 'CASE_MISMATCH'
  | 'SCENARIO_NOT_FOUND'
  | 'TARGET_NOT_FOUND'
  | 'STALE_REVISION'
  | 'DUPLICATE_COMMAND'
  | 'INVALID_PAYLOAD'
  | 'DUPLICATE_TARGET'
  | 'PERSISTENCE_FAILED'
  | 'NO_CHANGE';

export type CanonicalCommandResult =
  | {
      accepted: true;
      project: Project;
      scenario: DevelopmentScenario;
      committedCommand: CommittedSpatialCommand;
    }
  | {
      accepted: false;
      project: Project;
      code: CommandRejectionCode;
      reason: string;
    };

interface HistoryEntry {
  command: CanonicalSpatialCommand;
  beforeScenario: DevelopmentScenario;
  afterScenario: DevelopmentScenario;
  duplicatedScenarioId?: string;
  undoRevisionId?: string;
}

interface ScopedHistory {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

export interface HistoryTransitionResult {
  accepted: boolean;
  project: Project;
  revision?: CanonicalScenarioRevision;
  reason?: string;
}

const PROGRAMS = new Set<BuildingMass['program']>([
  'RESIDENTIAL',
  'COMMERCIAL',
  'RETAIL',
  'MIXED_USE',
  'HOTEL',
  'PARKING',
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'canonicalRevision' && key !== 'updatedAt')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

function sha256(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return Array.from(hash, (value) => value.toString(16).padStart(8, '0')).join('');
}

export function serializeCanonicalScenario(scenario: DevelopmentScenario): string {
  return JSON.stringify(stableValue(scenario));
}

export function computeCanonicalScenarioHash(scenario: DevelopmentScenario): string {
  return sha256(serializeCanonicalScenario(scenario));
}

function revisionId(scenarioId: string, sequence: number, hash: string): string {
  return `${scenarioId}:r${sequence}:${hash.slice(0, 12)}`;
}

function createRevision(
  scenario: DevelopmentScenario,
  sequence: number,
  commandId: string,
  sourceRevisionId: string | null,
  timestamp: string
): CanonicalScenarioRevision {
  const revisionHash = computeCanonicalScenarioHash(scenario);
  return {
    schemaVersion: 1,
    revisionId: revisionId(scenario.id, sequence, revisionHash),
    revisionHash,
    sequence,
    commandId,
    sourceRevisionId,
    timestamp,
  };
}

function isRevision(value: unknown): value is CanonicalScenarioRevision {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CanonicalScenarioRevision>;
  return candidate.schemaVersion === 1
    && typeof candidate.revisionId === 'string'
    && typeof candidate.revisionHash === 'string'
    && Number.isInteger(candidate.sequence)
    && (candidate.sequence ?? -1) >= 0
    && typeof candidate.commandId === 'string'
    && candidate.commandId.length > 0
    && (candidate.sourceRevisionId === null || typeof candidate.sourceRevisionId === 'string')
    && typeof candidate.timestamp === 'string'
    && !Number.isNaN(Date.parse(candidate.timestamp));
}

export function ensureCanonicalScenarioRevision(scenario: DevelopmentScenario): DevelopmentScenario {
  const current = scenario.canonicalRevision;
  const hash = computeCanonicalScenarioHash(scenario);
  if (
    isRevision(current)
    && current.revisionHash === hash
    && current.revisionId === revisionId(scenario.id, current.sequence, hash)
  ) return scenario;

  const sequence = isRevision(current) ? current.sequence + 1 : 0;
  const commandId = isRevision(current) ? 'migration:reconcile-v1' : 'migration:legacy-v1';
  const timestamp = scenario.updatedAt || scenario.createdAt;
  const normalized = clone(scenario);
  normalized.canonicalRevision = createRevision(
    normalized,
    sequence,
    commandId,
    isRevision(current) ? current.revisionId : null,
    timestamp
  );
  return normalized;
}

export function ensureCanonicalProjectRevisions(project: Project): Project {
  return {
    ...project,
    scenarios: project.scenarios.map(ensureCanonicalScenarioRevision),
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateMass(mass: BuildingMass): boolean {
  return Boolean(mass.id && mass.name)
    && isFiniteNumber(mass.position.x)
    && isFiniteNumber(mass.position.y)
    && isFiniteNumber(mass.position.z)
    && isFiniteNumber(mass.dimensions.width)
    && mass.dimensions.width > 0
    && isFiniteNumber(mass.dimensions.length)
    && mass.dimensions.length > 0
    && isFiniteNumber(mass.floorToFloorHeight)
    && mass.floorToFloorHeight > 0
    && Number.isInteger(mass.floors)
    && mass.floors > 0
    && PROGRAMS.has(mass.program);
}

function validateSetbacks(setbacks: Setbacks): boolean {
  return Object.values(setbacks).every((value) => isFiniteNumber(value) && value >= 0);
}

function validateCommandPayload(command: CanonicalSpatialCommand): string | null {
  switch (command.type) {
    case 'MOVE_MASS':
      return Object.values(command.payload.position).every(isFiniteNumber) ? null : 'Position must contain finite coordinates.';
    case 'RESIZE_MASS':
      return isFiniteNumber(command.payload.width)
        && isFiniteNumber(command.payload.length)
        && command.payload.width > 0
        && command.payload.length > 0
        ? null
        : 'Width and length must be positive finite values.';
    case 'SET_MASS_FLOORS':
    case 'SET_MASS_TYPE_FLOORS':
    case 'SET_SCENARIO_FLOORS':
      return Number.isInteger(command.payload.floors) && command.payload.floors > 0
        ? null
        : 'Floors must be a positive integer.';
    case 'SET_FLOOR_TO_FLOOR_HEIGHT':
      return isFiniteNumber(command.payload.floorToFloorHeight) && command.payload.floorToFloorHeight > 0
        ? null
        : 'Floor-to-floor height must be positive.';
    case 'SET_MASS_PROGRAM':
      return PROGRAMS.has(command.payload.program) ? null : 'Unsupported programme.';
    case 'ADD_MASS':
    case 'DUPLICATE_MASS':
      return validateMass(command.payload.mass) ? null : 'Mass payload is malformed.';
    case 'SET_SETBACKS':
      return validateSetbacks(command.payload.setbacks) ? null : 'Setbacks must be non-negative finite values.';
    case 'DUPLICATE_SCENARIO':
      return command.payload.newScenarioId && command.payload.name.trim() ? null : 'Scenario identity is required.';
    case 'ACCEPT_SCHEME_PROPOSAL':
      return command.payload.proposalId.trim() ? null : 'A proposal ID is required.';
    default:
      return null;
  }
}

function normalizeChangedMass(mass: BuildingMass, recomputeFootprint = false): BuildingMass {
  const footprintArea = recomputeFootprint
    ? Math.round(mass.dimensions.width * mass.dimensions.length * 10) / 10
    : mass.footprintArea;
  const height = Math.round(mass.floors * mass.floorToFloorHeight * 10) / 10;
  return {
    ...mass,
    footprintArea,
    height,
    gfa: Math.round(footprintArea * mass.floors * 10) / 10,
    dimensions: { ...mass.dimensions, height },
  };
}

function deriveScenario(
  project: Project,
  scenario: DevelopmentScenario,
  masses: BuildingMass[],
  setbacks: Setbacks,
  timestamp: string,
  flags?: { fitted?: boolean; reset?: boolean }
): DevelopmentScenario {
  const metrics = calculateDevelopmentMetrics(
    project.site.grossSiteArea,
    masses,
    setbacks,
    project.site.frontageLength,
    project.site.landscapedPermeableAreaM2
  );
  const pairwiseOverlap = calculateMassPairwiseIntersections(masses);
  const floorLimit = deriveScenarioFloorLimit({
    maximumHeightMeters: project.zoningLimits?.maxHeightMeters,
    maximumFAR: project.zoningLimits?.maxFAR,
    maximumCoveragePct: project.zoningLimits?.maxCoveragePct,
    floorToFloorHeight: getScenarioFloorToFloorHeight({ ...scenario, masses }),
  });
  const complianceReport = evaluateScenarioCompliance(
    project.site.grossSiteArea,
    setbacks,
    masses,
    metrics,
    pairwiseOverlap,
    {
      scenarioName: scenario.name,
      hasZoningEvidence: Boolean(project.site.hasZoningEvidence),
      maxFAR: project.zoningLimits?.maxFAR,
      maxCoveragePct: project.zoningLimits?.maxCoveragePct,
      minKDHPct: project.zoningLimits?.minKDHPct,
      maxHeightMeters: project.zoningLimits?.maxHeightMeters,
      maxFloors: floorLimit.kind === 'HEIGHT_DERIVED_LEGAL_MAXIMUM'
        ? floorLimit.floorCount ?? undefined
        : undefined,
      zoningName: project.zoningLimits?.zoneName,
      frontageLength: project.site.frontageLength,
      kdhAreaM2: project.site.landscapedPermeableAreaM2,
    }
  );
  const baselineMasses = scenario.originalMasses || scenario.masses;
  const next: DevelopmentScenario = {
    ...scenario,
    masses,
    metrics,
    pairwiseOverlap,
    complianceReport,
    originalMasses: flags?.reset ? scenario.originalMasses : baselineMasses,
    assumptionsUsed: {
      ...scenario.assumptionsUsed,
      setbacks,
      heightFloors: metrics.totalFloors,
      heightMeters: metrics.totalHeightMeters,
      targetFAR: metrics.farKLB,
      targetCoverageKDB: metrics.siteCoveragePercentage,
    },
    status: complianceReport.status,
    warningMessage: complianceReport.primaryWarning,
    isFittedOverride: flags?.fitted ? true : flags?.reset ? false : scenario.isFittedOverride,
    fitOverrideReason: flags?.fitted
      ? `Shifted and resized to achieve containment within the ${setbacks.front}m front setback envelope.`
      : flags?.reset
        ? undefined
        : scenario.fitOverrideReason,
    updatedAt: timestamp,
  };
  next.editClassification = flags?.reset
    ? 'BASE_CONCEPT'
    : detectScenarioEditClassification(next, { masses: baselineMasses });
  return next;
}

function reject(project: Project, code: CommandRejectionCode, reason: string): CanonicalCommandResult {
  return { accepted: false, project, code, reason };
}

export function executeCanonicalSpatialCommand(
  inputProject: Project,
  command: CanonicalSpatialCommand
): CanonicalCommandResult {
  const project = ensureCanonicalProjectRevisions(inputProject);
  if (command.caseId !== project.id) return reject(project, 'CASE_MISMATCH', 'Command case does not match the active project.');
  const scenarioIndex = project.scenarios.findIndex((item) => item.id === command.scenarioId);
  if (scenarioIndex < 0) return reject(project, 'SCENARIO_NOT_FOUND', 'Command scenario does not exist in this case.');
  const scenario = project.scenarios[scenarioIndex];
  const currentRevision = scenario.canonicalRevision;
  if (!currentRevision || command.expectedSourceRevisionId !== currentRevision.revisionId) {
    return reject(project, 'STALE_REVISION', 'Command expected a stale source revision.');
  }
  const payloadError = validateCommandPayload(command);
  if (payloadError) return reject(project, 'INVALID_PAYLOAD', payloadError);

  if (command.type === 'DUPLICATE_SCENARIO') {
    if (project.scenarios.some((item) => item.id === command.payload.newScenarioId)) {
      return reject(project, 'DUPLICATE_TARGET', 'The duplicated scenario ID already exists.');
    }
    const duplicated: DevelopmentScenario = {
      ...clone(scenario),
      id: command.payload.newScenarioId,
      projectId: project.id,
      name: command.payload.name,
      isPreferred: false,
      editClassification: 'USER_GEOMETRY_EDIT',
      createdAt: command.issuedAt,
      updatedAt: command.issuedAt,
      canonicalRevision: undefined,
    };
    duplicated.canonicalRevision = createRevision(duplicated, 0, command.id, currentRevision.revisionId, command.issuedAt);
    const nextProject = { ...project, scenarios: [...project.scenarios, duplicated], updatedAt: command.issuedAt };
    const committedCommand: CommittedSpatialCommand = {
      ...command,
      resultingRevisionId: duplicated.canonicalRevision.revisionId,
      resultingRevisionHash: duplicated.canonicalRevision.revisionHash,
      resultingRevisionSequence: 0,
    };
    return { accepted: true, project: nextProject, scenario: duplicated, committedCommand };
  }

  if (command.type === 'ACCEPT_SCHEME_PROPOSAL') {
    const proposal = scenario.proposal;
    if (!proposal || proposal.id !== command.payload.proposalId) {
      return reject(project, 'INVALID_PAYLOAD', 'The proposal is not attached to the requested scenario.');
    }
    const acceptedScenario = {
      ...scenario,
      isPreferred: true,
      updatedAt: command.issuedAt,
    };
    acceptedScenario.canonicalRevision = createRevision(
      acceptedScenario,
      currentRevision.sequence + 1,
      command.id,
      currentRevision.revisionId,
      command.issuedAt,
    );
    const scenarios = project.scenarios.map((candidate, index) => index === scenarioIndex
      ? acceptedScenario
      : { ...candidate, isPreferred: false });
    const nextProject = {
      ...project,
      scenarios,
      schemeGeneration: project.schemeGeneration
        ? {
            ...project.schemeGeneration,
            acceptedProposalId: proposal.id,
            status: 'READY' as const,
            taskmasterState: project.schemeGeneration.taskmasterRunId ? 'COMPLETED' : project.schemeGeneration.taskmasterState,
          }
        : project.schemeGeneration,
      updatedAt: command.issuedAt,
    };
    const committedCommand: CommittedSpatialCommand = {
      ...command,
      resultingRevisionId: acceptedScenario.canonicalRevision.revisionId,
      resultingRevisionHash: acceptedScenario.canonicalRevision.revisionHash,
      resultingRevisionSequence: acceptedScenario.canonicalRevision.sequence,
    };
    return { accepted: true, project: nextProject, scenario: acceptedScenario, committedCommand };
  }

  let masses = clone(scenario.masses);
  let setbacks = { ...scenario.assumptionsUsed.setbacks };
  let flags: { fitted?: boolean; reset?: boolean } | undefined;
  const massIndex = masses.findIndex((mass) => mass.id === command.targetId);
  const requiresMass = !['SET_MASS_TYPE_FLOORS', 'SET_SCENARIO_FLOORS', 'SET_SETBACKS', 'FIT_TO_ENVELOPE', 'RESET_SCENARIO', 'ACCEPT_SCHEME_PROPOSAL'].includes(command.type);
  if (requiresMass && command.type !== 'ADD_MASS' && command.type !== 'DUPLICATE_MASS' && massIndex < 0) {
    return reject(project, 'TARGET_NOT_FOUND', 'Command target mass does not exist in this scenario.');
  }
  if ((command.type === 'ADD_MASS' || command.type === 'DUPLICATE_MASS') && command.targetId !== command.payload.mass.id) {
    return reject(project, 'INVALID_PAYLOAD', 'Command target must match the proposed mass ID.');
  }
  if (command.type === 'DUPLICATE_MASS' && !masses.some((mass) => mass.id === command.payload.sourceMassId)) {
    return reject(project, 'TARGET_NOT_FOUND', 'The duplicate source mass does not exist in this scenario.');
  }

  switch (command.type) {
    case 'MOVE_MASS':
      masses[massIndex] = { ...masses[massIndex], position: { ...command.payload.position } };
      break;
    case 'RESIZE_MASS':
      masses[massIndex] = normalizeChangedMass({
        ...masses[massIndex],
        dimensions: {
          ...masses[massIndex].dimensions,
          width: command.payload.width,
          length: command.payload.length,
        },
      }, true);
      break;
    case 'SET_MASS_FLOORS':
      masses[massIndex] = normalizeChangedMass({ ...masses[massIndex], floors: command.payload.floors });
      break;
    case 'SET_MASS_TYPE_FLOORS': {
      const matchingMasses = masses.filter((mass) => mass.type === command.payload.massType);
      if (matchingMasses.length === 0) {
        return reject(project, 'TARGET_NOT_FOUND', `This scenario has no ${command.payload.massType.toLowerCase()} mass.`);
      }
      const previousPodiumTop = command.payload.massType === 'PODIUM'
        ? matchingMasses.reduce((top, mass) => Math.max(top, mass.position.y + mass.height), 0)
        : null;
      masses = masses.map((mass) => mass.type === command.payload.massType
        ? normalizeChangedMass({ ...mass, floors: command.payload.floors })
        : mass);
      if (previousPodiumTop !== null) {
        const nextPodiumTop = masses
          .filter((mass) => mass.type === 'PODIUM')
          .reduce((top, mass) => Math.max(top, mass.position.y + mass.height), 0);
        masses = masses.map((mass) => mass.type === 'TOWER'
          && Math.abs(mass.position.y - previousPodiumTop) <= 0.05
          ? { ...mass, position: { ...mass.position, y: nextPodiumTop } }
          : mass);
      }
      break;
    }
    case 'SET_FLOOR_TO_FLOOR_HEIGHT':
      masses[massIndex] = normalizeChangedMass({
        ...masses[massIndex],
        floorToFloorHeight: command.payload.floorToFloorHeight,
      });
      break;
    case 'SET_MASS_PROGRAM':
      masses[massIndex] = { ...masses[massIndex], program: command.payload.program };
      break;
    case 'ADD_MASS':
    case 'DUPLICATE_MASS':
      if (masses.some((mass) => mass.id === command.payload.mass.id)) {
        return reject(project, 'DUPLICATE_TARGET', 'The proposed mass ID already exists.');
      }
      masses.push(normalizeChangedMass(clone(command.payload.mass)));
      break;
    case 'DELETE_MASS':
      if (masses.length <= 1) return reject(project, 'INVALID_PAYLOAD', 'A scenario must retain at least one mass.');
      masses.splice(massIndex, 1);
      break;
    case 'SET_SCENARIO_FLOORS': {
      const hasPodium = masses.some((mass) => mass.type === 'PODIUM');
      masses = masses.map((mass) => normalizeChangedMass({
          ...mass,
          floors: mass.type === 'PODIUM'
            ? Math.min(2, command.payload.floors)
            : Math.max(1, command.payload.floors - (hasPodium ? 2 : 0)),
        }));
      break;
    }
    case 'SET_SETBACKS':
      setbacks = { ...command.payload.setbacks };
      break;
    case 'FIT_TO_ENVELOPE':
      masses = fitMassesToBuildableEnvelope(
        project.site.grossSiteArea,
        setbacks,
        masses,
        project.site.frontageLength
      );
      flags = { fitted: true };
      break;
    case 'RESET_SCENARIO':
      masses = clone(scenario.originalMasses || scenario.masses);
      flags = { reset: true };
      break;
  }

  const nextScenario = deriveScenario(project, scenario, masses, setbacks, command.issuedAt, flags);
  if (computeCanonicalScenarioHash(nextScenario) === currentRevision.revisionHash) {
    return reject(project, 'NO_CHANGE', 'Command does not change canonical scenario state.');
  }
  const sequence = currentRevision.sequence + 1;
  nextScenario.canonicalRevision = createRevision(
    nextScenario,
    sequence,
    command.id,
    currentRevision.revisionId,
    command.issuedAt
  );
  const scenarios = [...project.scenarios];
  scenarios[scenarioIndex] = nextScenario;
  const nextProject = { ...project, scenarios, updatedAt: command.issuedAt };
  const committedCommand: CommittedSpatialCommand = {
    ...command,
    resultingRevisionId: nextScenario.canonicalRevision.revisionId,
    resultingRevisionHash: nextScenario.canonicalRevision.revisionHash,
    resultingRevisionSequence: sequence,
  };
  return { accepted: true, project: nextProject, scenario: nextScenario, committedCommand };
}

function historyKey(caseId: string, scenarioId: string): string {
  return `${caseId}::${scenarioId}`;
}

function restoreScenario(
  project: Project,
  snapshot: DevelopmentScenario,
  commandId: string,
  timestamp: string
): HistoryTransitionResult {
  const index = project.scenarios.findIndex((scenario) => scenario.id === snapshot.id);
  if (index < 0) return { accepted: false, project, reason: 'History scenario no longer exists.' };
  const current = ensureCanonicalScenarioRevision(project.scenarios[index]);
  const restored = clone(snapshot);
  const nextSequence = (current.canonicalRevision?.sequence ?? 0) + 1;
  restored.updatedAt = timestamp;
  restored.canonicalRevision = createRevision(
    restored,
    nextSequence,
    commandId,
    current.canonicalRevision?.revisionId ?? null,
    timestamp
  );
  const scenarios = [...project.scenarios];
  scenarios[index] = restored;
  return {
    accepted: true,
    project: { ...project, scenarios, updatedAt: timestamp },
    revision: restored.canonicalRevision,
  };
}

export class CanonicalSpatialCommandService {
  private histories = new Map<string, ScopedHistory>();
  private acceptedCommandIds = new Set<string>();

  constructor(private readonly persist: (nextProject: Project) => boolean) {}

  private history(caseId: string, scenarioId: string): ScopedHistory {
    const key = historyKey(caseId, scenarioId);
    const existing = this.histories.get(key);
    if (existing) return existing;
    const created = { undo: [], redo: [] };
    this.histories.set(key, created);
    return created;
  }

  execute(project: Project, command: CanonicalSpatialCommand): CanonicalCommandResult {
    if (this.acceptedCommandIds.has(command.id)) {
      return reject(project, 'DUPLICATE_COMMAND', 'This command ID has already been committed.');
    }
    const before = ensureCanonicalProjectRevisions(project);
    const beforeScenario = before.scenarios.find((scenario) => scenario.id === command.scenarioId);
    const result = executeCanonicalSpatialCommand(before, command);
    if (!result.accepted || !beforeScenario) return result;
    if (!this.persist(result.project)) {
      return reject(project, 'PERSISTENCE_FAILED', 'The canonical project could not be persisted.');
    }

    this.acceptedCommandIds.add(command.id);
    const scoped = this.history(command.caseId, command.scenarioId);
    scoped.undo.push({
      command: clone(command),
      beforeScenario: clone(beforeScenario),
      afterScenario: clone(result.scenario),
      duplicatedScenarioId: command.type === 'DUPLICATE_SCENARIO' ? result.scenario.id : undefined,
    });
    scoped.redo = [];
    return result;
  }

  canUndo(caseId: string, scenarioId: string): boolean {
    return this.history(caseId, scenarioId).undo.length > 0;
  }

  canRedo(caseId: string, scenarioId: string): boolean {
    return this.history(caseId, scenarioId).redo.length > 0;
  }

  undo(
    project: Project,
    caseId: string,
    scenarioId: string,
    timestamp = new Date().toISOString()
  ): HistoryTransitionResult {
    if (project.id !== caseId) return { accepted: false, project, reason: 'History case does not match the active project.' };
    const scoped = this.history(caseId, scenarioId);
    const entry = scoped.undo.at(-1);
    if (!entry) return { accepted: false, project, reason: 'No command is available to undo in this scope.' };
    const currentScenario = project.scenarios.find((scenario) => scenario.id === scenarioId);
    const lineageMatches = entry.duplicatedScenarioId
      ? currentScenario?.canonicalRevision?.revisionId === entry.beforeScenario.canonicalRevision?.revisionId
        && project.scenarios.find((scenario) => scenario.id === entry.duplicatedScenarioId)
          ?.canonicalRevision?.revisionId === entry.afterScenario.canonicalRevision?.revisionId
      : currentScenario?.canonicalRevision?.revisionId === entry.afterScenario.canonicalRevision?.revisionId;
    if (!lineageMatches) {
      return { accepted: false, project, reason: 'History diverged from the revision produced by this command.' };
    }

    let transition: HistoryTransitionResult;
    if (entry.duplicatedScenarioId) {
      const withoutDuplicate = {
        ...project,
        scenarios: project.scenarios.filter((scenario) => scenario.id !== entry.duplicatedScenarioId),
      };
      transition = restoreScenario(withoutDuplicate, entry.beforeScenario, `undo:${entry.command.id}`, timestamp);
    } else {
      transition = restoreScenario(project, entry.beforeScenario, `undo:${entry.command.id}`, timestamp);
    }
    if (!transition.accepted) {
      return transition;
    }
    if (!this.persist(transition.project)) {
      return { accepted: false, project, reason: 'The undo result could not be persisted.' };
    }
    entry.undoRevisionId = transition.revision?.revisionId;
    scoped.undo.pop();
    const nextUndo = scoped.undo.at(-1);
    if (nextUndo) {
      const restoredScenario = transition.project.scenarios.find((item) => item.id === scenarioId);
      if (restoredScenario) {
        if (nextUndo.duplicatedScenarioId) nextUndo.beforeScenario = clone(restoredScenario);
        else nextUndo.afterScenario = clone(restoredScenario);
      }
      if (nextUndo.duplicatedScenarioId) {
        const restoredDuplicate = transition.project.scenarios.find(
          (item) => item.id === nextUndo.duplicatedScenarioId,
        );
        if (restoredDuplicate) nextUndo.afterScenario = clone(restoredDuplicate);
      }
    }
    scoped.redo.push(entry);
    return transition;
  }

  redo(
    project: Project,
    caseId: string,
    scenarioId: string,
    timestamp = new Date().toISOString()
  ): HistoryTransitionResult {
    if (project.id !== caseId) return { accepted: false, project, reason: 'History case does not match the active project.' };
    const scoped = this.history(caseId, scenarioId);
    const entry = scoped.redo.at(-1);
    if (!entry) return { accepted: false, project, reason: 'No command is available to redo in this scope.' };
    const scenario = project.scenarios.find((item) => item.id === scenarioId);
    if (!scenario?.canonicalRevision) {
      return { accepted: false, project, reason: 'The scenario has no canonical revision.' };
    }
    if (!entry.undoRevisionId || scenario.canonicalRevision.revisionId !== entry.undoRevisionId) {
      return { accepted: false, project, reason: 'History diverged from the revision produced by undo.' };
    }
    const replay = {
      ...clone(entry.command),
      id: `redo:${entry.command.id}:${scenario.canonicalRevision.sequence + 1}`,
      expectedSourceRevisionId: scenario.canonicalRevision.revisionId,
      issuedAt: timestamp,
      source: 'SYSTEM' as const,
    };
    const result = executeCanonicalSpatialCommand(project, replay);
    if (!result.accepted) {
      return { accepted: false, project, reason: result.reason };
    }
    if (!this.persist(result.project)) {
      return { accepted: false, project, reason: 'The redo result could not be persisted.' };
    }
    scoped.redo.pop();
    const nextRedo = scoped.redo.at(-1);
    if (nextRedo) nextRedo.undoRevisionId = result.scenario.canonicalRevision?.revisionId;
    this.acceptedCommandIds.add(replay.id);
    scoped.undo.push({
      command: entry.command,
      beforeScenario: clone(scenario),
      afterScenario: clone(result.scenario),
      duplicatedScenarioId: entry.duplicatedScenarioId,
    });
    return { accepted: true, project: result.project, revision: result.scenario.canonicalRevision };
  }

  clearCase(caseId: string): void {
    for (const key of this.histories.keys()) {
      if (key.startsWith(`${caseId}::`)) this.histories.delete(key);
    }
  }
}

let commandCounter = 0;

export function createCanonicalCommandId(prefix: string): string {
  commandCounter += 1;
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${commandCounter}`;
  return `${prefix}:${randomId}`;
}
