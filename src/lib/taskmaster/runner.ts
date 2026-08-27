import { randomUUID } from 'node:crypto';
import { createStudyTemplateProposals, generateSchemeProposals, reconcileSchemeProposals, validateSchemeProposals, type SchemeGenerationResult } from '@/lib/schemes/proposal-contract';
import { getAiConfig } from '@/lib/ai/config';
import {
  allowedTaskmasterTransitions,
  assertTaskmasterTransition,
  taskmasterInputSchema,
  taskmasterPlanSchema,
  type PublicTaskmasterRun,
  type TaskmasterApproval,
  type TaskmasterInput,
  type TaskmasterRunRecord,
  type TaskmasterRunState,
  type TaskmasterToolActivity,
  toPublicTaskmasterRun,
} from './schemas';
import { getTaskmasterRunRepository, type TaskmasterRunRepository } from './repository';
import { buildDeterministicTaskmasterPlan, runAdkPlan, taskmasterModelDisclosure } from './adk-agent';
import { executeTaskmasterTool, type TaskmasterToolContext } from './tools';
import { withProviderBudget } from './provider-budget';
import { ProviderAdapterError } from './provider-adapter';

const activeExecutions = new Set<string>();

export function authoritativeModelMetadata(
  usage: TaskmasterRunRecord['providerUsage'],
): Pick<TaskmasterRunRecord, 'provider' | 'model' | 'modelCalled' | 'modelCallCount' | 'disclosure'> {
  const modelOutputs = usage.modelOutputsReceived || 0;
  const modelCalled = modelOutputs > 0;
  if ((usage.providerRequests || 0) === 0) return { ...taskmasterModelDisclosure(false), modelCallCount: 0 };
  if (!modelCalled) return {
    provider: usage.provider || 'VERTEX_AI',
    model: 'No usable model response',
    modelCalled: false,
    modelCallCount: 0,
    disclosure: 'Gemini request failed before a usable response.',
  };
  const disclosure = usage.outcome === 'VALIDATED_STRATEGIES'
    ? 'Gemini generated three validated strategies. SitePilot independently calculated and checked all authoritative planning figures.'
    : 'Gemini returned an invalid proposal. No model proposal was accepted or persisted.';
  return {
    provider: usage.provider || 'VERTEX_AI',
    model: usage.actualModel || usage.requestedModel || 'Gemini model',
    modelCalled: true,
    modelCallCount: modelOutputs,
    disclosure,
  };
}

async function recordSchemaAccepted(
  repository: TaskmasterRunRepository,
  runId: string,
  validatedStrategies = false,
): Promise<void> {
  const usage = await repository.getProviderUsage(runId);
  await repository.recordProviderUsage(runId, {
    modelOutputsSchemaAccepted: (usage?.modelOutputsSchemaAccepted || 0) + 1,
    outcome: validatedStrategies ? 'VALIDATED_STRATEGIES' : (usage?.outcome || 'OUTPUT_INVALID'),
    failureCode: null,
  });
}

function now(): string {
  return new Date().toISOString();
}

function transition(run: TaskmasterRunRecord, state: TaskmasterRunState, currentStep?: string): TaskmasterRunRecord {
  assertTaskmasterTransition(run.state, state);
  return { ...run, state, currentStep, updatedAt: now() };
}

function progressFor(state: TaskmasterRunState, stepIndex = 0, stepCount = 1): number {
  if (state === 'QUEUED') return 0;
  if (state === 'PLANNING') return 12;
  if (state === 'EXECUTING_TOOLS') return Math.min(68, 18 + Math.round((stepIndex / Math.max(1, stepCount)) * 50));
  if (state === 'VALIDATING') return 76;
  if (state === 'AWAITING_APPROVAL') return 86;
  if (state === 'APPLYING') return 91;
  if (state === 'VERIFYING') return 96;
  return ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(state) ? 100 : 0;
}

