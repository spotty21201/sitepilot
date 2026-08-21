'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { 
  ViewportDisplayMode, 
  CameraProjectionMode, 
  CameraPreset, 
  ManipulationTool 
} from './types';
import { BuildingMass, DevelopmentScenario, SiteGeometry } from '@/types';
import { getCanonicalParcelBounds } from '@/lib/geometry/engine';
import { createPascalArrowMesh, HandleType, DragState } from './PascalTransformHandles';
import { Activity, Navigation, AlertTriangle, Maximize2 } from 'lucide-react';

interface ViewportCanvasProps {
  site: SiteGeometry;
  scenario: DevelopmentScenario;
  displayMode: ViewportDisplayMode;
  projectionMode: CameraProjectionMode;
  cameraPreset: CameraPreset;
  activeTool?: ManipulationTool;
  selectedMassId: string | null;
  isRotating: boolean;
  showDimensions?: boolean;
  showZoningCap: boolean;
  onSelectMass: (massId: string | null) => void;
  onUpdateMassGeometry?: (massId: string, updates: Partial<BuildingMass>) => void;
  onHoverMass?: (massId: string | null) => void;
  onSetCameraPreset: (preset: CameraPreset) => void;
}

export function ViewportCanvas({
  site,
  scenario,
  displayMode,
  projectionMode,
  cameraPreset,
  selectedMassId,
  isRotating,
  showZoningCap,
  onSelectMass,
  onUpdateMassGeometry,
  onSetCameraPreset
}: ViewportCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGlReady, setWebGlReady] = useState(false);
  const [compassAngle, setCompassAngle] = useState(45);

  // Drag interaction state for Pascal on-canvas measurement pill
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const massMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const handleMeshesRef = useRef<Map<HandleType, THREE.Object3D>>(new Map());

  const setbacks = scenario.assumptionsUsed.setbacks;
  const bounds = getCanonicalParcelBounds(site.grossSiteArea, setbacks, site.frontageLength || 110);
  const zoningHeightCap = 32.0;

  const towerMaxHeight = scenario.metrics.totalHeightMeters;
  const heightOverrun = towerMaxHeight > zoningHeightCap ? Math.round((towerMaxHeight - zoningHeightCap) * 10) / 10 : 0;

  const selectedMass = scenario.masses.find(m => m.id === selectedMassId) || null;

  // Apply Camera Position, Target, Up Vector & Projection Matrix
  const applyCameraTransform = useCallback((preset: CameraPreset, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => {
    switch (preset) {
      case 'TOP':
        camera.position.set(0, 260, 0);
        camera.up.set(0, 0, -1); // North is screen-up
        camera.lookAt(0, 0, 0);
        break;
      case 'SOUTH':
      case 'FRONT': // Primary street frontage (positive Y)
        camera.position.set(0, 20, bounds.maxY + 150);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 14, 0);
        break;
      case 'NORTH':
      case 'REAR': // North rear perimeter
        camera.position.set(0, 20, bounds.minY - 150);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 14, 0);
        break;
      case 'EAST': // Positive X
        camera.position.set(bounds.maxX + 150, 20, 0);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 14, 0);
        break;
      case 'WEST': // Negative X
        camera.position.set(bounds.minX - 150, 20, 0);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 14, 0);
        break;
      case 'RESET':
      case 'ISO':
      default:
        camera.position.set(135, 120, 145);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 15, 0);
        break;
    }

    camera.updateProjectionMatrix();

    // Compute horizontal azimuth for the compass
    const az = Math.atan2(camera.position.x, camera.position.z) * (180 / Math.PI);
    setCompassAngle(Math.round(az));
  }, [bounds]);

  // Handle Preset or Projection Updates
  useEffect(() => {
    if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
    applyCameraTransform(cameraPreset, cameraRef.current);
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [cameraPreset, projectionMode, applyCameraTransform]);

  // Main Three.js Scene Setup & Geometry Rebuild
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const width = Math.max(container.clientWidth || 0, 600);
    const height = Math.max(container.clientHeight || 0, 480);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Palette Background
    if (displayMode === 'MONOCHROME') {
      scene.background = new THREE.Color('#0e131d');
    } else if (displayMode === 'CONSTRAINTS') {
      scene.background = new THREE.Color('#080d14');
    } else {
      scene.background = new THREE.Color('#0a0d14');
    }

    // Camera Configuration
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    if (projectionMode === 'ORTHOGRAPHIC') {
      const aspect = width / height;
      const d = 95;
      camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 2000);
    } else {
      camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    }

    applyCameraTransform(cameraPreset, camera);
    cameraRef.current = camera;

    // Renderer Initialization
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Architectural Lighting
    const ambientLight = new THREE.AmbientLight('#ffffff', displayMode === 'MONOCHROME' ? 1.3 : 0.95);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      displayMode === 'MONOCHROME' ? '#ffffff' : '#38bdf8',
      '#0f172a',
      0.85
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', 0.5);
    keyLight.position.set(80, 150, 80);
    scene.add(keyLight);

    // Ground Grid Datum
    const grid = new THREE.GridHelper(320, 64, '#263147', '#121722');
    grid.position.y = -0.05;
    scene.add(grid);

    const massMeshes = new Map<string, THREE.Mesh>();
    massMeshesRef.current = massMeshes;
    const handleMeshes = new Map<HandleType, THREE.Object3D>();
    handleMeshesRef.current = handleMeshes;

    // 1. Site Boundary Mesh & Edge
    const siteGeometry = new THREE.PlaneGeometry(bounds.width, bounds.length);
    const siteMat = new THREE.MeshStandardMaterial({
      color: displayMode === 'MONOCHROME' ? '#1a2333' : '#121824',
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    const siteMesh = new THREE.Mesh(siteGeometry, siteMat);
    siteMesh.rotation.x = -Math.PI / 2;
    scene.add(siteMesh);

    const siteEdgeGeo = new THREE.EdgesGeometry(siteGeometry);
    const siteEdgeLine = new THREE.LineSegments(
      siteEdgeGeo,
      new THREE.LineBasicMaterial({ 
        color: displayMode === 'MONOCHROME' ? '#94a3b8' : '#38bdf8', 
        linewidth: 2.0 
      })
    );
    siteEdgeLine.rotation.x = -Math.PI / 2;
    siteEdgeLine.position.y = 0.02;
    scene.add(siteEdgeLine);

    // 2. Net Buildable Area
    const bW = bounds.buildableWidth;
    const bL = bounds.buildableLength;
    const bCenterX = (bounds.buildableMinX + bounds.buildableMaxX) / 2;
    const bCenterZ = (bounds.buildableMinY + bounds.buildableMaxY) / 2;

    const buildableGeo = new THREE.PlaneGeometry(bW, bL);
    const buildableMat = new THREE.MeshBasicMaterial({
      color: '#10b981',
      transparent: true,
      opacity: displayMode === 'CONSTRAINTS' ? 0.25 : 0.12,
      side: THREE.DoubleSide
    });
    const buildableMesh = new THREE.Mesh(buildableGeo, buildableMat);
    buildableMesh.rotation.x = -Math.PI / 2;
    buildableMesh.position.set(bCenterX, 0.04, bCenterZ);
    scene.add(buildableMesh);

    const buildableEdgeLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(buildableGeo),
      new THREE.LineBasicMaterial({ color: '#10b981', linewidth: 1.5 })
    );
    buildableEdgeLine.rotation.x = -Math.PI / 2;
    buildableEdgeLine.position.set(bCenterX, 0.06, bCenterZ);
    scene.add(buildableEdgeLine);

    // 3. Primary Arterial Frontage Road
    const roadGeo = new THREE.PlaneGeometry(bounds.width + 40, 20);
    const roadMat = new THREE.MeshStandardMaterial({ color: '#0d1118', roughness: 0.9 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0.01, bounds.maxY + 10);
    scene.add(roadMesh);

    // 4. Secondary Northern Access Corridor (6.5m strip)
    const corridorGeo = new THREE.PlaneGeometry(6.5, 40);
    const corridorMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
    const corridorMesh = new THREE.Mesh(corridorGeo, corridorMat);
    corridorMesh.rotation.x = -Math.PI / 2;
    corridorMesh.position.set(bounds.minX + 3.25, 0.02, bounds.minY + 5);
    scene.add(corridorMesh);

    // 5. Zoning Envelope Volume
    if (displayMode === 'CONSTRAINTS' || showZoningCap) {
      const envelopeGeo = new THREE.BoxGeometry(bW, zoningHeightCap, bL);
      const envelopeMat = new THREE.MeshBasicMaterial({
        color: '#10b981',
        transparent: true,
        opacity: 0.1,
        wireframe: false
      });
      const envelopeMesh = new THREE.Mesh(envelopeGeo, envelopeMat);
      envelopeMesh.position.set(bCenterX, zoningHeightCap / 2, bCenterZ);
      scene.add(envelopeMesh);

      const envelopeEdges = new THREE.EdgesGeometry(envelopeGeo);
      envelopeMesh.add(
        new THREE.LineSegments(
          envelopeEdges,
          new THREE.LineBasicMaterial({ color: '#10b981', linewidth: 1.5 })
        )
      );
    }

    // 6. Development Masses
    scenario.masses.forEach((mass) => {
      const w = mass.dimensions.width;
      const l = mass.dimensions.length;
      const h = mass.dimensions.height;
      const posX = mass.position.x;
      const baseElevation = mass.position.y || 0;
      const posY = baseElevation + h / 2;
      const posZ = mass.position.z;
      const isSelected = mass.id === selectedMassId;

      const geometry = new THREE.BoxGeometry(w, h, l);

      // Material styling per visual mode
      let material: THREE.Material;
      if (displayMode === 'MONOCHROME') {
        material = new THREE.MeshStandardMaterial({
          color: isSelected ? '#ffffff' : '#f8fafc',
          roughness: 0.15,
          metalness: 0.05
        });
      } else if (displayMode === 'CONSTRAINTS') {
        material = new THREE.MeshStandardMaterial({
          color: mass.type === 'PODIUM' ? '#38bdf8' : '#e2b170',
          roughness: 0.4,
          metalness: 0.1,
          transparent: true,
          opacity: 0.75
        });
      } else {
        material = new THREE.MeshStandardMaterial({
          color: mass.type === 'PODIUM' ? '#38bdf8' : '#e2b170',
          roughness: 0.35,
          metalness: 0.15
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(posX, posY, posZ);
      mesh.userData = { massId: mass.id, isMass: true };
      scene.add(mesh);
      massMeshes.set(mass.id, mesh);

      // Outer Edge Linework (Architectural Stark Ink Edges)
      const edgeGeo = new THREE.EdgesGeometry(geometry);
      const edgeMat = new THREE.LineBasicMaterial({
        color: isSelected 
          ? '#38bdf8' 
          : (displayMode === 'MONOCHROME' ? '#090d16' : '#ffffff'),
        linewidth: isSelected ? 2.5 : (displayMode === 'MONOCHROME' ? 2.0 : 1.2),
        transparent: true,
        opacity: isSelected ? 1.0 : (displayMode === 'MONOCHROME' ? 0.95 : 0.6)
      });
      const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
      mesh.add(edgeLine);

      // Architectural Floor Plate Lines
      const floorHeight = mass.floorToFloorHeight || 3.5;
      for (let f = 1; f < mass.floors; f++) {
        const floorY = -h / 2 + f * floorHeight;
        const floorGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, l));
        const floorMat = new THREE.LineBasicMaterial({
          color: displayMode === 'MONOCHROME' ? '#1e293b' : '#ffffff',
          transparent: true,
          opacity: 0.35
        });
        const floorLines = new THREE.LineSegments(floorGeo, floorMat);
        floorLines.rotation.x = -Math.PI / 2;
        floorLines.position.y = floorY;
        mesh.add(floorLines);
      }

      // Selection Outline Box
      if (isSelected) {
        const haloGeo = new THREE.BoxGeometry(w + 1.0, h + 0.6, l + 1.0);
        const haloMat = new THREE.LineBasicMaterial({ color: '#38bdf8', linewidth: 2.5 });
        const halo = new THREE.LineSegments(new THREE.EdgesGeometry(haloGeo), haloMat);
        mesh.add(halo);

        // ----------------------------------------------------
        // Authentic Pascal In-Canvas Transform Arrow Handles
        // ----------------------------------------------------
        const handlesGroup = new THREE.Group();

        // 1. East Width Arrow (+X)
        const eastArrow = createPascalArrowMesh('X', '#38bdf8');
        eastArrow.position.set(w / 2 + 2.0, 0, 0);
        eastArrow.userData = { isHandle: true, handleType: 'EAST_WIDTH' as HandleType, massId: mass.id };
        handlesGroup.add(eastArrow);
        handleMeshes.set('EAST_WIDTH', eastArrow);

        // 2. West Width Arrow (-X)
        const westArrow = createPascalArrowMesh('-X', '#38bdf8');
        westArrow.position.set(-w / 2 - 2.0, 0, 0);
        westArrow.userData = { isHandle: true, handleType: 'WEST_WIDTH' as HandleType, massId: mass.id };
        handlesGroup.add(westArrow);
        handleMeshes.set('WEST_WIDTH', westArrow);

        // 3. South Length Arrow (+Z / Frontage)
        const southArrow = createPascalArrowMesh('Z', '#e2b170');
        southArrow.position.set(0, 0, l / 2 + 2.0);
        southArrow.userData = { isHandle: true, handleType: 'SOUTH_LENGTH' as HandleType, massId: mass.id };
        handlesGroup.add(southArrow);
        handleMeshes.set('SOUTH_LENGTH', southArrow);

        // 4. North Length Arrow (-Z / Rear)
        const northArrow = createPascalArrowMesh('-Z', '#e2b170');
        northArrow.position.set(0, 0, -l / 2 - 2.0);
        northArrow.userData = { isHandle: true, handleType: 'NORTH_LENGTH' as HandleType, massId: mass.id };
        handlesGroup.add(northArrow);
        handleMeshes.set('NORTH_LENGTH', northArrow);

        // 5. Top Height Extrusion Arrow (+Y)
        const topArrow = createPascalArrowMesh('Y', '#10b981');
        topArrow.position.set(0, h / 2 + 2.0, 0);
        topArrow.userData = { isHandle: true, handleType: 'TOP_HEIGHT' as HandleType, massId: mass.id };
        handlesGroup.add(topArrow);
        handleMeshes.set('TOP_HEIGHT', topArrow);

        mesh.add(handlesGroup);
      }

      // Over-height Violation Crown (for masses > 32m in Constraints Mode)
      if (displayMode === 'CONSTRAINTS' && (baseElevation + h) > zoningHeightCap) {
        const overrunH = (baseElevation + h) - zoningHeightCap;
        const overrunGeo = new THREE.BoxGeometry(w, overrunH, l);
        const overrunMat = new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#b91c1c',
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.9
        });
        const overrunMesh = new THREE.Mesh(overrunGeo, overrunMat);
        overrunMesh.position.set(posX, zoningHeightCap + overrunH / 2, posZ);
        scene.add(overrunMesh);

        const overrunLine = new THREE.LineSegments(
          new THREE.EdgesGeometry(overrunGeo),
          new THREE.LineBasicMaterial({ color: '#ffffff' })
        );
        overrunMesh.add(overrunLine);
      }
    });

    // 7. Visual Pairwise Overlap Collision Volumes (Glowing Red Solid Mesh)
    if (scenario.pairwiseOverlap && scenario.pairwiseOverlap.hasOverlap) {
      for (let i = 0; i < scenario.masses.length; i++) {
        for (let j = i + 1; j < scenario.masses.length; j++) {
          const mA = scenario.masses[i];
          const mB = scenario.masses[j];

          const aMinX = mA.position.x - mA.dimensions.width / 2;
          const aMaxX = mA.position.x + mA.dimensions.width / 2;
          const aMinZ = mA.position.z - mA.dimensions.length / 2;
          const aMaxZ = mA.position.z + mA.dimensions.length / 2;

          const bMinX = mB.position.x - mB.dimensions.width / 2;
          const bMaxX = mB.position.x + mB.dimensions.width / 2;
          const bMinZ = mB.position.z - mB.dimensions.length / 2;
          const bMaxZ = mB.position.z + mB.dimensions.length / 2;

          const aMinY = mA.position.y || 0;
          const aMaxY = aMinY + mA.dimensions.height;
          const bMinY = mB.position.y || 0;
          const bMaxY = bMinY + mB.dimensions.height;

          const overlapX = Math.max(0, Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX));
          const overlapZ = Math.max(0, Math.min(aMaxZ, bMaxZ) - Math.max(aMinZ, bMinZ));
          const overlapY = Math.max(0, Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY));

          if (overlapX > 0.05 && overlapZ > 0.05 && overlapY > 0.05) {
            const overlapCenterX = (Math.max(aMinX, bMinX) + Math.min(aMaxX, bMaxX)) / 2;
            const overlapCenterZ = (Math.max(aMinZ, bMinZ) + Math.min(aMaxZ, bMaxZ)) / 2;
            const overlapCenterY = (Math.max(aMinY, bMinY) + Math.min(aMaxY, bMaxY)) / 2;

            const colGeo = new THREE.BoxGeometry(overlapX, overlapY, overlapZ);
            const colMat = new THREE.MeshStandardMaterial({
              color: '#dc2626',
              emissive: '#991b1b',
              emissiveIntensity: 0.8,
              transparent: true,
              opacity: 0.85
            });
            const colMesh = new THREE.Mesh(colGeo, colMat);
            colMesh.position.set(overlapCenterX, overlapCenterY, overlapCenterZ);
            scene.add(colMesh);

            const colEdge = new THREE.LineSegments(
              new THREE.EdgesGeometry(colGeo),
              new THREE.LineBasicMaterial({ color: '#ffffff', linewidth: 2 })
            );
            colMesh.add(colEdge);
          }
        }
      }
    }

    // Synchronous immediate draw
    renderer.render(scene, camera);
    setWebGlReady(true);

    // -----------------------------------------------------------------
    // Interactive Raycasting & Direct Manipulation Drag Controller
    // -----------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDraggingHandle = false;
    let draggingHandleType: HandleType | null = null;
    let dragStartPointer = { x: 0, y: 0 };
    let dragStartDimensions = { width: 0, length: 0, height: 0, floors: 0 };

    const getPointerPos = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
        clientX: event.clientX,
        clientY: event.clientY
      };
    };

    const handlePointerDown = (event: MouseEvent) => {
      const p = getPointerPos(event);
      mouse.x = p.x;
      mouse.y = p.y;

      raycaster.setFromCamera(mouse, camera);

      // Check if clicking a handle first
      const allHandleChildren: THREE.Object3D[] = [];
      handleMeshes.forEach(h => {
        h.traverse(child => {
          if (child instanceof THREE.Mesh) {
            allHandleChildren.push(child);
          }
        });
      });

      const handleHits = raycaster.intersectObjects(allHandleChildren, true);
      if (handleHits.length > 0 && selectedMass) {
        // Find parent with handle metadata
        let obj: THREE.Object3D | null = handleHits[0].object;
        while (obj && !obj.userData?.isHandle) {
          obj = obj.parent;
        }

        if (obj && obj.userData?.isHandle) {
          isDraggingHandle = true;
          draggingHandleType = obj.userData.handleType;
          dragStartPointer = { x: p.clientX, y: p.clientY };
          dragStartDimensions = {
            width: selectedMass.dimensions.width,
            length: selectedMass.dimensions.length,
            height: selectedMass.dimensions.height,
            floors: selectedMass.floors
          };

          setActiveDrag({
            activeHandle: draggingHandleType,
            startPointer: dragStartPointer,
            startDimensions: dragStartDimensions,
            currentValue: draggingHandleType?.includes('WIDTH') ? dragStartDimensions.width : draggingHandleType?.includes('LENGTH') ? dragStartDimensions.length : dragStartDimensions.height,
            deltaValue: 0,
            label: draggingHandleType?.includes('WIDTH') ? 'Width' : draggingHandleType?.includes('LENGTH') ? 'Length' : 'Height'
          });

          event.stopPropagation();
          return;
        }
      }

      // Check if clicking a building mass
      const massHits = raycaster.intersectObjects(Array.from(massMeshes.values()), false);
      if (massHits.length > 0) {
        const hitMassId = massHits[0].object.userData.massId;
        onSelectMass(hitMassId || null);
      } else {
        onSelectMass(null);
      }
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (!isDraggingHandle || !selectedMass || !draggingHandleType || !onUpdateMassGeometry) return;

      const p = getPointerPos(event);
      const dx = p.clientX - dragStartPointer.x;
      const dy = p.clientY - dragStartPointer.y;

      // Sensitivity factor: 0.15 meters per screen pixel
      const scaleFactor = 0.15;

      if (draggingHandleType === 'EAST_WIDTH') {
        const rawDelta = dx * scaleFactor;
        const delta = Math.round(rawDelta * 2) / 2; // 0.5m grid snap
        const newW = Math.max(2, Math.min(110, dragStartDimensions.width + delta));
        const footprint = Math.round(newW * selectedMass.dimensions.length * 10) / 10;
        const gfa = Math.round(footprint * selectedMass.floors * 10) / 10;

        onUpdateMassGeometry(selectedMass.id, {
          footprintArea: footprint,
          gfa,
          dimensions: { ...selectedMass.dimensions, width: newW }
        });

        setActiveDrag(prev => prev ? { ...prev, currentValue: newW, deltaValue: delta } : null);
      } else if (draggingHandleType === 'WEST_WIDTH') {
        const rawDelta = -dx * scaleFactor;
        const delta = Math.round(rawDelta * 2) / 2;
        const newW = Math.max(2, Math.min(110, dragStartDimensions.width + delta));
        const footprint = Math.round(newW * selectedMass.dimensions.length * 10) / 10;
        const gfa = Math.round(footprint * selectedMass.floors * 10) / 10;

        onUpdateMassGeometry(selectedMass.id, {
          footprintArea: footprint,
          gfa,
          dimensions: { ...selectedMass.dimensions, width: newW }
        });

        setActiveDrag(prev => prev ? { ...prev, currentValue: newW, deltaValue: delta } : null);
      } else if (draggingHandleType === 'SOUTH_LENGTH') {
        const rawDelta = dy * scaleFactor;
        const delta = Math.round(rawDelta * 2) / 2;
        const newL = Math.max(2, Math.min(153, dragStartDimensions.length + delta));
        const footprint = Math.round(selectedMass.dimensions.width * newL * 10) / 10;
        const gfa = Math.round(footprint * selectedMass.floors * 10) / 10;

        onUpdateMassGeometry(selectedMass.id, {
          footprintArea: footprint,
          gfa,
          dimensions: { ...selectedMass.dimensions, length: newL }
        });

        setActiveDrag(prev => prev ? { ...prev, currentValue: newL, deltaValue: delta } : null);
      } else if (draggingHandleType === 'NORTH_LENGTH') {
        const rawDelta = -dy * scaleFactor;
        const delta = Math.round(rawDelta * 2) / 2;
        const newL = Math.max(2, Math.min(153, dragStartDimensions.length + delta));
        const footprint = Math.round(selectedMass.dimensions.width * newL * 10) / 10;
        const gfa = Math.round(footprint * selectedMass.floors * 10) / 10;

        onUpdateMassGeometry(selectedMass.id, {
          footprintArea: footprint,
          gfa,
          dimensions: { ...selectedMass.dimensions, length: newL }
        });

        setActiveDrag(prev => prev ? { ...prev, currentValue: newL, deltaValue: delta } : null);
      } else if (draggingHandleType === 'TOP_HEIGHT') {
        const rawDelta = -dy * scaleFactor;
        const delta = Math.round(rawDelta * 2) / 2;
        const f2f = selectedMass.floorToFloorHeight || 3.5;
        const newH = Math.max(f2f, Math.min(84, dragStartDimensions.height + delta));
        const newFloors = Math.max(1, Math.round(newH / f2f));
        const computedH = Math.round(newFloors * f2f * 10) / 10;
        const footprint = selectedMass.footprintArea || (selectedMass.dimensions.width * selectedMass.dimensions.length);
        const gfa = Math.round(footprint * newFloors * 10) / 10;

        onUpdateMassGeometry(selectedMass.id, {
          floors: newFloors,
          height: computedH,
          gfa,
          dimensions: { ...selectedMass.dimensions, height: computedH }
        });

        setActiveDrag(prev => prev ? { ...prev, currentValue: computedH, deltaValue: delta } : null);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingHandle) {
        isDraggingHandle = false;
        draggingHandleType = null;
        setActiveDrag(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // Animation Loop
    let animationFrameId: number;
    let angle = 0.8;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (isRotating) {
        angle += 0.0025;
        camera.position.x = 160 * Math.sin(angle);
        camera.position.z = 160 * Math.cos(angle);
        camera.lookAt(0, 15, 0);
        
        const az = Math.atan2(camera.position.x, camera.position.z) * (180 / Math.PI);
        setCompassAngle(Math.round(az));
        
        renderer.render(scene, camera);
      }
    };

    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: crW, height: crH } = entry.contentRect;
        if (crW > 0 && crH > 0) {
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = crW / crH;
          } else if (camera instanceof THREE.OrthographicCamera) {
            const aspect = crW / crH;
            const d = 95;
            camera.left = -d * aspect;
            camera.right = d * aspect;
            camera.top = d;
            camera.bottom = -d;
          }
          camera.updateProjectionMatrix();
          renderer.setSize(crW, crH);
          renderer.render(scene, camera);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.dispose();
      if (container) container.innerHTML = '';
    };
  }, [
    site,
    scenario,
    displayMode,
    projectionMode,
    selectedMassId,
    selectedMass,
    showZoningCap,
    isRotating,
    bounds,
    cameraPreset,
    applyCameraTransform,
    onSelectMass,
    onUpdateMassGeometry
  ]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#0a0d14] overflow-hidden select-none">
      {/* Loading Indicator */}
      {!webGlReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0d14] text-slate-400 z-10">
          <Activity className="w-5 h-5 animate-pulse text-[#38bdf8] mr-2" />
          <span className="text-xs font-mono">Initializing Pascal 3D Development Engine...</span>
        </div>
      )}

      {/* Main 3D Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating In-World Measurement Pill during direct manipulation */}
      {activeDrag && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#121824]/95 border border-[#38bdf8] px-4 py-2 rounded-full text-white text-xs font-mono font-bold shadow-2xl backdrop-blur-md z-30 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-100">
          <Maximize2 className="w-4 h-4 text-[#38bdf8]" />
          <span>
            {activeDrag.label}: <span className="text-[#38bdf8]">{activeDrag.currentValue.toFixed(1)}m</span>
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${activeDrag.deltaValue >= 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
            {activeDrag.deltaValue >= 0 ? `+${activeDrag.deltaValue.toFixed(1)}m` : `${activeDrag.deltaValue.toFixed(1)}m`}
          </span>
        </div>
      )}

      {/* Dynamic Interactive Compass Orientation Widget in Top-Right */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-20 pointer-events-auto">
        <button
          onClick={() => onSetCameraPreset('TOP')}
          title="Align to North (Plan View)"
          className="flex items-center gap-1.5 bg-[#121622]/95 hover:bg-[#1a2233] border border-[#2b3548] px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white text-xs font-mono font-bold shadow-lg backdrop-blur-md transition-all cursor-pointer"
        >
          <Navigation 
            className="w-3.5 h-3.5 text-rose-400 transition-transform duration-300"
            style={{ transform: `rotate(${-compassAngle}deg)` }}
          />
          <span>N ({((compassAngle % 360) + 360) % 360}°)</span>
        </button>
      </div>

      {/* Mass Collision HUD in Viewport */}
      {scenario.pairwiseOverlap && scenario.pairwiseOverlap.hasOverlap && (
        <div className="absolute top-3 left-3 bg-rose-950/95 border border-rose-600 px-3 py-2 rounded-lg text-rose-100 text-xs font-mono z-20 backdrop-blur-md shadow-xl max-w-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-rose-300">MASS COLLISION ACTIVE</span>
            <span>Overlap: {scenario.pairwiseOverlap.overlapVolumeM3.toLocaleString()} m³</span>
          </div>
        </div>
      )}

      {/* Physical Elevation Datums Attached in Orthographic Views */}
      {(cameraPreset === 'SOUTH' || cameraPreset === 'NORTH' || cameraPreset === 'EAST' || cameraPreset === 'WEST' || cameraPreset === 'FRONT' || cameraPreset === 'REAR') && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
          <div className="space-y-1">
            {heightOverrun > 0 && (
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-400 bg-rose-950/90 px-2.5 py-1 rounded border border-rose-600 w-fit backdrop-blur-md shadow-lg">
                <span>▲ +{towerMaxHeight.toFixed(1)}m</span>
                <span>+{heightOverrun}m Overrun Above 32m Cap</span>
              </div>
            )}
          </div>

          <div className="self-start bg-[#121622]/95 border border-[#2b3548] p-3 rounded-lg text-[11px] font-mono text-slate-300 space-y-1.5 backdrop-blur-md shadow-xl">
            <div className="text-amber-400 font-bold uppercase tracking-wider mb-1 text-xs">
              {cameraPreset === 'SOUTH' || cameraPreset === 'FRONT' 
                ? 'SOUTH FRONTAGE ELEVATION' 
                : cameraPreset === 'NORTH' || cameraPreset === 'REAR' 
                ? 'NORTH REAR ELEVATION' 
                : `${cameraPreset} ELEVATION`}
            </div>

            {/* Exact requested height ticks: +32m, +30m, +9m, +0m */}
            {heightOverrun > 0 && (
              <div className="flex justify-between gap-6 text-rose-400 font-bold border-b border-rose-900 pb-1">
                <span>+{towerMaxHeight.toFixed(1)}m</span>
                <span>Active Overrun ({scenario.metrics.totalFloors} Fl)</span>
              </div>
            )}

            <div className="flex justify-between gap-6 text-emerald-400 font-bold">
              <span>+32m</span>
              <span>Subzone R.9 Height Cap</span>
            </div>

            <div className="flex justify-between gap-6 text-slate-200 font-bold">
              <span>+30m</span>
              <span>Tower Ridge Datum (8 Fl)</span>
            </div>

            <div className="flex justify-between gap-6 text-sky-300">
              <span>+9m</span>
              <span>Podium Roof Datum (2 Fl)</span>
            </div>

            <div className="flex justify-between gap-6 text-slate-400 border-t border-[#222c40] pt-1">
              <span>+0m</span>
              <span>Ground Datum (0,0)</span>
            </div>
          </div>

          {(cameraPreset === 'SOUTH' || cameraPreset === 'FRONT') && (
            <div className="self-center bg-[#161c28]/95 border border-slate-700 px-3 py-1 rounded text-slate-300 text-xs font-mono font-semibold backdrop-blur-md shadow-md">
              {site.address ? `${site.address.split(',')[0].trim().toUpperCase()} FRONTAGE (${bounds.width.toFixed(1)}M)` : `PRIMARY STREET FRONTAGE (${bounds.width.toFixed(1)}M)`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
