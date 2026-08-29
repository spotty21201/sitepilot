import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { ScenarioControls } from '@/components/ScenarioControls';
import { POST } from '@/app/api/assessment/route';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { getCase, saveCase } from '@/lib/storage/case-repository';
import type { PlanningAssessment, Project } from '@/types';

async function deterministicAssessment(question = ''): Promise<PlanningAssessment> {
  const canonicalProject = getCase(GOLDEN_PROJECT.id);
  const scenarios = canonicalProject.scenarios.map((scenario) => ({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    setbacks: scenario.assumptionsUsed.setbacks,
    masses: scenario.masses,
    sourceRevisionId: scenario.canonicalRevision?.revisionId || `unversioned-${scenario.id}`,
    proposal: scenario.proposal,
  }));
  const response = await POST(new NextRequest('http://localhost:3000/api/assessment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', host: 'localhost:3000' },
    body: JSON.stringify({
      ...scenarios[1],
      projectId: canonicalProject.id,
      projectName: canonicalProject.name,
      activeSchemeId: scenarios[1].scenarioId,
      scenarios,
      grossSiteArea: canonicalProject.site.grossSiteArea,
      frontageLength: canonicalProject.site.frontageLength,
      zoningLimits: canonicalProject.zoningLimits,
      userQuery: question || undefined,
    }),
  }));
  expect(response.status).toBe(200);
  return response.json() as Promise<PlanningAssessment>;
}

function controls(project: Project, onAssessmentPrepared = vi.fn(), activeScenarioId = project.scenarios[1].id) {
  return (
    <ScenarioControls
      site={project.site}
      project={project}
      scenarios={project.scenarios}
      activeScenarioId={activeScenarioId}
      onSelectScenario={vi.fn()}
      onUpdateScenarioParam={vi.fn()}
      onFitMassingToEnvelope={vi.fn()}
      onResetScenario={vi.fn()}
      onAssessmentPrepared={onAssessmentPrepared}
    />
  );
}

describe('planning assessment reload persistence and reuse', () => {
  beforeEach(() => {
    localStorage.clear();
    process.env.ASSESSMENT_FORCE_FALLBACK = 'true';
    vi.restoreAllMocks();
  });

  it('round-trips both assessment layers and reuses an identical persisted question without HTTP', async () => {
    const assessment = await deterministicAssessment('Prioritize operational continuity');
    const project = { ...getCase(GOLDEN_PROJECT.id), planningAssessment: assessment } as Project;
    expect(saveCase(project)).toBe(true);
    const reloaded = getCase(project.id);
    expect(reloaded.planningAssessment?.deterministicAssessment.authoritative).toBe(true);
    expect(reloaded.planningAssessment?.aiAssessment.advisory).toBe(true);
    expect(reloaded.planningAssessment?.binding.questionHash).toBe(assessment.binding.questionHash);
    expect(reloaded.planningAssessment?.caseId).toBe(project.id);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(controls(reloaded));
    expect(await screen.findByDisplayValue('Prioritize operational continuity')).toBeDefined();
    expect(await screen.findByText('Deterministic study summary — no model request made')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare planning and investment assessment' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('syncs an assessment loaded after mount, ignores scenario selection, and persists relevant revision staleness', async () => {
    const assessment = await deterministicAssessment();
    const onAssessmentPrepared = vi.fn();
    const canonicalProject = getCase(GOLDEN_PROJECT.id);
    const { rerender } = render(controls(canonicalProject, onAssessmentPrepared));
    const persistedProject = { ...canonicalProject, planningAssessment: assessment } as Project;
    rerender(controls(persistedProject, onAssessmentPrepared));
    expect(await screen.findByText('Deterministic study summary — no model request made')).toBeDefined();

    rerender(controls(persistedProject, onAssessmentPrepared, persistedProject.scenarios[0].id));
    await Promise.resolve();
    expect(onAssessmentPrepared).not.toHaveBeenCalled();

    const changed = structuredClone(persistedProject);
    changed.scenarios[2].canonicalRevision!.revisionId = `${changed.scenarios[2].canonicalRevision!.revisionId}:changed`;
    rerender(controls(changed, onAssessmentPrepared));
    await waitFor(() => expect(onAssessmentPrepared).toHaveBeenCalledWith(expect.objectContaining({ stale: true })));
  });
});
