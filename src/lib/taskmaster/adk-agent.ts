import { getAiConfig } from '@/lib/ai/config';
import { taskmasterPlanSchema, type TaskmasterInput, type TaskmasterPlan } from './schemas';
import type { TaskmasterToolContext } from './tools';
import type { Schema } from '@google/genai';
import path from 'node:path';
import { parseStructuredCandidate, type ProviderRunIdentifiers } from './provider-adapter';

/**
 * Load only the ADK modules needed by Taskmaster.
 *
 * The package root intentionally exports optional server integrations (A2A,
 * Express, MCP, GCS and telemetry). Importing that barrel from a Next route
 * makes the production bundler require every optional peer, even though this
 * workflow only needs the agent, function-tool and in-memory runner classes.
 * Resolve the official package from the server runtime and load the narrow
 * ESM entry points so browser code and optional peers never enter the bundle.
 */
async function loadAdkModule<T>(relativePath: string): Promise<T> {
  // Resolve from the runtime filesystem. Next's standalone bundler can turn
  // package `require.resolve` calls into numeric module IDs, which are not
  // valid filesystem paths when the worker loads ADK dynamically.
  const packageRoot = path.join(process.cwd(), 'node_modules', '@google', 'adk');
  const moduleUrl = `file://${path.join(packageRoot, 'dist', 'esm', relativePath).split(path.sep).join('/')}`;
  return import(/* webpackIgnore: true */ moduleUrl) as Promise<T>;
}

const FALLBACK_GOAL = 'Create and compare three development schemes for this opportunity using supplied inputs without treating any proposal as approved planning truth.';

export type TaskmasterAdkAgent = {
  name: string;
  tools: unknown[];
  [key: string]: unknown;
};

export function buildDeterministicTaskmasterPlan(goal: string): TaskmasterPlan {
  return taskmasterPlanSchema.parse({
    version: '1',
    goal,
    rationale: 'The local plan uses bounded read-only inspection, deterministic envelope calculation, three structured proposal templates, simulation, comparison, and a human approval gate.',
    steps: [
      { id: 'inspect-context', tool: 'get_opportunity_context', purpose: 'Bind the run to the opportunity and the user goal.', input: {} },
      { id: 'inspect-inputs', tool: 'get_site_and_planning_inputs', purpose: 'Read site, existing-asset, planning, and commercial inputs.', input: {} },
      { id: 'inspect-gaps', tool: 'list_assumptions_and_missing_information', purpose: 'Make missing or unverified inputs visible before proposals are reviewed.', input: {} },
      { id: 'calculate-envelope', tool: 'calculate_buildable_envelope', purpose: 'Calculate the setback-derived study envelope with SitePilot geometry.', input: {} },
      { id: 'prepare-proposals', tool: 'prepare_scheme_proposals', purpose: 'Prepare three materially different study theses.', input: {} },
      { id: 'simulate-a', tool: 'simulate_development_scheme', purpose: 'Simulate the conservative study without persisting it.', input: { proposalId: 'A' } },
      { id: 'simulate-b', tool: 'simulate_development_scheme', purpose: 'Simulate the balanced study without persisting it.', input: { proposalId: 'B' } },
      { id: 'simulate-c', tool: 'simulate_development_scheme', purpose: 'Simulate the boundary study without persisting it.', input: { proposalId: 'C' } },
      { id: 'compare', tool: 'compare_development_schemes', purpose: 'Compare all proposals using the same deterministic figures.', input: {} },
    ],
  });
}

export function taskmasterModelDisclosure(modelCalled = false): { provider: string; model: string; modelCalled: boolean; disclosure: string } {
  const config = getAiConfig();
  if (!modelCalled) {
    return {
      provider: 'LOCAL_DEVELOPMENT',
      model: 'Template schemes used',
      modelCalled: false,
      disclosure: 'Template schemes used. No model request was made; SitePilot calculated and validated all planning figures deterministically.',
    };
  }
  return {
    provider: config.provider,
    model: config.model,
    modelCalled: true,
    disclosure: `Google ADK orchestrated a structured planning call through ${config.provider} using ${config.model}. SitePilot independently calculates and validates geometry and planning figures.`,
  };
}

function adkPlanSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      version: { type: 'STRING', enum: ['1'] },
      goal: { type: 'STRING' },
      rationale: { type: 'STRING' },
      steps: {
        type: 'ARRAY',
        minItems: 5,
        maxItems: 12,
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            tool: { type: 'STRING', enum: ['get_opportunity_context', 'get_site_and_planning_inputs', 'list_assumptions_and_missing_information', 'calculate_buildable_envelope', 'simulate_development_scheme', 'compare_development_schemes', 'get_scheme_planning_checks', 'prepare_scheme_proposals'] },
            purpose: { type: 'STRING' },
            input: { type: 'OBJECT' },
          },
          required: ['id', 'tool', 'purpose', 'input'],
        },
      },
    },
    required: ['version', 'goal', 'rationale', 'steps'],
  };
}

/**
 * Builds the official Google ADK agent definition. It is only executed when
 * TASKMASTER_ALLOW_LIVE_MODEL=true; importing this module never calls Gemini.
 */
export async function buildAdkTaskmasterAgent(input: TaskmasterInput, context: TaskmasterToolContext) {
  const [{ LlmAgent }] = await Promise.all([
    loadAdkModule<{ LlmAgent: new (options: Record<string, unknown>) => TaskmasterAdkAgent }>('agents/llm_agent.js'),
  ]);
  return new LlmAgent({
    name: 'sitepilot_taskmaster',
    model: getAiConfig().model,
    includeContents: 'none',
    mode: 'single_turn',
    instruction: `Create a bounded, schema-valid execution plan for this SitePilot goal: ${input.objective || FALLBACK_GOAL}. Use only the listed read-only tools. Never calculate authoritative planning totals, never request mutation, and keep the plan to the supplied workflow. Site inputs: ${JSON.stringify({ siteAreaM2: input.siteAreaM2, frontageMeters: input.frontageMeters, depthMeters: input.depthMeters, planningLimits: input.planningLimits, priorities: input.priorities })}`,
    // The ADK agent returns a schema-validated plan. SitePilot executes the
    // allowlisted tools itself after the plan is persisted, which keeps model
    // tool turns from bypassing the provider budget or mutating study state.
    tools: [],
    generateContentConfig: {
      // ADK 2.0.0 uses @google/genai's v1beta1 default unless the supported
      // per-request HTTP option is set. Keep the hosted boundary on stable v1.
      httpOptions: { apiVersion: 'v1' },
      ...(Number(process.env.TASKMASTER_MAX_OUTPUT_TOKENS || 0) > 0
        ? { maxOutputTokens: Number(process.env.TASKMASTER_MAX_OUTPUT_TOKENS) }
        : {}),
    },
    outputSchema: adkPlanSchema() as unknown as Schema,
  });
}

export async function runAdkPlan(
  input: TaskmasterInput,
  context: TaskmasterToolContext,
  identifiers: ProviderRunIdentifiers = { runId: 'not-recorded', correlationId: 'not-recorded' },
): Promise<TaskmasterPlan> {
  if (process.env.TASKMASTER_ALLOW_LIVE_MODEL !== 'true') return buildDeterministicTaskmasterPlan(input.objective || FALLBACK_GOAL);
  const { InMemoryRunner } = await loadAdkModule<{ InMemoryRunner: new (options: Record<string, unknown>) => { runEphemeral: (options: Record<string, unknown>) => AsyncIterable<unknown> } }>('runner/in_memory_runner.js');
  const agent = await buildAdkTaskmasterAgent(input, context);
  const runner = new InMemoryRunner({ agent, appName: 'sitepilot-taskmaster' });
  const events: unknown[] = [];
  for await (const event of runner.runEphemeral({
    userId: input.opportunityId,
    newMessage: { role: 'user', parts: [{ text: input.objective || FALLBACK_GOAL }] },
  })) events.push(event);
  const text = events.flatMap((event) => {
    if (!event || typeof event !== 'object') return [];
    const content = (event as { content?: { parts?: unknown[] } }).content;
    return (content?.parts || []).flatMap((part) => {
      if (!part || typeof part !== 'object') return [];
      const value = (part as { text?: unknown }).text;
      return typeof value === 'string' ? [value] : [];
    });
  }).join('\n');
  return parseStructuredCandidate(text, taskmasterPlanSchema, identifiers);
}
