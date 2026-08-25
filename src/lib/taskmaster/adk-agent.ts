import { getAiConfig } from '@/lib/ai/config';
import { taskmasterPlanSchema, type TaskmasterInput, type TaskmasterPlan } from './schemas';
import { executeTaskmasterTool, type TaskmasterToolContext } from './tools';
import type { Schema } from '@google/genai';
import path from 'node:path';

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

export function taskmasterModelDisclosure(): { provider: string; model: string; modelCalled: boolean; disclosure: string } {
  const config = getAiConfig();
  if (config.provider === 'LOCAL_DEVELOPMENT' || process.env.TASKMASTER_ALLOW_LIVE_MODEL !== 'true') {
    return {
      provider: 'LOCAL_DEVELOPMENT',
      model: 'Not called in local development',
      modelCalled: false,
      disclosure: 'No live ADK/Gemini call was authorized in this environment. Study templates—not model-generated.',
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
  const [{ LlmAgent }, { FunctionTool }] = await Promise.all([
    loadAdkModule<{ LlmAgent: new (options: Record<string, unknown>) => TaskmasterAdkAgent }>('agents/llm_agent.js'),
    loadAdkModule<{ FunctionTool: new (options: Record<string, unknown>) => unknown }>('tools/function_tool.js'),
  ]);
  const { z } = await import('zod');
  const toolNames = [
    'get_opportunity_context',
    'get_site_and_planning_inputs',
    'list_assumptions_and_missing_information',
    'calculate_buildable_envelope',
    'prepare_scheme_proposals',
    'compare_development_schemes',
  ] as const;
  const tools = toolNames.map((name) => new FunctionTool({
    name,
    description: `Read-only SitePilot planning tool ${name}. It cannot mutate the accepted study.`,
    parameters: z.object({}),
    execute: () => executeTaskmasterTool(name, context).result,
  }));
  return new LlmAgent({
    name: 'sitepilot_taskmaster',
    model: getAiConfig().model,
    includeContents: 'none',
    mode: 'single_turn',
    instruction: `Create a bounded, schema-valid execution plan for this SitePilot goal: ${input.objective || FALLBACK_GOAL}. Use only the listed read-only tools. Never calculate authoritative planning totals, never request mutation, and keep the plan to the supplied workflow. Site inputs: ${JSON.stringify({ siteAreaM2: input.siteAreaM2, frontageMeters: input.frontageMeters, depthMeters: input.depthMeters, planningLimits: input.planningLimits, priorities: input.priorities })}`,
    tools,
    generateContentConfig: Number(process.env.TASKMASTER_MAX_OUTPUT_TOKENS || 0) > 0
      ? { maxOutputTokens: Number(process.env.TASKMASTER_MAX_OUTPUT_TOKENS) }
      : undefined,
    outputSchema: adkPlanSchema() as unknown as Schema,
  });
}

export async function runAdkPlan(input: TaskmasterInput, context: TaskmasterToolContext): Promise<TaskmasterPlan> {
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
  return taskmasterPlanSchema.parse(JSON.parse(text));
}
