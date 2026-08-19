'use client';

import React from 'react';
import * as THREE from 'three';
import { BuildingMass } from '@/types';

export type HandleType = 'EAST_WIDTH' | 'WEST_WIDTH' | 'SOUTH_LENGTH' | 'NORTH_LENGTH' | 'TOP_HEIGHT';

interface PascalTransformHandlesProps {
  selectedMass: BuildingMass;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  onUpdateDimensions: (newDimensions: { width?: number; length?: number; height?: number; floors?: number }) => void;
  onCommitChange: () => void;
}

/**
 * Creates authentic Pascal arrow geometry (chevron cone + stem)
 */
export function createPascalArrowMesh(
  direction: 'X' | '-X' | 'Z' | '-Z' | 'Y',
  color: string = '#38bdf8'
): THREE.Group {
  const group = new THREE.Group();

  // Cone Head
  const coneGeo = new THREE.ConeGeometry(0.9, 2.2, 16);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.2,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.3
  });
  const cone = new THREE.Mesh(coneGeo, mat);
  cone.position.y = 1.6;
  group.add(cone);

  // Shaft Cylinder
  const shaftGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.6, 12);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.position.y = 0.5;
  group.add(shaft);

  // Rotate group according to direction
  if (direction === 'X') {
    group.rotation.z = -Math.PI / 2;
  } else if (direction === '-X') {
    group.rotation.z = Math.PI / 2;
  } else if (direction === 'Z') {
    group.rotation.x = Math.PI / 2;
  } else if (direction === '-Z') {
    group.rotation.x = -Math.PI / 2;
  } else if (direction === 'Y') {
    // Default points +Y
  }

  return group;
}

export interface DragState {
  activeHandle: HandleType | null;
  startPointer: { x: number; y: number };
  startDimensions: { width: number; length: number; height: number; floors: number };
  currentValue: number;
  deltaValue: number;
  label: string;
}
