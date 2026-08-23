import * as THREE from 'three';

import type {
  SpatialConsoleSnapshot,
  SpatialMassSnapshot,
  SpatialPoint2,
} from '../spatial-editor-adapter';
import type {
  CameraPreset,
  CameraProjectionMode,
  ViewportDisplayMode,
} from '../types';
import { SpatialConsoleCamera } from './SpatialConsoleCamera';
import {
  snapSpatialValue,
  type SpatialEditProposal,
  type SpatialProposalCommitResult,
  type SpatialProposalViewResult,
} from './spatial-editing-bridge';

interface SpatialConsoleSceneHandlers {
  onSelectMass: (massId: string | null) => void;
  onHoverMass: (massId: string | null) => void;
  onPreviewProposal: (proposal: SpatialEditProposal) => SpatialProposalViewResult;
  onCommitProposal: (proposal: SpatialEditProposal) => SpatialProposalCommitResult;
  onCancelProposal: () => void;
}

interface SyncOptions {
  selectedMassId: string | null;
  displayMode: ViewportDisplayMode;
  projectionMode: CameraProjectionMode;
  showZoningCap: boolean;
  activeTool: 'SELECT' | 'MOVE' | 'RESIZE' | 'HEIGHT';
}

interface PointerGesture {
  button: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

interface EditGesture {
  pointerId: number;
  mode: 'MOVE' | 'RESIZE' | 'HEIGHT';
  massId: string;
  expectedSourceRevisionId: string;
  startGround: THREE.Vector3 | null;
  startClientY: number;
  startPosition: SpatialMassSnapshot['position'];
  startWidth: number;
  startLength: number;
  startFloors: number;
  resizeHandle: 'EAST' | 'WEST' | 'NORTH' | 'SOUTH' | null;
  latestProposal: SpatialEditProposal | null;
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) {
      object.geometry.dispose();
    }
    if ('material' in object) {
      const material = object.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    }
  });
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeTree(child);
  }
}

function openRing(points: readonly SpatialPoint2[]): readonly SpatialPoint2[] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  return first.x === last.x && first.z === last.z ? points.slice(0, -1) : points;
}

function shapeFromRing(points: readonly SpatialPoint2[]): THREE.Shape {
  const shape = new THREE.Shape();
  openRing(points).forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, -point.z);
    else shape.lineTo(point.x, -point.z);
  });
  shape.closePath();
  return shape;
}

function lineFromRing(
  points: readonly SpatialPoint2[],
  y: number,
  material: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
): THREE.Line {
  const ring = [...openRing(points), points[0]].map((point) => new THREE.Vector3(point.x, y, point.z));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), material);
  if (material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  return line;
}

function massRing(mass: SpatialMassSnapshot): SpatialPoint2[] {
  if (mass.footprint) return [...mass.footprint];
  const halfWidth = mass.dimensions.width / 2;
  const halfLength = mass.dimensions.length / 2;
  return [
    { x: mass.position.x - halfWidth, z: mass.position.z - halfLength },
    { x: mass.position.x + halfWidth, z: mass.position.z - halfLength },
    { x: mass.position.x + halfWidth, z: mass.position.z + halfLength },
    { x: mass.position.x - halfWidth, z: mass.position.z + halfLength },
    { x: mass.position.x - halfWidth, z: mass.position.z - halfLength },
  ];
}

function canonicalGeometryKey(snapshot: SpatialConsoleSnapshot): string {
  return JSON.stringify([
    snapshot.caseId,
    snapshot.scenarioId,
    snapshot.revision.revisionId,
    snapshot.site.parcelBoundary.points,
    snapshot.site.planningParcelBoundary,
    snapshot.site.buildableBoundary,
    snapshot.site.zoningHeightLimitMeters,
    snapshot.masses.map((mass) => [
      mass.id,
      mass.position,
      mass.dimensions,
      mass.floors,
      mass.floorToFloorHeight,
      mass.footprint,
    ]),
  ]);
}

