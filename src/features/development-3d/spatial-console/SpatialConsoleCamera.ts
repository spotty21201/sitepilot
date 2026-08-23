import * as THREE from 'three';

import type { CameraPreset, CameraProjectionMode } from '../types';

export class SpatialConsoleCamera {
  readonly perspective = new THREE.PerspectiveCamera(42, 1, 0.25, 2000);
  readonly orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 2000);

  private projection: CameraProjectionMode = 'PERSPECTIVE';
  private aspect = 1;
  private viewportHeight = 1;
  private radius = 180;
  private targetRadius = 180;
  private theta = Math.PI / 4;
  private targetTheta = Math.PI / 4;
  private phi = Math.PI / 4;
  private targetPhi = Math.PI / 4;
  private readonly target = new THREE.Vector3();
  private readonly dampedTarget = new THREE.Vector3();

  get camera(): THREE.Camera {
    return this.projection === 'ORTHOGRAPHIC' ? this.orthographic : this.perspective;
  }

  setProjection(projection: CameraProjectionMode): void {
    this.projection = projection;
    this.updateProjection();
  }

  setAspect(aspect: number, viewportHeight: number): void {
    this.aspect = Math.max(0.01, aspect);
    this.viewportHeight = Math.max(1, viewportHeight);
    this.updateProjection();
  }

  setPreset(preset: CameraPreset): void {
    switch (preset) {
      case 'TOP':
        this.targetPhi = 0.001;
        this.targetTheta = Math.PI / 4;
        break;
      case 'NORTH':
      case 'REAR':
        this.targetPhi = Math.PI / 2.25;
        this.targetTheta = 0;
        break;
      case 'SOUTH':
      case 'FRONT':
        this.targetPhi = Math.PI / 2.25;
        this.targetTheta = Math.PI;
        break;
      case 'EAST':
        this.targetPhi = Math.PI / 2.25;
        this.targetTheta = Math.PI / 2;
        break;
      case 'WEST':
        this.targetPhi = Math.PI / 2.25;
        this.targetTheta = -Math.PI / 2;
        break;
      case 'FIT':
      case 'RESET':
      case 'ISO':
      default:
        this.targetPhi = Math.PI / 4.5;
        this.targetTheta = Math.PI / 4;
        break;
    }
  }

  frame(center: THREE.Vector3, radius: number, margin = 1.35): void {
    this.target.copy(center);
    const fov = THREE.MathUtils.degToRad(this.perspective.fov);
    this.targetRadius = Math.max(20, (Math.max(radius, 5) / Math.sin(fov / 2)) * margin);
    this.radius = this.targetRadius;
    this.dampedTarget.copy(center);
    this.updateProjection();
  }

  orbit(deltaX: number, deltaY: number): void {
    this.targetTheta -= deltaX;
    this.targetPhi = THREE.MathUtils.clamp(this.targetPhi + deltaY, 0.001, Math.PI / 2 - 0.001);
  }

  pan(deltaX: number, deltaY: number): void {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.target.addScaledVector(right, -deltaX).addScaledVector(up, deltaY);
  }

  zoom(factor: number): void {
    this.targetRadius = THREE.MathUtils.clamp(this.targetRadius * factor, 8, 1200);
  }

  update(): boolean {
    const previousPosition = this.camera.position.clone();
    const previousTarget = this.dampedTarget.clone();
    const k = 0.16;
    this.radius += (this.targetRadius - this.radius) * k;
    this.theta += (this.targetTheta - this.theta) * k;
    this.phi += (this.targetPhi - this.phi) * k;
    this.dampedTarget.lerp(this.target, k);

    const sinPhi = Math.sin(this.phi);
    const x = this.radius * sinPhi * Math.sin(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * sinPhi * Math.cos(this.theta);
    for (const camera of [this.perspective, this.orthographic]) {
      camera.position.set(
        this.dampedTarget.x + x,
        this.dampedTarget.y + y,
        this.dampedTarget.z + z,
      );
      camera.lookAt(this.dampedTarget);
    }
    this.updateProjection();

    return previousPosition.distanceToSquared(this.camera.position) > 0.000001
      || previousTarget.distanceToSquared(this.dampedTarget) > 0.000001;
  }

  worldUnitsPerPixel(): number {
    const worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.perspective.fov) / 2) * this.radius;
    return worldHeight / this.viewportHeight;
  }

  screenAngleForWorldDirection(direction: THREE.Vector3): number | null {
    if (direction.lengthSq() <= Number.EPSILON) return null;
    this.camera.updateMatrixWorld(true);
    const origin = this.dampedTarget.clone().project(this.camera);
    const tip = this.dampedTarget.clone().add(direction.clone().normalize()).project(this.camera);
    const dx = tip.x - origin.x;
    const dy = tip.y - origin.y;
    if (Math.hypot(dx, dy) < 0.000001) return null;
    return THREE.MathUtils.radToDeg(Math.atan2(dx, dy));
  }

  private updateProjection(): void {
    this.perspective.aspect = this.aspect;
    this.perspective.updateProjectionMatrix();
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(this.perspective.fov) / 2) * this.radius;
    this.orthographic.left = -halfHeight * this.aspect;
    this.orthographic.right = halfHeight * this.aspect;
    this.orthographic.top = halfHeight;
    this.orthographic.bottom = -halfHeight;
    this.orthographic.updateProjectionMatrix();
  }
}
