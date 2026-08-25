'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Building2, ChevronDown, Compass, Focus, Layers3, Map, Maximize2, ScanLine } from 'lucide-react';

import type { SpatialConsoleSnapshot } from '../spatial-editor-adapter';
import type {
  CameraPreset,
  CameraProjectionMode,
  ManipulationTool,
  ViewportDisplayMode,
} from '../types';
import { SpatialConsoleScene } from './SpatialConsoleScene';
import { SpatialConsoleEditingPanel } from './SpatialConsoleEditingPanel';
import {
  SPATIAL_SNAP_METERS,
  type SpatialEditProposal,
  type SpatialProposalCommitResult,
  type SpatialProposalViewResult,
} from './spatial-editing-bridge';
import styles from './SpatialConsoleViewport.module.css';

interface SpatialConsoleViewportProps {
  snapshot: SpatialConsoleSnapshot;
  displayMode: ViewportDisplayMode;
  projectionMode: CameraProjectionMode;
  cameraPreset: CameraPreset;
  selectedMassId: string | null;
  activeTool: ManipulationTool;
  showZoningCap: boolean;
  onSelectMass: (massId: string | null) => void;
  onChangeTool: (tool: ManipulationTool) => void;
  onSetCameraPreset: (preset: CameraPreset) => void;
  onChangeProjectionMode: (mode: CameraProjectionMode) => void;
  onChangeDisplayMode: (mode: ViewportDisplayMode) => void;
  onPreviewProposal: (proposal: SpatialEditProposal) => SpatialProposalViewResult;
  onCommitProposal: (proposal: SpatialEditProposal) => SpatialProposalCommitResult;
  onAddMass: () => SpatialProposalCommitResult;
  onDuplicateMass: () => SpatialProposalCommitResult;
  onDeleteMass: () => SpatialProposalCommitResult;
  onInitializationError: (error: Error) => void;
}

type InteractionFeedback =
  | { phase: 'idle'; message: string }
  | { phase: 'preview'; message: string; result: SpatialProposalViewResult }
  | { phase: 'accepted' | 'rejected' | 'cancelled'; message: string };

function niceScaleDistance(target: number): number {
  const steps = [0.5, 1, 2, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 2000];
  let best = steps[0];
  for (const step of steps) {
    if (step <= target * 1.25) best = step;
  }
  return best;
}

function describeEditRejection(reason: string): string {
  if (/stale|revision/i.test(reason)) {
    return 'The study changed before this edit was applied. Review the current values and try again.';
  }
  if (/canonical/i.test(reason)) {
    return 'The edit could not be applied to the current study.';
  }
  return reason;
}

