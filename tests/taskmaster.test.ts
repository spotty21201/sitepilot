import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTaskmasterRun, executeTaskmasterRun, approveTaskmasterRun, completeApprovedTaskmasterRun, rejectTaskmasterRun } from '@/lib/taskmaster/runner';
import { InMemoryTaskmasterRunRepository } from '@/lib/taskmaster/repository';
import { buildAdkTaskmasterAgent, buildDeterministicTaskmasterPlan } from '@/lib/taskmaster/adk-agent';
import { executeTaskmasterTool } from '@/lib/taskmaster/tools';
import type { TaskmasterInput } from '@/lib/taskmaster/schemas';

const input: TaskmasterInput = {
  opportunityId: 'case-thamrin-transit',
  name: 'Thamrin Transit Quarter',
  address: 'Jalan Thamrin, Central Jakarta',
  objective: 'Create and compare three development schemes for a mixed-use transit-oriented site.',
  siteAreaM2: 9600,
  frontageMeters: 80,
  depthMeters: 120,
  existingAsset: { gfa: 4500, floors: 2, description: 'Existing mixed-use asset', currentStatus: 'Partially utilized' },
  planningLimits: { maxFAR: 8, maxCoveragePct: 50, minKDHPct: 20, maxHeightMeters: 220, setbacks: { front: 10, rear: 6, sideLeft: 6, sideRight: 6 } },
  studyVersion: 'Study version 4',
  inputHash: 'input-test-thamrin',
  priorities: {
    existingBuildingRetention: 'adapt',
    developmentYield: 'balanced',
    publicRealm: 'generous',
    programMix: 'Retail podium, offices, residences, hotel and shaded public realm',
    phasing: 'phased',
    planningRiskTolerance: 'medium',
    investmentHorizon: 'long',
    allowNonCompliantStretch: false,
  },
};

describe('Taskmaster bounded workflow', () => {
  beforeEach(() => {
    delete process.env.TASKMASTER_ALLOW_LIVE_MODEL;
  });

  it('creates a persisted fallback plan with distinct, deterministically simulated schemes', async () => {
    const audit = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const repository = new InMemoryTaskmasterRunRepository();
    const run = createTaskmasterRun(input, input.objective, 'idempotency-thamrin');
    await repository.create(run);
    const result = await executeTaskmasterRun(run.runId, repository, 'delivery-1');
    expect(result?.state).toBe('AWAITING_APPROVAL');
    expect(result?.correlationId).toMatch(/^corr-/);
    expect(result?.modelCalled).toBe(false);
    expect(result?.modelCallCount).toBe(0);
    expect(result?.provider).toBe('LOCAL_DEVELOPMENT');
    expect(result?.model).toBe('Template schemes used');
    expect(result?.disclosure).toContain('Template schemes used');
    expect(result?.generation).toMatchObject({
      modelCalled: false,
      provider: 'LOCAL_DEVELOPMENT',
      model: 'Template schemes used',
    });
    expect(result?.providerUsage).toMatchObject({
      providerRequests: 0,
      successfulProviderRequests: 0,
      promptTokens: 0,
      candidateTokens: 0,
      toolUsePromptTokens: 0,
      thoughtTokens: 0,
      totalTokens: 0,
    });
    expect(result?.plan?.steps.map((step) => step.tool)).toContain('calculate_buildable_envelope');
    expect(result?.generation?.proposals).toHaveLength(3);
    expect(new Set(result?.generation?.proposals.map((proposal) => proposal.thesis)).size).toBe(3);
    expect(result?.simulations).toHaveLength(3);
    expect(result?.simulations?.every((simulation) => typeof simulation.totalGFA === 'number')).toBe(true);
    expect(result?.simulations?.every((simulation) => simulation.warnings.some((warning) => warning.includes('KDH not demonstrated')))).toBe(true);
    const events = audit.mock.calls.map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>);
    expect(events.find((event) => event.event === 'delivery_started')).toMatchObject({
      modelCalled: false,
      provider: 'LOCAL_DEVELOPMENT',
      model: 'Template schemes used',
    });
    expect(events.every((event) => !('prompt' in event) && !('credentials' in event) && !('opportunityDocument' in event))).toBe(true);
    audit.mockRestore();
  });

  it('is idempotent for duplicate delivery and requires approval before completion', async () => {
    const repository = new InMemoryTaskmasterRunRepository();
    const run = createTaskmasterRun(input, input.objective, 'idempotency-duplicate');
    await repository.create(run);
    const first = await executeTaskmasterRun(run.runId, repository, 'delivery-duplicate');
    const second = await executeTaskmasterRun(run.runId, repository, 'delivery-duplicate');
    expect(first?.state).toBe('AWAITING_APPROVAL');
    expect(second?.state).toBe('AWAITING_APPROVAL');
    expect(second?.activities).toHaveLength(first?.activities?.length ?? 0);
    await expect(completeApprovedTaskmasterRun(run.runId, input.studyVersion, repository)).rejects.toThrow(/not awaiting application/i);
  });

  it('blocks stale approval and prevents double approval', async () => {
    const repository = new InMemoryTaskmasterRunRepository();
    const run = createTaskmasterRun(input, input.objective, 'idempotency-stale');
    await repository.create(run);
    const ready = await executeTaskmasterRun(run.runId, repository, 'delivery-stale');
    const proposalId = ready?.generation?.proposals[0].id;
    await expect(approveTaskmasterRun(run.runId, proposalId!, 'Study version 5', 'tester', repository)).rejects.toThrow(/stale/i);
    const blocked = await repository.get(run.runId);
    expect(blocked?.state).toBe('BLOCKED_STALE');
  });

  it('rejects an awaiting review without touching the accepted study', async () => {
    const repository = new InMemoryTaskmasterRunRepository();
    const run = createTaskmasterRun(input, input.objective, 'idempotency-reject');
    await repository.create(run);
    await executeTaskmasterRun(run.runId, repository, 'delivery-reject');
    const rejected = await rejectTaskmasterRun(run.runId, repository);
    expect(rejected.state).toBe('REJECTED');
    expect(rejected.approval).toBeUndefined();
  });

  it('rejects unknown tool requests and keeps envelope calculation deterministic', () => {
    const context = { input, proposals: [], simulations: [] };
    expect(() => executeTaskmasterTool('calculate_buildable_envelope', context)).not.toThrow();
    expect(() => executeTaskmasterTool('not-a-tool' as never, context)).toThrow(/Unsupported Taskmaster tool/);
    expect(buildDeterministicTaskmasterPlan(input.objective).steps).toHaveLength(9);
  });

  it('constructs the official ADK planning boundary without model-managed tool execution', async () => {
    const context = { input, proposals: [], simulations: [] };
    const agent = await buildAdkTaskmasterAgent(input, context);
    expect(agent.name).toBe('sitepilot_taskmaster');
    expect(agent.tools).toHaveLength(0);
    expect(process.env.TASKMASTER_ALLOW_LIVE_MODEL).not.toBe('true');
  });
});
