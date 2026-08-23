'use client';

import React, { useState } from 'react';
import { Copy, Layers3, Move, MousePointer2, Plus, Scaling, Trash2, X } from 'lucide-react';

import type { SpatialConsoleSnapshot, SpatialMassSnapshot } from '../spatial-editor-adapter';
import type { ManipulationTool } from '../types';
import type {
  SpatialEditProposal,
  SpatialProposalCommitResult,
} from './spatial-editing-bridge';
import styles from './SpatialConsoleViewport.module.css';

interface SpatialConsoleEditingPanelProps {
  snapshot: SpatialConsoleSnapshot;
  selectedMass: SpatialMassSnapshot | null;
  activeTool: ManipulationTool;
  onChangeTool: (tool: ManipulationTool) => void;
  onCommitProposal: (proposal: SpatialEditProposal) => SpatialProposalCommitResult;
  onAddMass: () => SpatialProposalCommitResult;
  onDuplicateMass: () => SpatialProposalCommitResult;
  onDeleteMass: () => SpatialProposalCommitResult;
  onActionResult: (result: SpatialProposalCommitResult, acceptedMessage: string) => void;
  onClearSelection: () => void;
}

type NumericField = 'x' | 'z' | 'width' | 'length' | 'floors' | 'floorToFloorHeight';

function initialValues(mass: SpatialMassSnapshot | null): Record<NumericField, string> {
  return {
    x: mass?.position.x.toFixed(1) ?? '',
    z: mass?.position.z.toFixed(1) ?? '',
    width: mass?.dimensions.width.toFixed(1) ?? '',
    length: mass?.dimensions.length.toFixed(1) ?? '',
    floors: mass ? String(mass.floors) : '',
    floorToFloorHeight: mass?.floorToFloorHeight.toFixed(1) ?? '',
  };
}

export function SpatialConsoleEditingPanel({
  snapshot,
  selectedMass,
  activeTool,
  onChangeTool,
  onCommitProposal,
  onAddMass,
  onDuplicateMass,
  onDeleteMass,
  onActionResult,
  onClearSelection,
}: SpatialConsoleEditingPanelProps) {
  const initial = initialValues(selectedMass);
  const [values, setValues] = useState(initial);
  const base = selectedMass ? {
    caseId: snapshot.caseId,
    scenarioId: snapshot.scenarioId,
    targetId: selectedMass.id,
    expectedSourceRevisionId: snapshot.revision.revisionId,
  } : null;

  const commitField = (field: NumericField) => {
    if (!selectedMass || !base) return;
    const value = Number(values[field]);
    if (!Number.isFinite(value)) {
      onActionResult({ accepted: false, code: 'INVALID_PAYLOAD', reason: 'Enter a finite numeric value.' }, '');
      return;
    }
    let proposal: SpatialEditProposal;
    if (field === 'x' || field === 'z') {
      proposal = {
        ...base,
        type: 'MOVE_MASS',
        position: { ...selectedMass.position, [field]: value },
      };
    } else if (field === 'width' || field === 'length') {
      proposal = {
        ...base,
        type: 'RESIZE_MASS',
        width: field === 'width' ? value : selectedMass.dimensions.width,
        length: field === 'length' ? value : selectedMass.dimensions.length,
      };
    } else if (field === 'floors') {
      proposal = { ...base, type: 'SET_MASS_FLOORS', floors: value };
    } else {
      proposal = { ...base, type: 'SET_FLOOR_TO_FLOOR_HEIGHT', floorToFloorHeight: value };
    }
    onActionResult(onCommitProposal(proposal), `Accepted ${field} update`);
  };

  const toolButtons: Array<{ tool: ManipulationTool; label: string; icon: React.ReactNode }> = [
    { tool: 'SELECT', label: 'Select', icon: <MousePointer2 size={13} /> },
    { tool: 'MOVE', label: 'Move', icon: <Move size={13} /> },
    { tool: 'RESIZE', label: 'Resize', icon: <Scaling size={13} /> },
    { tool: 'HEIGHT', label: 'Floors', icon: <Layers3 size={13} /> },
  ];

  return (
    <div
      className={`${styles.editingPanel} ${selectedMass ? styles.editingPanelSelected : styles.editingPanelIdle}`}
      aria-label="Spatial Console editing tools"
      data-selection-state={selectedMass ? 'selected' : 'none'}
    >
      <div className={styles.toolRail} role="toolbar" aria-label="Spatial editing modes">
        {toolButtons.map(({ tool, label, icon }) => (
          <button
            key={tool}
            type="button"
            className={styles.toolButton}
            aria-label={`${label} tool`}
            aria-pressed={activeTool === tool}
            onClick={() => onChangeTool(tool)}
          >
            {icon}<span className={styles.toolLabel}>{label}</span>
          </button>
        ))}
        <span className={styles.toolDivider} aria-hidden="true" />
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => onActionResult(onAddMass(), 'Mass added')}
          title="Add mass"
          aria-label="Add mass"
        >
          <Plus size={13} /><span className={styles.toolLabel}>Add</span>
        </button>
      </div>

      {selectedMass ? (
        <div className={styles.numericEditor}>
          <div className={styles.numericHeading}>
            <strong>{selectedMass.name}</strong>
            <div className={styles.objectActions} role="group" aria-label="Selected mass actions">
              <button type="button" onClick={() => onActionResult(onDuplicateMass(), 'Mass duplicated')} title="Duplicate mass" aria-label="Duplicate selected mass">
                <Copy size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${selectedMass.name}?`)) {
                    onActionResult(onDeleteMass(), 'Mass deleted');
                  }
                }}
                title="Delete mass"
                aria-label="Delete selected mass"
              >
                <Trash2 size={13} />
              </button>
              <button type="button" onClick={onClearSelection} title="Clear selection" aria-label="Clear mass selection">
                <X size={13} />
              </button>
            </div>
          </div>
          <span className={styles.massIdentifier}>{selectedMass.id}</span>
          <div className={styles.numericGrid}>
            {([
              ['x', 'X', 'm'], ['z', 'Z', 'm'], ['width', 'W', 'm'], ['length', 'D', 'm'],
              ['floors', 'FL', ''], ['floorToFloorHeight', 'F2F', 'm'],
            ] as Array<[NumericField, string, string]>).map(([field, label, unit]) => (
              <label key={field}>
                <span>{label}</span>
                <input
                  aria-label={`${label} numeric value`}
                  inputMode="decimal"
                  value={values[field]}
                  onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitField(field);
                    if (event.key === 'Escape') {
                      setValues((current) => ({ ...current, [field]: initial[field] }));
                      event.currentTarget.blur();
                    }
                  }}
                />
                <small>{unit}</small>
              </label>
            ))}
          </div>
          <div className={styles.heightReadout} data-numeric-readout="true">
            {selectedMass.floors} FL × {selectedMass.floorToFloorHeight.toFixed(1)}m = {selectedMass.dimensions.height.toFixed(1)}m
          </div>
        </div>
      ) : (
        <div className={styles.selectionHint}>Select a mass to edit exact geometry</div>
      )}
    </div>
  );
}
