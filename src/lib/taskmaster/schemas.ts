import { z } from 'zod';
import type { SchemeGenerationInput, SchemeGenerationResult } from '@/lib/schemes/proposal-contract';

export const taskmasterRunStateSchema = z.enum([
  'QUEUED',
  'PLANNING',
  'EXECUTING_TOOLS',
  'VALIDATING',
  'AWAITING_APPROVAL',
  'APPLYING',
  'VERIFYING',
  'COMPLETED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'BLOCKED_STALE',
  'REJECTED',
  'CANCELLED',
]);

export type TaskmasterRunState = z.infer<typeof taskmasterRunStateSchema>;

export const taskmasterToolNameSchema = z.enum([
  'get_opportunity_context',
  'get_site_and_planning_inputs',
  'list_assumptions_and_missing_information',
  'calculate_buildable_envelope',
  'simulate_development_scheme',
  'compare_development_schemes',
  'get_scheme_planning_checks',
  'prepare_scheme_proposals',
]);

export type TaskmasterToolName = z.infer<typeof taskmasterToolNameSchema>;

export const taskmasterInputSchema = z.object({
  opportunityId: z.string().min(1),
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  objective: z.string().min(1).max(2000),
  siteAreaM2: z.number().finite().positive(),
  frontageMeters: z.number().finite().positive(),
  depthMeters: z.number().finite().positive(),
  existingAsset: z.object({
    gfa: z.number().finite().nonnegative(),
    floors: z.number().int().positive().optional(),
    description: z.string().max(500).optional(),
    currentStatus: z.string().max(200).optional(),
  }).optional(),
  landscapedPermeableAreaM2: z.number().finite().nonnegative().optional(),
  planningLimits: z.object({
    maxFAR: z.number().finite().nonnegative().optional(),
    maxCoveragePct: z.number().finite().min(0).max(100).optional(),
    minKDHPct: z.number().finite().min(0).max(100).optional(),
    maxHeightMeters: z.number().finite().positive().optional(),
    setbacks: z.object({
      front: z.number().finite().nonnegative(),
      rear: z.number().finite().nonnegative(),
      sideLeft: z.number().finite().nonnegative(),
      sideRight: z.number().finite().nonnegative(),
    }),
  }),
  studyVersion: z.string().min(1).max(100),
  inputHash: z.string().min(1).max(100),
  priorities: z.object({
    existingBuildingRetention: z.enum(['retain', 'adapt', 'partial', 'replace']),
    developmentYield: z.enum(['conservative', 'balanced', 'maximum']),
    publicRealm: z.enum(['standard', 'strong', 'generous']),
    programMix: z.string().trim().min(1).max(500),
    phasing: z.enum(['single_phase', 'phased']),
    planningRiskTolerance: z.enum(['low', 'medium', 'high']),
    investmentHorizon: z.enum(['short', 'medium', 'long']),
    allowNonCompliantStretch: z.boolean(),
  }),
});

export type TaskmasterInput = z.infer<typeof taskmasterInputSchema> & Pick<SchemeGenerationInput, 'priorities'>;

export const taskmasterPlanStepSchema = z.object({
  id: z.string().min(1),
  tool: taskmasterToolNameSchema,
  purpose: z.string().min(1).max(400),
  input: z.record(z.string(), z.unknown()).default({}),
});

export const taskmasterPlanSchema = z.object({
  version: z.literal('1'),
  goal: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(1200),
  steps: z.array(taskmasterPlanStepSchema).min(5).max(12),
});

export type TaskmasterPlan = z.infer<typeof taskmasterPlanSchema>;

export const taskmasterToolActivitySchema = z.object({
  id: z.string().min(1),
  name: taskmasterToolNameSchema,
  input: z.record(z.string(), z.unknown()),
  result: z.unknown(),
  startedAt: z.string(),
  completedAt: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
});

export type TaskmasterToolActivity = z.infer<typeof taskmasterToolActivitySchema>;

export const taskmasterApprovalSchema = z.object({
  proposalId: z.string().min(1),
  approvedAt: z.string(),
  approvedBy: z.string().min(1),
  expectedStudyVersion: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
});

export type TaskmasterApproval = z.infer<typeof taskmasterApprovalSchema>;