export function createTaskmasterRun(input: TaskmasterInput, goal: string, idempotencyKey: string = randomUUID(), forceFallback = false): TaskmasterRunRecord {
  const validated = taskmasterInputSchema.parse(input);
  const disclosure = taskmasterModelDisclosure(false);
  const timestamp = now();
  return {
    runId: `tm-${randomUUID()}`,
    correlationId: `corr-${randomUUID()}`,
    idempotencyKey,
    opportunityId: validated.opportunityId,
    sourceStudyVersion: validated.studyVersion,
    inputHash: validated.inputHash,
    goal: goal.trim() || validated.objective,
    input: validated,
    state: 'QUEUED',
    revision: 0,
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    retryCount: 0,
    activities: [],
    provider: disclosure.provider,
    model: disclosure.model,
    modelCalled: disclosure.modelCalled,
    modelCallCount: 0,
    disclosure: disclosure.disclosure,
    forceFallback,
    providerUsage: {
      providerRequests: 0,
      successfulProviderRequests: 0,
      providerResponses: 0,
      modelOutputsReceived: 0,
      modelOutputsSchemaAccepted: 0,
      repairRequests: 0,
      outcome: 'NO_REQUEST',
      promptTokens: 0,
      candidateTokens: 0,
      toolUsePromptTokens: 0,
      thoughtTokens: 0,
      totalTokens: 0,
      modelLatencyMs: 0,
      repairCount: 0,
      costConfigVersion: process.env.TASKMASTER_COST_CONFIG_VERSION || '2026-08-sitepilot-v1',
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function auditTaskmaster(run: TaskmasterRunRecord, event: string): void {
  console.info(JSON.stringify({
    service: 'sitepilot-taskmaster',
    event,
    runId: run.runId,
    correlationId: run.correlationId,
    state: run.state,
    provider: run.provider,
    model: run.model,
    modelCalled: run.modelCalled,
    providerOutcome: run.providerUsage.outcome,
    providerRequests: run.providerUsage.providerRequests,
    providerResponses: run.providerUsage.providerResponses,
    modelOutputsReceived: run.providerUsage.modelOutputsReceived,
    modelOutputsSchemaAccepted: run.providerUsage.modelOutputsSchemaAccepted,
    failureCode: run.providerUsage.failureCode,
  }));
}

async function appendActivity(
  repository: TaskmasterRunRepository,
  run: TaskmasterRunRecord,
  activity: TaskmasterToolActivity,
): Promise<TaskmasterRunRecord> {
  const next = { ...run, activities: [...run.activities, activity], updatedAt: now() };
  return repository.save(next);
}

export async function executeTaskmasterRun(
  runId: string,
  repository?: TaskmasterRunRepository,
  deliveryId: string = randomUUID(),
): Promise<PublicTaskmasterRun | undefined> {
  repository ||= await getTaskmasterRunRepository();
  if (activeExecutions.has(runId)) return undefined;
  activeExecutions.add(runId);
  const executionStartedAt = Date.now();
  const maxDurationMs = Number(process.env.TASKMASTER_MAX_DURATION_MS || 30000);
  const leaseOwner = `${process.env.K_REVISION || 'local'}:${deliveryId}`;
  const maxModelCalls = Number(process.env.TASKMASTER_MAX_MODEL_CALLS || 2);
  let modelCalls = 0;
  try {
    let run = await repository.get(runId);
    if (!run) return undefined;
    const leased = await repository.acquireLease(runId, leaseOwner, maxDurationMs + 5000);
    if (!leased) return toPublicTaskmasterRun(run);
    run = leased;
    auditTaskmaster(run, 'delivery_started');
    if (['COMPLETED', 'FAILED_FINAL', 'BLOCKED_STALE', 'REJECTED', 'CANCELLED', 'AWAITING_APPROVAL'].includes(run.state)) {
      return toPublicTaskmasterRun(run);
    }
    if (run.lastTaskDeliveryId === deliveryId && run.state === 'EXECUTING_TOOLS') return toPublicTaskmasterRun(run);
    run = { ...run, lastTaskDeliveryId: deliveryId };
    run = await repository.save(run);

    try {
      if (run.state === 'FAILED_RETRYABLE') {
        run = transition(run, 'QUEUED', 'Retrying from persisted checkpoint');
        run = { ...run, retryCount: run.retryCount + 1, error: undefined };
        run = await repository.save(run);
      }
      if (run.state === 'QUEUED') {
        run = transition(run, 'PLANNING', 'Preparing site and planning inputs');
        run = { ...run, progress: progressFor(run.state) };
        run = await repository.save(run);
      }

      const context: TaskmasterToolContext = { input: run.input, proposals: [], simulations: [] };
      const executionRun = run;
      let plan = run.plan;
      let modelGeneration: SchemeGenerationResult | undefined;
      const liveAllowed = !run.forceFallback && process.env.TASKMASTER_ALLOW_LIVE_MODEL === 'true' && getAiConfig().provider !== 'LOCAL_DEVELOPMENT';
      if (!plan) {
        try {
          if (liveAllowed) {
            if (modelCalls >= maxModelCalls) throw new Error(`Taskmaster exceeded the ${maxModelCalls}-model-call limit.`);
            plan = await withProviderBudget(executionRun.runId, repository, () => runAdkPlan(executionRun.input, context, {
              runId: executionRun.runId,
              correlationId: executionRun.correlationId,
            }));
            await recordSchemaAccepted(repository, executionRun.runId);
            modelCalls += 1;
          } else {
            plan = buildDeterministicTaskmasterPlan(run.goal);
          }
          taskmasterPlanSchema.parse(plan);
        } catch (error) {
          // A model planning error is retryable, but local development remains honest and usable.
          if (liveAllowed) throw error;
          plan = buildDeterministicTaskmasterPlan(run.goal);
        }
        const providerUsage = (await repository.getProviderUsage(run.runId)) || run.providerUsage;
        run = {
          ...run,
          plan,
          currentStep: 'Executing bounded read-only tools',
          providerUsage,
          ...authoritativeModelMetadata(providerUsage),
        };
        run = await repository.save(run);
      }

      if (liveAllowed) {
        if (modelCalls >= maxModelCalls) throw new Error(`Taskmaster exceeded the ${maxModelCalls}-model-call limit.`);
        modelGeneration = await withProviderBudget(executionRun.runId, repository, () => generateSchemeProposals(executionRun.input, {
          identifiers: { runId: executionRun.runId, correlationId: executionRun.correlationId },
          onRepairAttempt: async () => {
            const recorded = await repository!.getProviderUsage(executionRun.runId);
            await repository!.recordProviderUsage(executionRun.runId, {
              repairCount: (recorded?.repairCount || 0) + 1,
              repairRequests: (recorded?.repairRequests || 0) + 1,
            });
          },
          onSchemaAccepted: () => recordSchemaAccepted(repository!, executionRun.runId, true),
        }));
        modelCalls += 1;
        if (modelGeneration.modelCalled) context.proposals = modelGeneration.proposals;
        const providerUsage = (await repository.getProviderUsage(run.runId)) || run.providerUsage;
        run = { ...run, providerUsage, ...authoritativeModelMetadata(providerUsage) };
        run = await repository.save(run);
      } else if (run.forceFallback) {
        context.proposals = createStudyTemplateProposals(run.input);
      }

      run = transition(run, 'EXECUTING_TOOLS', 'Executing bounded read-only tools');
      run = { ...run, progress: progressFor(run.state, 0, plan.steps.length) };
      run = await repository.save(run);

      const maxToolCalls = Number(process.env.TASKMASTER_MAX_TOOL_CALLS || 16);
      if (plan.steps.length > maxToolCalls) throw new Error(`Taskmaster plan exceeds the ${maxToolCalls}-tool limit.`);
      for (let index = 0; index < plan.steps.length; index += 1) {
        if (Date.now() - executionStartedAt > maxDurationMs) throw new Error(`Taskmaster exceeded the ${maxDurationMs}ms execution limit.`);
        const step = plan.steps[index];
        const startedAt = now();
        const toolInput = { ...step.input };
        if (step.tool === 'simulate_development_scheme' && typeof toolInput.proposalId === 'string' && ['A', 'B', 'C'].includes(toolInput.proposalId)) {
          const proposal = context.proposals['ABC'.indexOf(toolInput.proposalId)];
          if (proposal) toolInput.proposalId = proposal.id;
        }
        let activity: TaskmasterToolActivity;
        try {
          const result = executeTaskmasterTool(step.tool, context, toolInput);
          activity = { id: `${run.runId}-${step.id}`, name: result.tool, input: toolInput, result: result.result, startedAt, completedAt: now(), ok: true };
        } catch (error) {
          activity = { id: `${run.runId}-${step.id}`, name: step.tool, input: toolInput, result: null, startedAt, completedAt: now(), ok: false, error: error instanceof Error ? error.message : 'Tool failed.' };
          run = await appendActivity(repository, run, activity);
          throw error;
        }
        run = await appendActivity(repository, run, activity);
        run = { ...run, currentStep: step.purpose, progress: progressFor(run.state, index + 1, plan.steps.length) };
        run = await repository.save(run);
      }

      // Plans are model-controlled, but the final proposal set is always
      // independently validated and falls back only to explicit templates.
      if (context.proposals.length !== 3) {
        const prepare = executeTaskmasterTool('prepare_scheme_proposals', context).result as { proposals: unknown };
        context.proposals = (prepare.proposals as typeof context.proposals);
      }
      const draftValidation = validateSchemeProposals(context.proposals, run.input);
      if (!draftValidation.valid) throw new Error(draftValidation.errors.join(' '));
      context.proposals = draftValidation.proposals;
      if (context.simulations.length !== 3) {
        for (const proposal of context.proposals) executeTaskmasterTool('simulate_development_scheme', context, { proposalId: proposal.id });
      }
      if (context.simulations.some((simulation) => simulation.planningStatus !== 'WITHIN_SUPPLIED_LIMITS')) {
        throw new Error('One or more proposals failed deterministic planning checks; no studies were made ready for approval.');
      }
      context.proposals = reconcileSchemeProposals(context.proposals, context.simulations);
      context.simulations = context.simulations.map((simulation) => ({
        ...simulation,
        programGFAByUse: context.proposals.find((proposal) => proposal.id === simulation.proposalId)?.programGFAByUse,
      }));
      const validation = validateSchemeProposals(context.proposals, run.input, 'RECONCILED');
      if (!validation.valid) throw new Error(validation.errors.join(' '));

      run = transition(run, 'VALIDATING', 'Checking geometry and planning limits');
      const providerUsage = (await repository.getProviderUsage(run.runId)) || run.providerUsage;
      const modelMetadata = authoritativeModelMetadata(providerUsage);
      const generation: SchemeGenerationResult = {
        provider: modelMetadata.provider as SchemeGenerationResult['provider'],
        model: modelMetadata.model,
        modelCalled: modelMetadata.modelCalled,
        disclosure: modelMetadata.disclosure,
        generatedAt: now(),
        opportunityId: run.input.opportunityId,
        sourceStudyVersion: run.input.studyVersion,
        inputHash: run.input.inputHash,
        userPriorities: run.input.priorities,
        assumptions: validation.proposals.flatMap((proposal) => proposal.assumptionsIntroduced),
        proposals: validation.proposals,
        validation: { valid: true, errors: [] },
        qualityGate: modelGeneration?.qualityGate || {
          distinctnessPassed: validation.distinctnessPassed,
          repairAttempted: false,
          repairSucceeded: false,
        },
      };
      run = { ...run, generation, simulations: context.simulations, providerUsage, ...modelMetadata };
      run = transition(run, 'AWAITING_APPROVAL', 'Ready for human review');
      run = { ...run, progress: progressFor(run.state) };
      run = await repository.save(run);
      auditTaskmaster(run, 'awaiting_approval');
      return toPublicTaskmasterRun(run);
    } catch (error) {
      if (error instanceof ProviderAdapterError) {
        const recorded = await repository.getProviderUsage(run.runId);
        await repository.recordProviderUsage(run.runId, {
          failureCode: error.code,
          outcome: (recorded?.modelOutputsReceived || 0) > 0 ? 'OUTPUT_INVALID' : 'REQUEST_FAILED',
        });
      }
      const message = error instanceof Error ? error.message : 'Taskmaster execution failed.';
      const retryable = run.retryCount < Number(process.env.TASKMASTER_MAX_RETRIES || 2);
      const nextState: TaskmasterRunState = retryable ? 'FAILED_RETRYABLE' : 'FAILED_FINAL';
      if (allowedTaskmasterTransitions[run.state].includes(nextState)) {
        const providerUsage = (await repository.getProviderUsage(run.runId)) || run.providerUsage;
        run = transition(run, nextState, 'Taskmaster execution failed');
        run = { ...run, error: message, progress: 0, providerUsage, ...authoritativeModelMetadata(providerUsage) };
        run = await repository.save(run);
        auditTaskmaster(run, 'execution_failed');
      }
      return toPublicTaskmasterRun(run);
    }
  } finally {
    await repository.releaseLease(runId, leaseOwner).catch(() => undefined);
    activeExecutions.delete(runId);
  }
}

export async function approveTaskmasterRun(
  runId: string,
  proposalId: string,
  expectedStudyVersion: string,
  approvedBy = 'local-user',
  repository?: TaskmasterRunRepository,
): Promise<TaskmasterRunRecord> {
  repository ||= await getTaskmasterRunRepository();
  const run = await repository.get(runId);
  if (!run) throw new Error('Taskmaster run was not found.');
  if (run.state !== 'AWAITING_APPROVAL') throw new Error(`Run is ${run.state}; approval is not available.`);
  if (run.sourceStudyVersion !== expectedStudyVersion) {
    const blocked = transition(run, 'BLOCKED_STALE', 'Source study changed before approval');
    await repository.save(blocked);
    throw new Error('The source study is stale. Regenerate before accepting this proposal.');
  }
  if (!run.generation?.proposals.some((proposal) => proposal.id === proposalId)) throw new Error('The requested proposal is not part of this run.');
  const approval: TaskmasterApproval = { proposalId, approvedAt: now(), approvedBy, expectedStudyVersion, decision: 'APPROVED' };
  const applying = transition({ ...run, approval }, 'APPLYING', 'Applying accepted study through the user command boundary');
  return repository.save(applying);
}

export async function completeApprovedTaskmasterRun(
  runId: string,
  acceptedStudyVersion: string,
  repository?: TaskmasterRunRepository,
): Promise<TaskmasterRunRecord> {
  repository ||= await getTaskmasterRunRepository();
  const run = await repository.get(runId);
  if (!run) throw new Error('Taskmaster run was not found.');
  if (run.state !== 'APPLYING' || !run.approval || run.approval.decision !== 'APPROVED') throw new Error('The run is not awaiting application completion.');
  if (acceptedStudyVersion !== run.sourceStudyVersion) {
    const blocked = transition(run, 'BLOCKED_STALE', 'Accepted study version did not match the run source');
    await repository.save(blocked);
    throw new Error('Accepted study version is stale.');
  }
  let next = transition(run, 'VERIFYING', 'Recalculating accepted study');
  next = { ...next, progress: progressFor(next.state) };
  next = await repository.save(next);
  next = transition(next, 'COMPLETED', 'Taskmaster workflow complete');
  next = {
    ...next,
    progress: 100,
    completionReport: {
      summary: 'Three proposals were independently simulated and one was accepted through the existing user approval boundary.',
      acceptedProposalId: run.approval.proposalId,
      acceptedStudyVersion,
      generatedAt: now(),
      provider: run.provider,
      model: run.model,
      modelCalled: run.modelCalled,
      toolCount: run.activities.length,
      warnings: run.simulations?.flatMap((simulation) => simulation.warnings) || [],
    },
  };
  next = await repository.save(next);
  return next;
}

export async function rejectTaskmasterRun(
  runId: string,
  repository?: TaskmasterRunRepository,
): Promise<TaskmasterRunRecord> {
  repository ||= await getTaskmasterRunRepository();
  const run = await repository.get(runId);
  if (!run) throw new Error('Taskmaster run was not found.');
  if (run.state !== 'AWAITING_APPROVAL') throw new Error(`Run is ${run.state}; rejection is not available.`);
  const next = transition(run, 'REJECTED', 'Proposals rejected by user');
  return repository.save({ ...next, progress: 100 });
}

export async function cancelTaskmasterRun(
  runId: string,
  repository?: TaskmasterRunRepository,
): Promise<TaskmasterRunRecord> {
  repository ||= await getTaskmasterRunRepository();
  const run = await repository.get(runId);
  if (!run) throw new Error('Taskmaster run was not found.');
  if (!allowedTaskmasterTransitions[run.state].includes('CANCELLED')) throw new Error(`Run is ${run.state}; cancellation is not available.`);
  const next = transition(run, 'CANCELLED', 'Cancelled by user');
  return repository.save({ ...next, progress: 100 });
}