export class SpatialConsoleScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new SpatialConsoleCamera();

  private readonly handlers: SpatialConsoleSceneHandlers;
  private readonly surface: HTMLElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly parcelGroup = new THREE.Group();
  private readonly envelopeGroup = new THREE.Group();
  private readonly massGroup = new THREE.Group();
  private readonly editGroup = new THREE.Group();
  private readonly gridGroup = new THREE.Group();
  private readonly massMeshes = new Map<string, THREE.Mesh>();
  private readonly massEdges = new Map<string, THREE.LineSegments>();
  private readonly editHandles: THREE.Mesh[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private readonly contextMenuHandler = (event: Event) => event.preventDefault();

  private snapshot: SpatialConsoleSnapshot | null = null;
  private presentedSnapshot: SpatialConsoleSnapshot | null = null;
  private gesture: PointerGesture | null = null;
  private editGesture: EditGesture | null = null;
  private hoverMassId: string | null = null;
  private selectedMassId: string | null = null;
  private displayMode: ViewportDisplayMode = 'DEVELOPMENT';
  private activeTool: SyncOptions['activeTool'] = 'SELECT';
  private showZoningCap = false;
  private previewValidity: boolean | null = null;
  private geometryKey: string | null = null;
  private animationFrame = 0;
  private damaged = true;
  private disposed = false;

  constructor(surface: HTMLElement, handlers: SpatialConsoleSceneHandlers) {
    this.surface = surface;
    this.handlers = handlers;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    try {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.setClearColor(0x0e1014, 1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.domElement.dataset.spatialConsoleCanvas = 'true';
      Object.assign(this.renderer.domElement.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block',
      });
      surface.appendChild(this.renderer.domElement);

      this.scene.background = new THREE.Color(0x0e1014);
      this.scene.fog = new THREE.Fog(0x0e1014, 300, 850);
      this.scene.add(this.parcelGroup, this.envelopeGroup, this.massGroup, this.editGroup, this.gridGroup);
      this.addLightingAndGround();

      const canvas = this.renderer.domElement;
      canvas.addEventListener('pointerdown', this.onPointerDown);
      canvas.addEventListener('pointermove', this.onPointerMove);
      canvas.addEventListener('pointerup', this.onPointerUp);
      canvas.addEventListener('pointercancel', this.onPointerCancel);
      canvas.addEventListener('pointerleave', this.onPointerLeave);
      canvas.addEventListener('wheel', this.onWheel, { passive: false });
      canvas.addEventListener('contextmenu', this.contextMenuHandler);
      window.addEventListener('keydown', this.onKeyDown);

      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(surface);
      this.handleResize();
      this.animate();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  sync(snapshot: SpatialConsoleSnapshot, options: SyncOptions): void {
    const nextGeometryKey = canonicalGeometryKey(snapshot);
    const geometryChanged = this.geometryKey !== nextGeometryKey;
    const caseChanged = this.snapshot?.caseId !== snapshot.caseId;
    const scopeChanged = this.snapshot !== null && (
      this.snapshot.caseId !== snapshot.caseId
      || this.snapshot.scenarioId !== snapshot.scenarioId
      || this.snapshot.revision.revisionId !== snapshot.revision.revisionId
    );
    const firstSnapshot = this.snapshot === null;
    if (scopeChanged && this.editGesture) this.cancelEditGesture();
    this.snapshot = snapshot;
    this.presentedSnapshot = snapshot;
    this.geometryKey = nextGeometryKey;
    this.selectedMassId = options.selectedMassId;
    this.displayMode = options.displayMode;
    this.activeTool = options.activeTool;
    this.showZoningCap = options.showZoningCap;
    this.previewValidity = null;
    this.camera.setProjection(options.projectionMode);

    if (geometryChanged) {
      this.rebuildCanonicalGeometry(snapshot, options.showZoningCap);
      if (firstSnapshot || caseChanged) this.frameOpening();
    } else {
      this.updateEnvelopeVisibility(options.showZoningCap);
    }
    this.updateMassPresentation();
    this.updateEditHandles();
    this.damage();
  }

  setCameraPreset(preset: CameraPreset): void {
    if (preset === 'FIT' || preset === 'RESET') this.frameSite();
    this.camera.setPreset(preset);
    this.damage();
  }

  fitSite(): void {
    if (!this.snapshot) return;
    this.framePoints(this.snapshot.site.parcelBoundary.points, this.snapshot.metrics.totalHeightMeters);
    this.damage();
  }

  fitProposal(): void {
    if (!this.snapshot?.masses.length) return this.fitSite();
    this.framePoints(this.snapshot.masses.flatMap((mass) => massRing(mass)), this.snapshot.metrics.totalHeightMeters);
    this.damage();
  }

  fitSelection(): void {
    const mass = this.snapshot?.masses.find((item) => item.id === this.selectedMassId);
    if (!mass) return;
    this.framePoints(massRing(mass), mass.position.y + mass.dimensions.height, 1.8);
    this.damage();
  }

  worldUnitsPerPixel(): number {
    return this.camera.worldUnitsPerPixel();
  }

  northScreenAngleDegrees(): number | null {
    const rotation = this.snapshot?.frame.northRotationDegrees;
    if (rotation === undefined || !Number.isFinite(rotation)) return null;
    const radians = THREE.MathUtils.degToRad(rotation);
    const trueNorth = new THREE.Vector3(-Math.sin(radians), 0, Math.cos(radians));
    return this.camera.screenAngleForWorldDirection(trueNorth);
  }

  getMassCount(): number {
    return this.massMeshes.size;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerCancel);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.contextMenuHandler);
    window.removeEventListener('keydown', this.onKeyDown);
    disposeTree(this.scene);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
    this.massMeshes.clear();
    this.massEdges.clear();
    this.editHandles.length = 0;
    this.snapshot = null;
    this.presentedSnapshot = null;
  }

  private addLightingAndGround(): void {
    this.scene.add(new THREE.HemisphereLight(0xc7d8e6, 0x161a22, 0.62));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.45);
    sun.position.set(110, 170, 95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { near: 1, far: 600, left: -180, right: 180, top: 180, bottom: -180 });
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7896b4, 0.24);
    fill.position.set(-120, 90, -100);
    this.scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.96 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.025;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(600, 120, 0x39404c, 0x202630);
    grid.position.y = -0.01;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.42;
    this.gridGroup.add(grid);
  }

  private rebuildCanonicalGeometry(snapshot: SpatialConsoleSnapshot, showZoningCap: boolean): void {
    this.presentedSnapshot = snapshot;
    clearGroup(this.parcelGroup);
    clearGroup(this.envelopeGroup);
    clearGroup(this.massGroup);
    clearGroup(this.editGroup);
    this.massMeshes.clear();
    this.massEdges.clear();
    this.editHandles.length = 0;

    const parcelShape = shapeFromRing(snapshot.site.parcelBoundary.points);
    const parcelGeometry = new THREE.ShapeGeometry(parcelShape);
    parcelGeometry.rotateX(-Math.PI / 2);
    const parcel = new THREE.Mesh(parcelGeometry, new THREE.MeshStandardMaterial({
      color: 0x181d26, roughness: 0.88, transparent: true, opacity: 0.96, side: THREE.DoubleSide,
    }));
    parcel.position.y = 0.006;
    parcel.receiveShadow = true;
    this.parcelGroup.add(parcel);
    this.parcelGroup.add(lineFromRing(snapshot.site.parcelBoundary.points, 0.06, new THREE.LineBasicMaterial({ color: 0xd3d9e2 })));
    this.parcelGroup.add(lineFromRing(snapshot.site.planningParcelBoundary, 0.075, new THREE.LineDashedMaterial({
      color: 0x6f93b9, dashSize: 2, gapSize: 1.4, transparent: true, opacity: 0.55,
    })));

    const buildableShape = shapeFromRing(snapshot.site.buildableBoundary);
    const buildableGeometry = new THREE.ShapeGeometry(buildableShape);
    buildableGeometry.rotateX(-Math.PI / 2);
    const buildable = new THREE.Mesh(buildableGeometry, new THREE.MeshBasicMaterial({
      color: 0xb9768d, transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false,
    }));
    buildable.position.y = 0.045;
    this.parcelGroup.add(buildable);
    this.parcelGroup.add(lineFromRing(snapshot.site.buildableBoundary, 0.08, new THREE.LineDashedMaterial({
      color: 0xc98da2, dashSize: 1.6, gapSize: 1.1,
    })));

    if (snapshot.site.zoningHeightLimitMeters) {
      const points = openRing(snapshot.site.buildableBoundary);
      const xs = points.map((point) => point.x);
      const zs = points.map((point) => point.z);
      const minX = Math.min(...xs); const maxX = Math.max(...xs);
      const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
      const geometry = new THREE.BoxGeometry(maxX - minX, snapshot.site.zoningHeightLimitMeters, maxZ - minZ);
      const envelope = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: 0xb9768d, wireframe: true, transparent: true, opacity: 0.16,
      }));
      envelope.name = 'zoning-envelope';
      envelope.position.set(
        (minX + maxX) / 2,
        snapshot.site.zoningHeightLimitMeters / 2,
        (minZ + maxZ) / 2,
      );
      this.envelopeGroup.add(envelope);
    }
    this.updateEnvelopeVisibility(showZoningCap);

    for (const mass of snapshot.masses) this.addMass(mass);
  }

  private addMass(mass: SpatialMassSnapshot): void {
    const height = mass.dimensions.height;
    let geometry: THREE.BufferGeometry;
    let position: THREE.Vector3;
    if (mass.footprint) {
      geometry = new THREE.ExtrudeGeometry(shapeFromRing(mass.footprint), { depth: height, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      position = new THREE.Vector3(0, mass.position.y, 0);
    } else {
      geometry = new THREE.BoxGeometry(mass.dimensions.width, height, mass.dimensions.length);
      position = new THREE.Vector3(mass.position.x, mass.position.y + height / 2, mass.position.z);
    }
    const mesh = new THREE.Mesh(geometry, this.createMassMaterial(mass));
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.massId = mass.id;
    mesh.userData.massType = mass.type;
    this.massGroup.add(mesh);
    this.massMeshes.set(mass.id, mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: 0xdbe1e8, transparent: true, opacity: 0.58 }),
    );
    edges.position.copy(position);
    edges.userData.massId = mass.id;
    this.massGroup.add(edges);
    this.massEdges.set(mass.id, edges);

    const ring = massRing(mass);
    for (let floor = 1; floor < mass.floors; floor += 1) {
      const floorY = mass.position.y + Math.min(height, floor * mass.floorToFloorHeight);
      const line = lineFromRing(ring, floorY, new THREE.LineBasicMaterial({
        color: 0xe8edf2, transparent: true, opacity: 0.28,
      }));
      line.userData.massId = mass.id;
      this.massGroup.add(line);
    }
  }

  private createMassMaterial(mass: SpatialMassSnapshot): THREE.MeshStandardMaterial {
    const colors = {
      PODIUM: 0xc4ad7e,
      TOWER: 0x82a4cc,
      GENERAL: 0x9aa989,
      COURTYARD: 0xa7836c,
    };
    return new THREE.MeshStandardMaterial({
      color: colors[mass.type],
      roughness: 0.5,
      metalness: mass.type === 'TOWER' ? 0.1 : 0.04,
    });
  }

  private updateMassPresentation(): void {
    for (const [massId, mesh] of this.massMeshes) {
      const mass = this.presentedSnapshot?.masses.find((item) => item.id === massId);
      if (!mass) continue;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (massId === this.selectedMassId && this.previewValidity !== null) {
        material.color.set(this.previewValidity ? 0x8fb9aa : 0xcf6f7f);
        material.emissive.set(this.previewValidity ? 0x112d25 : 0x351018);
        material.emissiveIntensity = 0.52;
        material.transparent = true;
        material.opacity = 0.72;
      } else if (massId === this.selectedMassId) {
        material.color.set(0xd9b87a);
        material.emissive.set(0x2a1d0a);
        material.emissiveIntensity = 0.42;
        material.transparent = false;
        material.opacity = 1;
      } else if (massId === this.hoverMassId) {
        material.color.set(0xe1c895);
        material.emissive.set(0x17120a);
        material.emissiveIntensity = 0.2;
        material.transparent = false;
        material.opacity = 1;
      } else {
        const next = this.createMassMaterial(mass);
        material.color.copy(next.color);
        material.emissive.set(0x000000);
        material.emissiveIntensity = 0;
        material.transparent = false;
        material.opacity = 1;
        next.dispose();
      }
      material.wireframe = this.displayMode === 'MONOCHROME';
      const edgeMaterial = this.massEdges.get(massId)?.material as THREE.LineBasicMaterial | undefined;
      if (edgeMaterial) {
        edgeMaterial.color.set(massId === this.selectedMassId ? 0xffe2a6 : 0xdbe1e8);
        edgeMaterial.opacity = massId === this.selectedMassId ? 1 : massId === this.hoverMassId ? 0.82 : 0.58;
      }
      if (this.displayMode === 'CONSTRAINTS' && !this.snapshot?.compliance.isCompliant) {
        material.color.lerp(new THREE.Color(0xc66969), 0.32);
      }
    }
  }

  private updateEnvelopeVisibility(visible: boolean): void {
    this.envelopeGroup.visible = visible;
  }

  private updateEditHandles(): void {
    clearGroup(this.editGroup);
    this.editHandles.length = 0;
    const mass = this.presentedSnapshot?.masses.find((item) => item.id === this.selectedMassId);
    if (!mass || this.activeTool === 'SELECT') return;
    const ring = openRing(massRing(mass));
    const xs = ring.map((point) => point.x);
    const zs = ring.map((point) => point.z);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    if (this.activeTool === 'RESIZE') {
      const handles: Array<[EditGesture['resizeHandle'], number, number]> = [
        ['EAST', maxX, centerZ], ['WEST', minX, centerZ],
        ['NORTH', centerX, maxZ], ['SOUTH', centerX, minZ],
      ];
      for (const [handle, x, z] of handles) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 1.2, 2.8),
          new THREE.MeshBasicMaterial({ color: 0xe2c17f, depthTest: false }),
        );
        mesh.position.set(x, mass.position.y + 0.7, z);
        mesh.userData.editHandle = handle;
        mesh.renderOrder = 20;
        this.editGroup.add(mesh);
        this.editHandles.push(mesh);
      }
    } else if (this.activeTool === 'HEIGHT') {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 3.2, 3.2),
        new THREE.MeshBasicMaterial({ color: 0xe2c17f, depthTest: false }),
      );
      mesh.position.set(centerX, mass.position.y + mass.dimensions.height + 2.2, centerZ);
      mesh.userData.editHandle = 'HEIGHT';
      mesh.renderOrder = 20;
      this.editGroup.add(mesh);
      this.editHandles.push(mesh);
    } else if (this.activeTool === 'MOVE') {
      this.editGroup.add(lineFromRing(massRing(mass), mass.position.y + 0.18, new THREE.LineDashedMaterial({
        color: 0xe2c17f, dashSize: 1.2, gapSize: 0.7, depthTest: false,
      })));
    }
  }

  private groundPoint(event: PointerEvent): THREE.Vector3 | null {
    this.setRayFromEvent(event);
    const result = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), result)
      ? result
      : null;
  }

  private pickEditHandle(event: PointerEvent): EditGesture['resizeHandle'] | 'HEIGHT' | null {
    if (this.editHandles.length === 0) return null;
    this.setRayFromEvent(event);
    const hit = this.raycaster.intersectObjects(this.editHandles, false)[0];
    const handle = hit?.object.userData.editHandle;
    return ['EAST', 'WEST', 'NORTH', 'SOUTH', 'HEIGHT'].includes(handle) ? handle : null;
  }

  private applyPreviewResult(result: SpatialProposalViewResult): void {
    this.previewValidity = result.valid;
    if (result.snapshot) {
      this.rebuildCanonicalGeometry(result.snapshot, this.showZoningCap);
      this.updateMassPresentation();
      this.updateEditHandles();
    }
    this.damage();
  }

  private restoreCanonicalPresentation(): void {
    if (!this.snapshot) return;
    this.previewValidity = null;
    this.rebuildCanonicalGeometry(this.snapshot, this.showZoningCap);
    this.updateMassPresentation();
    this.updateEditHandles();
    this.damage();
  }

  private cancelEditGesture(): void {
    this.editGesture = null;
    this.handlers.onCancelProposal();
    this.restoreCanonicalPresentation();
  }

  private frameSite(): void {
    this.frameOpening();
  }

  private frameOpening(): void {
    if (!this.snapshot) return;
    const all = [
      ...this.snapshot.site.planningParcelBoundary,
      ...this.snapshot.site.buildableBoundary,
      ...this.snapshot.masses.flatMap((mass) => massRing(mass)),
    ];
    this.framePoints(all, this.snapshot.metrics.totalHeightMeters);
  }

  private framePoints(points: readonly SpatialPoint2[], height: number, margin = 1.35): void {
    if (points.length === 0) return;
    const xs = points.map((point) => point.x);
    const zs = points.map((point) => point.z);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
    const center = new THREE.Vector3((minX + maxX) / 2, Math.max(0, height) / 3, (minZ + maxZ) / 2);
    const radius = Math.max(Math.hypot(maxX - minX, maxZ - minZ) / 2, height / 2, 10);
    this.camera.frame(center, radius, margin);
  }

  private setRayFromEvent(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera.camera);
  }

  private pickMass(event: PointerEvent): string | null {
    this.setRayFromEvent(event);
    for (const hit of this.raycaster.intersectObjects([...this.massMeshes.values()], false)) {
      const massId = hit.object.userData.massId;
      if (typeof massId === 'string') return massId;
    }
    return null;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    const selected = this.presentedSnapshot?.masses.find((mass) => mass.id === this.selectedMassId);
    const pickedHandle = event.button === 0 ? this.pickEditHandle(event) : null;
    const pickedMassId = event.button === 0 ? this.pickMass(event) : null;
    const canMove = this.activeTool === 'MOVE' && selected && pickedMassId === selected.id;
    const canResize = this.activeTool === 'RESIZE' && selected
      && pickedHandle && pickedHandle !== 'HEIGHT';
    const canChangeHeight = this.activeTool === 'HEIGHT' && selected
      && (pickedHandle === 'HEIGHT' || pickedMassId === selected.id);

    if (event.button === 0 && selected && (canMove || canResize || canChangeHeight) && this.snapshot) {
      const mode: EditGesture['mode'] = canMove ? 'MOVE' : canResize ? 'RESIZE' : 'HEIGHT';
      this.editGesture = {
        pointerId: event.pointerId,
        mode,
        massId: selected.id,
        expectedSourceRevisionId: this.snapshot.revision.revisionId,
        startGround: mode === 'HEIGHT' ? null : this.groundPoint(event),
        startClientY: event.clientY,
        startPosition: { ...selected.position },
        startWidth: selected.dimensions.width,
        startLength: selected.dimensions.length,
        startFloors: selected.floors,
        resizeHandle: mode === 'RESIZE' ? pickedHandle as EditGesture['resizeHandle'] : null,
        latestProposal: null,
      };
      this.renderer.domElement.setPointerCapture(event.pointerId);
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }

    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.renderer.domElement.style.cursor = 'grabbing';
    this.gesture = {
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.disposed) return;
    if (this.editGesture && this.snapshot) {
      const edit = this.editGesture;
      const base = {
        caseId: this.snapshot.caseId,
        scenarioId: this.snapshot.scenarioId,
        targetId: edit.massId,
        expectedSourceRevisionId: edit.expectedSourceRevisionId,
      };
      let proposal: SpatialEditProposal | null = null;
      if (edit.mode === 'MOVE') {
        const current = this.groundPoint(event);
        if (current && edit.startGround) {
          proposal = {
            ...base,
            type: 'MOVE_MASS',
            position: {
              ...edit.startPosition,
              x: snapSpatialValue(edit.startPosition.x + current.x - edit.startGround.x),
              z: snapSpatialValue(edit.startPosition.z + current.z - edit.startGround.z),
            },
          };
        }
      } else if (edit.mode === 'RESIZE') {
        const current = this.groundPoint(event);
        if (current && edit.startGround && edit.resizeHandle) {
          const dx = current.x - edit.startGround.x;
          const dz = current.z - edit.startGround.z;
          const widthDelta = edit.resizeHandle === 'EAST' ? dx * 2 : edit.resizeHandle === 'WEST' ? -dx * 2 : 0;
          const lengthDelta = edit.resizeHandle === 'NORTH' ? dz * 2 : edit.resizeHandle === 'SOUTH' ? -dz * 2 : 0;
          proposal = {
            ...base,
            type: 'RESIZE_MASS',
            width: snapSpatialValue(edit.startWidth + widthDelta),
            length: snapSpatialValue(edit.startLength + lengthDelta),
          };
        }
      } else {
        proposal = {
          ...base,
          type: 'SET_MASS_FLOORS',
          floors: Math.max(1, edit.startFloors + Math.round((edit.startClientY - event.clientY) / 14)),
        };
      }
      if (proposal) {
        edit.latestProposal = proposal;
        this.applyPreviewResult(this.handlers.onPreviewProposal(proposal));
      }
      return;
    }
    if (this.gesture) {
      const dx = event.clientX - this.gesture.lastX;
      const dy = event.clientY - this.gesture.lastY;
      if (Math.hypot(event.clientX - this.gesture.startX, event.clientY - this.gesture.startY) > 3) {
        this.gesture.moved = true;
      }
      if (this.gesture.button === 0) this.camera.orbit(dx * 0.007, dy * 0.007);
      else this.camera.pan(dx * this.camera.worldUnitsPerPixel(), dy * this.camera.worldUnitsPerPixel());
      this.gesture.lastX = event.clientX;
      this.gesture.lastY = event.clientY;
      this.damage();
      return;
    }
    const nextHover = this.pickMass(event);
    if (nextHover !== this.hoverMassId) {
      this.hoverMassId = nextHover;
      this.handlers.onHoverMass(nextHover);
      this.updateMassPresentation();
      this.damage();
    }
    this.renderer.domElement.style.cursor = nextHover ? 'pointer' : 'grab';
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.editGesture) {
      const edit = this.editGesture;
      this.editGesture = null;
      if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
        this.renderer.domElement.releasePointerCapture(event.pointerId);
      }
      if (edit.latestProposal) {
        const result = this.handlers.onCommitProposal(edit.latestProposal);
        if (!result.accepted) this.restoreCanonicalPresentation();
      } else {
        this.restoreCanonicalPresentation();
      }
      this.renderer.domElement.style.cursor = this.hoverMassId ? 'pointer' : 'grab';
      return;
    }
    const gesture = this.gesture;
    this.gesture = null;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }
    if (gesture?.button === 0 && !gesture.moved) this.handlers.onSelectMass(this.pickMass(event));
    this.renderer.domElement.style.cursor = this.hoverMassId ? 'pointer' : 'grab';
  };

  private onPointerCancel = (): void => {
    if (this.editGesture) {
      this.cancelEditGesture();
      return;
    }
    this.gesture = null;
    this.renderer.domElement.style.cursor = this.hoverMassId ? 'pointer' : 'grab';
  };

  private onPointerLeave = (): void => {
    if (!this.gesture && !this.editGesture && this.hoverMassId) {
      this.hoverMassId = null;
      this.handlers.onHoverMass(null);
      this.updateMassPresentation();
      this.damage();
    }
    this.renderer.domElement.style.cursor = 'grab';
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.camera.zoom(Math.exp(event.deltaY * 0.0012));
    this.damage();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && (this.editGesture || this.previewValidity !== null)) {
      event.preventDefault();
      this.cancelEditGesture();
    }
  };

  private handleResize = (): void => {
    const rect = this.surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.setAspect(width / height, height);
    this.damage();
  };

  private damage(): void {
    this.damaged = true;
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const cameraChanged = this.camera.update();
    if (this.damaged || cameraChanged) {
      this.renderer.render(this.scene, this.camera.camera);
      this.damaged = false;
    }
  };
}