export interface TaskmasterSimulation {
  proposalId: string;
  totalGFA: number;
  farKLB: number;
  coverageKDB: number;
  heightMeters: number;
  totalFloors: number;
  buildableAreaM2: number;
  landscapedPermeableAreaM2?: number;
  kdhDemonstrated: boolean;
  planningStatus: 'WITHIN_SUPPLIED_LIMITS' | 'OUTSIDE_SUPPLIED_LIMITS';
  warnings: string[];
  assumptions: string[];
}

export interface TaskmasterCompletionReport {
  summary: string;
  acceptedProposalId?: string;
  acceptedStudyVersion?: string;
  generatedAt: string;
  provider: string;
  model: string;
  modelCalled: boolean;
  toolCount: number;
  warnings: string[];
}

export interface TaskmasterRunRecord {
  runId: string;
  correlationId: string;
  idempotencyKey: string;
  opportunityId: string;
  sourceStudyVersion: string;
  inputHash: string;
  goal: string;
  input: TaskmasterInput;
  state: TaskmasterRunState;
  /** Monotonic Firestore transaction revision used for optimistic concurrency. */
  revision: number;
  currentStep?: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  plan?: TaskmasterPlan;
  activities: TaskmasterToolActivity[];
  generation?: SchemeGenerationResult;
  simulations?: TaskmasterSimulation[];
  approval?: TaskmasterApproval;
  completionReport?: TaskmasterCompletionReport;
  error?: string;
  provider: string;
  model: string;
  modelCalled: boolean;
  modelCallCount: number;
  disclosure: string;
  taskName?: string;
  lastTaskDeliveryId?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  expiresAt?: string;
}

export type PublicTaskmasterRun = Pick<TaskmasterRunRecord,
  'runId' | 'correlationId' | 'opportunityId' | 'sourceStudyVersion' | 'inputHash' | 'state' | 'currentStep' |
  'progress' | 'createdAt' | 'updatedAt' | 'retryCount' | 'plan' | 'activities' | 'generation' |
  'simulations' | 'approval' | 'completionReport' | 'error' | 'provider' | 'model' | 'modelCalled' |
  'modelCallCount' | 'disclosure'>;

export function toPublicTaskmasterRun(run: TaskmasterRunRecord): PublicTaskmasterRun {
  return {
    runId: run.runId,
    correlationId: run.correlationId,
    opportunityId: run.opportunityId,
    sourceStudyVersion: run.sourceStudyVersion,
    inputHash: run.inputHash,
    state: run.state,
    currentStep: run.currentStep,
    progress: run.progress,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    retryCount: run.retryCount,
    plan: run.plan,
    activities: run.activities,
    generation: run.generation,
    simulations: run.simulations,
    approval: run.approval,
    completionReport: run.completionReport,
    error: run.error,
    provider: run.provider,
    model: run.model,
    modelCalled: run.modelCalled,
    modelCallCount: run.modelCallCount,
    disclosure: run.disclosure,
  };
}

export const allowedTaskmasterTransitions: Record<TaskmasterRunState, readonly TaskmasterRunState[]> = {
  QUEUED: ['PLANNING', 'CANCELLED', 'FAILED_RETRYABLE'],
  PLANNING: ['EXECUTING_TOOLS', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED'],
  EXECUTING_TOOLS: ['VALIDATING', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED'],
  VALIDATING: ['AWAITING_APPROVAL', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  AWAITING_APPROVAL: ['APPLYING', 'REJECTED', 'CANCELLED', 'BLOCKED_STALE'],
  APPLYING: ['VERIFYING', 'BLOCKED_STALE', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  VERIFYING: ['COMPLETED', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
  COMPLETED: [],
  FAILED_RETRYABLE: ['QUEUED', 'CANCELLED', 'FAILED_FINAL'],
  FAILED_FINAL: [],
  BLOCKED_STALE: [],
  REJECTED: [],
  CANCELLED: [],
};

export function assertTaskmasterTransition(from: TaskmasterRunState, to: TaskmasterRunState): void {
  if (!allowedTaskmasterTransitions[from].includes(to)) {
    throw new Error(`Invalid Taskmaster transition ${from} → ${to}.`);
  }
}