export function SpatialConsoleViewport({
  snapshot,
  displayMode,
  projectionMode,
  cameraPreset,
  selectedMassId,
  activeTool,
  showZoningCap,
  onSelectMass,
  onChangeTool,
  onSetCameraPreset,
  onChangeProjectionMode,
  onChangeDisplayMode,
  onPreviewProposal,
  onCommitProposal,
  onAddMass,
  onDuplicateMass,
  onDeleteMass,
  onInitializationError,
}: SpatialConsoleViewportProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpatialConsoleScene | null>(null);
  const [scale, setScale] = useState({ label: '50 m', pixels: 80 });
  const [northAngle, setNorthAngle] = useState<number | null>(null);
  const [hoveredMassId, setHoveredMassId] = useState<string | null>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [feedback, setFeedback] = useState<InteractionFeedback>({
    phase: 'idle',
    message: `Ready · ${SPATIAL_SNAP_METERS.toFixed(1)}m snap`,
  });
  const callbackRef = useRef({ onPreviewProposal, onCommitProposal });
  const selectedMass = snapshot.masses.find((mass) => mass.id === selectedMassId) ?? null;
  const pointedMass = snapshot.masses.find((mass) => mass.id === (hoveredMassId ?? selectedMassId)) ?? null;

  useEffect(() => {
    callbackRef.current = { onPreviewProposal, onCommitProposal };
  }, [onCommitProposal, onPreviewProposal]);

  const previewProposal = useCallback((proposal: SpatialEditProposal): SpatialProposalViewResult => {
    const result = callbackRef.current.onPreviewProposal(proposal);
    const previewMass = result.snapshot?.masses.find((mass) => mass.id === proposal.targetId);
    const detail = previewMass
      ? `${previewMass.position.x.toFixed(1)}, ${previewMass.position.z.toFixed(1)} · ${previewMass.dimensions.width.toFixed(1)} × ${previewMass.dimensions.length.toFixed(1)}m · ${previewMass.floors} FL`
      : proposal.type;
    setFeedback({
      phase: 'preview',
      message: result.valid ? `Preview · ${detail}` : `Preview rejected · ${describeEditRejection(result.reason)}`,
      result,
    });
    return result;
  }, []);

  const commitProposal = useCallback((proposal: SpatialEditProposal): SpatialProposalCommitResult => {
    const result = callbackRef.current.onCommitProposal(proposal);
    setFeedback(result.accepted
      ? { phase: 'accepted', message: 'Edit applied to the current study' }
      : { phase: 'rejected', message: `Rejected · ${describeEditRejection(result.reason)}` });
    return result;
  }, []);

  const cancelProposal = useCallback(() => {
    setFeedback({ phase: 'cancelled', message: 'Cancelled · site geometry restored' });
  }, []);

  const recordActionResult = useCallback((result: SpatialProposalCommitResult, acceptedMessage: string) => {
    setFeedback(result.accepted
      ? { phase: 'accepted', message: `${acceptedMessage} · study updated` }
      : { phase: 'rejected', message: `Rejected · ${describeEditRejection(result.reason)}` });
  }, []);

  useEffect(() => {
    if (!surfaceRef.current) return;
    let scene: SpatialConsoleScene | null = null;
    try {
      scene = new SpatialConsoleScene(surfaceRef.current, {
        onSelectMass,
        onHoverMass: setHoveredMassId,
        onPreviewProposal: previewProposal,
        onCommitProposal: commitProposal,
        onCancelProposal: cancelProposal,
      });
      sceneRef.current = scene;
    } catch (error) {
      scene?.dispose();
      onInitializationError(error instanceof Error ? error : new Error(String(error)));
    }

    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [cancelProposal, commitProposal, onInitializationError, onSelectMass, previewProposal]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
      scene.sync(snapshot, {
        selectedMassId,
        displayMode,
        projectionMode,
        showZoningCap,
        activeTool,
      });
    } catch (error) {
      scene.dispose();
      sceneRef.current = null;
      onInitializationError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [activeTool, displayMode, onInitializationError, projectionMode, selectedMassId, showZoningCap, snapshot]);

  useEffect(() => {
    sceneRef.current?.setCameraPreset(cameraPreset);
  }, [cameraPreset]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      const unitsPerPixel = scene.worldUnitsPerPixel();
      if (!Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0) return;
      const distance = niceScaleDistance(unitsPerPixel * 120);
      setScale({
        label: distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`,
        pixels: Math.max(28, Math.min(180, distance / unitsPerPixel)),
      });
      const angle = scene.northScreenAngleDegrees();
      setNorthAngle(angle === null ? null : Math.round(angle * 10) / 10);
    }, 180);
    return () => window.clearInterval(interval);
  }, []);

  const setView = (preset: CameraPreset, projection?: CameraProjectionMode) => {
    if (projection) onChangeProjectionMode(projection);
    onSetCameraPreset(preset);
    sceneRef.current?.setCameraPreset(preset);
  };

  return (
    <div
      className={styles.root}
      data-spatial-engine="spatial-console"
      data-case-id={snapshot.caseId}
      data-scenario-id={snapshot.scenarioId}
      data-canonical-revision={snapshot.revision.revisionId}
      data-mass-count={snapshot.masses.length}
      data-mass-signature={snapshot.masses.map((mass) => (
        `${mass.id}:${mass.position.x},${mass.position.y},${mass.position.z}:${mass.dimensions.width},${mass.dimensions.length},${mass.dimensions.height}`
      )).join('|')}
      data-selected-mass-id={selectedMassId ?? ''}
      data-hovered-mass-id={hoveredMassId ?? ''}
      data-north-angle={northAngle ?? 'unavailable'}
      data-road-width="20"
      data-front-setback={snapshot.site.setbacks.front}
      data-side-setback-left={snapshot.site.setbacks.sideLeft}
      data-side-setback-right={snapshot.site.setbacks.sideRight}
      data-envelope-kind={snapshot.site.zoningHeightLimitMeters === null ? 'footprint-only' : 'volume'}
      data-envelope-height={snapshot.site.zoningHeightLimitMeters ?? 'not-provided'}
    >
      <div ref={surfaceRef} className={styles.surface} aria-label="Editable Spatial Console viewport" tabIndex={0} />
      <div className={styles.vignette} />

      <div className={styles.status} title={snapshot.compliance.summary}>
        <span className={`${styles.statusDot} ${
          snapshot.compliance.isCompliant ? styles.statusCompliant : styles.statusNoncompliant
        }`} />
        <div className={styles.statusCopy}>
          <strong>{snapshot.scenarioName}</strong>
          <span title={snapshot.compliance.summary}>Study version {snapshot.revision.sequence} · Provisional study · Context not yet confirmed · {snapshot.compliance.label}</span>
        </div>
      </div>

      <div className={styles.northIndicator} aria-label={northAngle === null
        ? 'North orientation unavailable in the current view'
        : `North indicator, ${northAngle.toFixed(1)} degrees clockwise from screen up`}
      >
        <Compass
          size={18}
          className={styles.northArrow}
          style={{ transform: northAngle === null ? undefined : `rotate(${northAngle}deg)` }}
        />
        <span>{northAngle === null ? 'N AXIS' : 'N'}</span>
      </div>

      <div className={styles.streetLabel} aria-label={`Twenty metre study road and setback context for ${snapshot.site.streetName}`}>
        <span>20 m study road</span>
        <strong>Front {snapshot.site.setbacks.front} m · sides {snapshot.site.setbacks.sideLeft}/{snapshot.site.setbacks.sideRight} m · Context not yet verified</strong>
      </div>

      {showZoningCap && (
        <div className={styles.envelopeStatus} role="status" data-envelope-status>
          <strong>{snapshot.site.zoningHeightLimitMeters === null ? 'Buildable footprint' : 'Study envelope'}</strong>
          <span>{snapshot.site.zoningHeightLimitMeters === null
            ? 'Height limit not provided'
            : `Buildable footprint × ${snapshot.site.zoningHeightLimitMeters} m supplied height`}</span>
          <small>Study geometry · not surveyed or legally confirmed</small>
        </div>
      )}

      {pointedMass && <div className={styles.massTooltip} role="status">{hoveredMassId ? 'Selectable' : 'Selected'} · <strong>{pointedMass.name}</strong> · {pointedMass.type.toLowerCase()}</div>}

      <div className={styles.cameraDock} aria-label="Spatial Console camera controls">
        <div className={styles.cameraPresets} role="group" aria-label="Standard views">
          {(['TOP', 'ISO'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.viewButton}
              aria-pressed={cameraPreset === preset}
              aria-label={`${preset} Spatial Console view`}
              onClick={() => setView(
                preset,
                preset === 'ISO' ? 'PERSPECTIVE' : 'ORTHOGRAPHIC',
              )}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            className={styles.viewButton}
            aria-label="Open cardinal view controls"
            aria-expanded={viewMenuOpen}
            title="Cardinal views"
            onClick={() => setViewMenuOpen((open) => !open)}
          >
            VIEW <ChevronDown size={11} />
          </button>
        </div>
        <div className={styles.cameraActions} role="group" aria-label="Projection and fit controls">
          <button
            type="button"
            className={styles.projectionButton}
            onClick={() => onChangeProjectionMode(
              projectionMode === 'ORTHOGRAPHIC' ? 'PERSPECTIVE' : 'ORTHOGRAPHIC',
            )}
            aria-pressed={projectionMode === 'ORTHOGRAPHIC'}
            aria-label={projectionMode === 'ORTHOGRAPHIC' ? 'Use perspective projection' : 'Use orthographic projection'}
            title={projectionMode === 'ORTHOGRAPHIC' ? 'Orthographic projection' : 'Perspective projection'}
          >
            <ScanLine size={13} />
            <span>{projectionMode === 'ORTHOGRAPHIC' ? 'ORTHO' : 'PERSP'}</span>
          </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => sceneRef.current?.fitSite()}
          title="Fit parcel"
          aria-label="Fit parcel in Spatial Console"
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => sceneRef.current?.fitProposal()}
          title="Fit proposal"
          aria-label="Fit proposal in Spatial Console"
        >
          <Building2 size={14} />
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => sceneRef.current?.fitSelection()}
          disabled={!selectedMassId}
          title="Fit selection"
          aria-label="Fit selected mass in Spatial Console"
        >
          <Focus size={14} />
        </button>
        </div>
        {viewMenuOpen && (
          <div className={styles.viewMenu} role="group" aria-label="Cardinal spatial views">
            {(['NORTH', 'SOUTH', 'EAST', 'WEST'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={styles.viewButton}
                aria-pressed={cameraPreset === preset}
                aria-label={`${preset} Spatial Console view`}
                onClick={() => {
                  setView(preset, 'ORTHOGRAPHIC');
                  setViewMenuOpen(false);
                }}
              >
                {preset.charAt(0)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`${styles.displayDock} ${viewMenuOpen ? styles.displayDockWithViewMenu : ''}`}
        role="group"
        aria-label="Spatial display modes"
      >
        {([
          ['DEVELOPMENT', 'Development', <Box key="development" size={13} />],
          ['MONOCHROME', 'Monochrome', <Layers3 key="monochrome" size={13} />],
          ['CONSTRAINTS', 'Planning checks', <Map key="constraints" size={13} />],
        ] as Array<[ViewportDisplayMode, string, React.ReactNode]>).map(([mode, label, icon]) => (
          <button
            key={mode}
            type="button"
            className={styles.displayButton}
            aria-label={`${label} display mode`}
            aria-pressed={displayMode === mode}
            title={mode === 'CONSTRAINTS'
              ? (showZoningCap ? 'Hide planning checks and study envelope' : 'Show planning checks and study envelope')
              : label}
            onClick={() => onChangeDisplayMode(mode)}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className={styles.interactionLayer} aria-label="Spatial editing interaction layer">
        <div className={styles.gizmoRegion} data-interaction-region="gizmos" aria-hidden="true" />
        <div className={styles.previewDimensionsRegion} data-interaction-region="preview-dimensions" aria-hidden="true">
          {feedback.phase === 'preview' && feedback.result.snapshot && (
            <span>
              GFA {feedback.result.snapshot.metrics.totalGFA.toFixed(1)}m² · FAR {feedback.result.snapshot.metrics.farKLB.toFixed(2)} · H {feedback.result.snapshot.metrics.totalHeightMeters.toFixed(1)}m
            </span>
          )}
        </div>
        <div className={styles.snapRegion} data-interaction-region="snap-indicators" aria-hidden="true">
          {feedback.phase === 'preview' && <span>SNAP {SPATIAL_SNAP_METERS.toFixed(1)}m</span>}
        </div>
        <div
          className={`${styles.validationRegion} ${styles[`feedback_${feedback.phase}`]}`}
          data-interaction-region="validation"
          role="status"
          aria-live="polite"
        >
          <span>{feedback.message}</span>
        </div>
      </div>

      <SpatialConsoleEditingPanel
        key={`${snapshot.caseId}:${snapshot.scenarioId}:${snapshot.revision.revisionId}:${selectedMassId ?? 'none'}`}
        snapshot={snapshot}
        selectedMass={selectedMass}
        activeTool={activeTool}
        onChangeTool={onChangeTool}
        onCommitProposal={commitProposal}
        onAddMass={onAddMass}
        onDuplicateMass={onDuplicateMass}
        onDeleteMass={onDeleteMass}
        onActionResult={recordActionResult}
        onClearSelection={() => onSelectMass(null)}
      />

      <div className={styles.scale} aria-label={`Scale bar ${scale.label}`}>
        <span className={styles.scaleTrack} style={{ width: scale.pixels }} />
        <span>{scale.label}</span>
      </div>

      <div className={styles.legendDock}>
        <button
          type="button"
          className={styles.legendToggle}
          aria-expanded={legendOpen}
          aria-label="Toggle spatial legend"
          onClick={() => setLegendOpen((open) => !open)}
        >
          <span aria-hidden="true">≡</span> Legend
        </button>
        {legendOpen && (
          <div className={styles.legendPanel} aria-label="Spatial legend">
            <span><i className={styles.siteKey} />Site boundary</span>
            <span><i className={styles.envelopeKey} />{snapshot.site.zoningHeightLimitMeters === null ? 'Buildable footprint; height not provided' : `Study envelope to ${snapshot.site.zoningHeightLimitMeters} m`}</span>
            <span><i className={styles.massingKey} />Active scenario massing</span>
            <span><i className={styles.setbackKey} />Study setback lines ({snapshot.site.setbacks.front} m front; {snapshot.site.setbacks.sideLeft}/{snapshot.site.setbacks.sideRight} m sides)</span>
            <span><i className={styles.roadKey} />20 m user/address-derived study road</span>
            <small>Study context only · not verified cadastral or municipal geometry.</small>
          </div>
        )}
      </div>
    </div>
  );
}
