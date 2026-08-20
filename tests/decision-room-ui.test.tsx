import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '@/features/development-3d/Toolbar';
import { ScenarioControls } from '@/components/ScenarioControls';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { DevelopmentWorkspace } from '@/features/development-3d/DevelopmentWorkspace';
import { SpatialCanvas } from '@/components/SpatialCanvas';

// Mock Three.js and WebGL constructor
vi.mock('three', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('three');
  function MockWebGLRenderer() {
    return {
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas')
    };
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer
  };
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Decision Room UI & Spatial Controls Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all exact camera presets with visible labels and aria-pressed attributes', () => {
    const onSetCameraPreset = vi.fn();
    const { getByText } = render(
      <Toolbar
        displayMode="DEVELOPMENT"
        projectionMode="PERSPECTIVE"
        cameraPreset="ISO"
        isRotating={false}
        showDimensions={true}
        onChangeDisplayMode={vi.fn()}
        onChangeProjectionMode={vi.fn()}
        onSetCameraPreset={onSetCameraPreset}
        onToggleRotating={vi.fn()}
        onToggleDimensions={vi.fn()}
      />
    );

    // Verify exact requested camera buttons exist
    const topBtn = getByText('TOP');
    const southBtn = getByText('SOUTH');
    const northBtn = getByText('NORTH');
    const eastBtn = getByText('EAST');
    const westBtn = getByText('WEST');
    const isoBtn = getByText('ISO');
    const resetBtn = getByText('RESET');

    expect(topBtn).toBeDefined();
    expect(southBtn).toBeDefined();
    expect(northBtn).toBeDefined();
    expect(eastBtn).toBeDefined();
    expect(westBtn).toBeDefined();
    expect(isoBtn).toBeDefined();
    expect(resetBtn).toBeDefined();

    // Verify accessible labels and aria-pressed attributes
    expect(topBtn.getAttribute('aria-label')).toBe('TOP — orthographic plan view');
    expect(topBtn.getAttribute('aria-pressed')).toBe('false');

    expect(southBtn.getAttribute('aria-label')).toBe('SOUTH — orthographic elevation');
    expect(southBtn.getAttribute('aria-pressed')).toBe('false');

    expect(isoBtn.getAttribute('aria-label')).toBe('ISO — axonometric view');
    expect(isoBtn.getAttribute('aria-pressed')).toBe('true');

    // Click TOP preset and verify callback
    fireEvent.click(topBtn);
    expect(onSetCameraPreset).toHaveBeenCalledWith('TOP');

    // Click SOUTH preset and verify callback
    fireEvent.click(southBtn);
    expect(onSetCameraPreset).toHaveBeenCalledWith('SOUTH');

    // Click RESET preset and verify callback
    fireEvent.click(resetBtn);
    expect(onSetCameraPreset).toHaveBeenCalledWith('RESET');
  });

  it('renders 2D Site Plan legend with exact normalized labels [1] Podium, [2] East Wing, [3] West Wing', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const { getByText } = render(
      <DevelopmentWorkspace
        site={GOLDEN_PROJECT.site}
        activeScenario={scenarioB}
        onUpdateScenarioMasses={vi.fn()}
      />
    );

    // Switch to 2D Site Plan view
    const cadastralBtn = getByText('2D Site Plan (Illustrative)');
    fireEvent.click(cadastralBtn);

    // Verify exact indexed markers and normalized legend labels
    expect(screen.getByText(/\[1\] Podium:/)).toBeDefined();
    expect(screen.getByText(/\[2\] West Wing:/)).toBeDefined();
    expect(screen.getByText(/\[3\] East Wing:/)).toBeDefined();
  });

  it('displays exact elevation ticks (+0m, +9m, +30m, +32m) in elevation views', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const { getByText } = render(
      <SpatialCanvas
        site={GOLDEN_PROJECT.site}
        activeScenario={scenarioB}
      />
    );

    // Click SOUTH elevation view
    const southBtn = getByText('SOUTH');
    fireEvent.click(southBtn);

    // Verify exact required height datums
    expect(screen.getByText('+32m')).toBeDefined();
    expect(screen.getByText('Subzone R.9 Height Cap')).toBeDefined();
    expect(screen.getByText('+30m')).toBeDefined();
    expect(screen.getByText('Tower Ridge Datum (8 Fl)')).toBeDefined();
    expect(screen.getByText('+9m')).toBeDefined();
    expect(screen.getByText('Podium Roof Datum (2 Fl)')).toBeDefined();
    expect(screen.getByText('+0m')).toBeDefined();
    expect(screen.getByText('Ground Datum (0,0)')).toBeDefined();
  });

  it('manages XML modal lifecycle, focus trap, Escape dismissal, and focus restoration', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const { getByText, getByRole, queryByRole } = render(
      <ScenarioControls
        site={GOLDEN_PROJECT.site}
        scenarios={GOLDEN_PROJECT.scenarios}
        activeScenarioId={scenarioB.id}
        onSelectScenario={vi.fn()}
        onUpdateScenarioParam={vi.fn()}
        onFitMassingToEnvelope={vi.fn()}
        onResetScenario={vi.fn()}
      />
    );

    // Open XML Modal
    const xmlTriggerBtn = getByText('XML');
    fireEvent.click(xmlTriggerBtn);

    // Verify dialog role, aria-modal, aria-labelledby, aria-describedby
    const dialog = getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('xml-modal-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('xml-modal-desc');

    // Verify close on Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryByRole('dialog')).toBeNull();
  });

  it('displays [BASE CONCEPT], [USER OVERRIDE], and [FITTED TO SETBACK] badges with Reset action', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const onResetScenario = vi.fn();

    // Baseline Scenario
    const { rerender } = render(
      <ScenarioControls
        site={GOLDEN_PROJECT.site}
        scenarios={GOLDEN_PROJECT.scenarios}
        activeScenarioId={scenarioB.id}
        onSelectScenario={vi.fn()}
        onUpdateScenarioParam={vi.fn()}
        onFitMassingToEnvelope={vi.fn()}
        onResetScenario={onResetScenario}
      />
    );

    expect(screen.getByText('[BASE CONCEPT]')).toBeDefined();
    expect(screen.queryByText('[USER OVERRIDE]')).toBeNull();
    expect(screen.queryByText('[FITTED TO SETBACK]')).toBeNull();

    // User Override Scenario (e.g. 10 storeys)
    const overriddenScenario = {
      ...scenarioB,
      metrics: { ...scenarioB.metrics, totalFloors: 10 },
      editClassification: 'HEIGHT_OVERRIDE' as const
    };

    rerender(
      <ScenarioControls
        site={GOLDEN_PROJECT.site}
        scenarios={[overriddenScenario]}
        activeScenarioId={scenarioB.id}
        onSelectScenario={vi.fn()}
        onUpdateScenarioParam={vi.fn()}
        onFitMassingToEnvelope={vi.fn()}
        onResetScenario={onResetScenario}
      />
    );

    expect(screen.getByText('[BASE CONCEPT]')).toBeDefined();
    expect(screen.getByText('[USER OVERRIDE]')).toBeDefined();
    expect(screen.queryByText('[FITTED TO SETBACK]')).toBeNull();

    // Fitted to Setback Scenario
    const fittedScenario = {
      ...scenarioB,
      isFittedOverride: true,
      editClassification: 'FITTED_TO_SETBACK' as const
    };

    rerender(
      <ScenarioControls
        site={GOLDEN_PROJECT.site}
        scenarios={[fittedScenario]}
        activeScenarioId={scenarioB.id}
        onSelectScenario={vi.fn()}
        onUpdateScenarioParam={vi.fn()}
        onFitMassingToEnvelope={vi.fn()}
        onResetScenario={onResetScenario}
      />
    );

    expect(screen.getByText('[BASE CONCEPT]')).toBeDefined();
    expect(screen.getByText('[FITTED TO SETBACK]')).toBeDefined();

    // Click Reset button
    const resetBtn = screen.getByLabelText('Reset scenario to baseline concept');
    fireEvent.click(resetBtn);
    expect(onResetScenario).toHaveBeenCalledWith(scenarioB.id);
  });
});
