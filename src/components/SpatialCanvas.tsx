'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SiteGeometry, DevelopmentScenario } from '@/types';
import { getCanonicalParcelBounds, checkSetbackEncroachments } from '@/lib/geometry/engine';
import { deriveStreetName } from '@/lib/opportunity/street-name';
import { 
  Layers, 
  Box, 
  Compass, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  CheckCircle2, 
  RotateCcw,
  Navigation,
  Activity
} from 'lucide-react';
import * as THREE from 'three';

interface SpatialCanvasProps {
  site: SiteGeometry;
  activeScenario: DevelopmentScenario;
}

export function SpatialCanvas({ site, activeScenario }: SpatialCanvasProps) {
  const [viewMode, setViewMode] = useState<'2D' | 'CONSTRAINTS' | '3D'>('3D');
  const [cameraPreset, setCameraPresetState] = useState<'TOP' | 'SOUTH' | 'NORTH' | 'EAST' | 'WEST' | 'ISO' | 'FRONT' | 'REAR'>('ISO');
  const threeCanvasRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [webGlReady, setWebGlReady] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const bounds = getCanonicalParcelBounds(
    site.grossSiteArea, 
    activeScenario.assumptionsUsed.setbacks, 
    site.frontageLength || 110
  );
  const streetName = site.streetName || deriveStreetName(site.address).value;

  const encroachments = checkSetbackEncroachments(
    site.grossSiteArea, 
    activeScenario.assumptionsUsed.setbacks, 
    activeScenario.masses
  );

  // Dynamic elevation datums
  const towerMaxHeight = activeScenario.metrics.totalHeightMeters;
  const zoningHeightCap = 32.0;
  const heightOverrun = towerMaxHeight > zoningHeightCap ? Math.round((towerMaxHeight - zoningHeightCap) * 10) / 10 : 0;

  const handleSetCameraPreset = (preset: 'TOP' | 'SOUTH' | 'NORTH' | 'EAST' | 'WEST' | 'ISO' | 'RESET' | 'FRONT' | 'REAR') => {
    setCameraPresetState(preset === 'FRONT' ? 'SOUTH' : preset === 'REAR' ? 'NORTH' : preset === 'RESET' ? 'ISO' : preset);
    setIsRotating(false);
    if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
    const camera = cameraRef.current;

    switch (preset) {
      case 'TOP':
        camera.position.set(0, 240, 0.001);
        camera.lookAt(0, 0, 0);
        break;
      case 'SOUTH':
      case 'FRONT': // Primary street frontage (positive Y)
        camera.position.set(0, 18, bounds.maxY + 130);
        camera.lookAt(0, 14, 0);
        break;
      case 'NORTH':
      case 'REAR': // North rear perimeter (negative Y)
        camera.position.set(0, 18, bounds.minY - 130);
        camera.lookAt(0, 14, 0);
        break;
      case 'EAST':
        camera.position.set(bounds.maxX + 130, 18, 0);
        camera.lookAt(0, 14, 0);
        break;
      case 'WEST':
        camera.position.set(bounds.minX - 130, 18, 0);
        camera.lookAt(0, 14, 0);
        break;
      case 'RESET':
      case 'ISO':
      default:
        camera.position.set(130, 115, 140);
        camera.lookAt(0, 15, 0);
        break;
    }
    camera.updateProjectionMatrix();
    rendererRef.current.render(sceneRef.current, camera);
  };

  // Robust Three.js Engine Lifecycle with ResizeObserver
  useEffect(() => {
    if (!threeCanvasRef.current) return;

    const container = threeCanvasRef.current;
    const width = Math.max(container.clientWidth || 0, 600);
    const height = Math.max(container.clientHeight || 0, 480);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0d14');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(130, 115, 140);
    camera.lookAt(0, 15, 0);
    cameraRef.current = camera;

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

    // Clean Architectural Lighting (No muddy shadows in orthographic views)
    const ambientLight = new THREE.AmbientLight('#ffffff', 1.0);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#38bdf8', '#0f172a', 0.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', 0.6);
    keyLight.position.set(80, 150, 80);
    scene.add(keyLight);

    // Ground Grid Datum
    const grid = new THREE.GridHelper(300, 60, '#263147', '#121722');
    grid.position.y = -0.05;
    scene.add(grid);

    // Site Mesh (16,850 m2 canonical geometry)
    const siteGeometry = new THREE.PlaneGeometry(bounds.width, bounds.length);
    const siteMaterial = new THREE.MeshStandardMaterial({
      color: '#121824',
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const siteMesh = new THREE.Mesh(siteGeometry, siteMaterial);
    siteMesh.rotation.x = -Math.PI / 2;
    scene.add(siteMesh);

    // Site Boundary Line
    const siteEdgeGeo = new THREE.EdgesGeometry(siteGeometry);
    const siteEdgeMat = new THREE.LineBasicMaterial({ color: '#38bdf8', linewidth: 2 });
    const siteEdgeLine = new THREE.LineSegments(siteEdgeGeo, siteEdgeMat);
    siteEdgeLine.rotation.x = -Math.PI / 2;
    siteEdgeLine.position.y = 0.02;
    scene.add(siteEdgeLine);

    // Net Buildable Area Mesh
    const bW = bounds.buildableWidth;
    const bL = bounds.buildableLength;
    const bCenterX = (bounds.buildableMinX + bounds.buildableMaxX) / 2;
    const bCenterZ = (bounds.buildableMinY + bounds.buildableMaxY) / 2;

    const buildableGeo = new THREE.PlaneGeometry(bW, bL);
    const buildableMat = new THREE.MeshBasicMaterial({
      color: '#10b981',
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const buildableMesh = new THREE.Mesh(buildableGeo, buildableMat);
    buildableMesh.rotation.x = -Math.PI / 2;
    buildableMesh.position.set(bCenterX, 0.04, bCenterZ);
    scene.add(buildableMesh);

    const buildableEdgeGeo = new THREE.EdgesGeometry(buildableGeo);
    const buildableEdgeMat = new THREE.LineBasicMaterial({ color: '#10b981', linewidth: 1.5 });
    const buildableEdgeLine = new THREE.LineSegments(buildableEdgeGeo, buildableEdgeMat);
    buildableEdgeLine.rotation.x = -Math.PI / 2;
    buildableEdgeLine.position.set(bCenterX, 0.06, bCenterZ);
    scene.add(buildableEdgeLine);

    // Primary Frontage Road (positive Y / South)
    const roadGeo = new THREE.PlaneGeometry(bounds.width + 40, 20);
    const roadMat = new THREE.MeshStandardMaterial({ color: '#30363f', roughness: 0.9 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0.01, bounds.maxY + 10);
    scene.add(roadMesh);

    // If in Zoning Mode: Render the 32m Height Cap Envelope Volume
    if (viewMode === 'CONSTRAINTS') {
      const envelopeGeo = new THREE.BoxGeometry(bW, zoningHeightCap, bL);
      const envelopeMat = new THREE.MeshBasicMaterial({
        color: '#10b981',
        transparent: true,
        opacity: 0.12,
        wireframe: false
      });
      const envelopeMesh = new THREE.Mesh(envelopeGeo, envelopeMat);
      envelopeMesh.position.set(bCenterX, zoningHeightCap / 2, bCenterZ);
      scene.add(envelopeMesh);

      const envelopeEdges = new THREE.EdgesGeometry(envelopeGeo);
      const envelopeLine = new THREE.LineSegments(envelopeEdges, new THREE.LineBasicMaterial({ color: '#10b981', linewidth: 1.5 }));
      envelopeMesh.add(envelopeLine);
    }

    // Masses Group
    const massGroup = new THREE.Group();
    scene.add(massGroup);

    activeScenario.masses.forEach((mass) => {
      const w = mass.dimensions.width;
      const l = mass.dimensions.length;
      const h = mass.dimensions.height;
      const posX = mass.position.x;
      const posY = (mass.position.y || 0) + h / 2;
      const posZ = mass.position.z;

      const geometry = new THREE.BoxGeometry(w, h, l);
      
      const isViolation = activeScenario.status === 'WARNING_EXCEEDS_CONSTRAINT';
      const color = mass.type === 'PODIUM' 
        ? '#38bdf8' 
        : isViolation 
          ? '#f43f5e' 
          : '#e2b170';

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: viewMode === 'CONSTRAINTS' ? 0.75 : 0.92
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(posX, posY, posZ);

      // Outer Linework
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      mesh.add(wireframe);

      // Floor Lines
      const floorHeight = mass.floorToFloorHeight || 3.5;
      for (let f = 1; f < mass.floors; f++) {
        const floorY = -h / 2 + f * floorHeight;
        const floorGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, l));
        const floorMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 });
        const floorLines = new THREE.LineSegments(floorGeo, floorMat);
        floorLines.rotation.x = -Math.PI / 2;
        floorLines.position.y = floorY;
        mesh.add(floorLines);
      }

      // If in Zoning Mode and mass height > 32m: Render Overrun Crown in glowing Red
      if (viewMode === 'CONSTRAINTS' && ((mass.position.y || 0) + h) > zoningHeightCap) {
        const baseElevation = mass.position.y || 0;
        const overrunHeight = (baseElevation + h) - zoningHeightCap;
        const overrunGeo = new THREE.BoxGeometry(w, overrunHeight, l);
        const overrunMat = new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#b91c1c',
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.9
        });
        const overrunMesh = new THREE.Mesh(overrunGeo, overrunMat);
        overrunMesh.position.set(posX, zoningHeightCap + overrunHeight / 2, posZ);
        scene.add(overrunMesh);

        const overrunEdges = new THREE.EdgesGeometry(overrunGeo);
        overrunMesh.add(new THREE.LineSegments(overrunEdges, new THREE.LineBasicMaterial({ color: '#ffffff' })));
      }

      massGroup.add(mesh);
    });

    // Synchronous immediate render
    renderer.render(scene, camera);
    setWebGlReady(true);

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
        renderer.render(scene, camera);
      }
    };

    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: crW, height: crH } = entry.contentRect;
        if (crW > 0 && crH > 0) {
          camera.aspect = crW / crH;
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
      renderer.dispose();
      if (container) container.innerHTML = '';
    };
  }, [activeScenario, isRotating, bounds, viewMode]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#0c0f17] border border-[#232938] rounded-xl overflow-hidden flex flex-col shadow-inner select-none">
      {/* Top Header Bar: Mode Switcher & Status Chip */}
      <div className="p-2.5 bg-[#121622]/95 border-b border-[#232938] flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-1.5 bg-[#161c2b] p-1 rounded-lg border border-[#2b3548]">
          <button
            onClick={() => setViewMode('2D')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === '2D' ? 'bg-[#2563eb] text-white shadow' : 'text-slate-400 hover:text-slate-100 hover:bg-[#1f2738]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            2D Site Plan (Illustrative)
          </button>
          <button
            onClick={() => setViewMode('CONSTRAINTS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'CONSTRAINTS' ? 'bg-[#2563eb] text-white shadow' : 'text-slate-400 hover:text-slate-100 hover:bg-[#1f2738]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Zoning Envelope
          </button>
          <button
            onClick={() => setViewMode('3D')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === '3D' ? 'bg-[#2563eb] text-white shadow' : 'text-slate-400 hover:text-slate-100 hover:bg-[#1f2738]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D Massing
          </button>
        </div>

        {/* Dynamic Compliance Status Chip & Compass */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#161c2b] border border-[#2b3548] px-2 py-1 rounded-lg text-slate-300 text-[10px] font-mono font-bold">
            <Navigation className="w-3.5 h-3.5 text-rose-400 rotate-[-45deg]" />
            <span>N</span>
          </div>

          {activeScenario.status === 'WARNING_EXCEEDS_CONSTRAINT' || encroachments.length > 0 ? (
            <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-600/70 text-rose-200 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                {encroachments.length > 0 
                  ? encroachments[0].description 
                  : `Exceeds Subzone R.9 Limit (32.0m / 8 Fl) by ${heightOverrun}m`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-600/70 text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{activeScenario.complianceReport?.statusPillLabel ?? 'Within supplied study envelope · Statutory status not yet confirmed'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sub-bar for 3D Camera Controls */}
      {viewMode !== '2D' && (
        <div className="px-3 py-1.5 bg-[#0f131c] border-b border-[#1f2738] flex flex-wrap items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-500 mr-1 uppercase font-bold">Views:</span>
            {(['TOP', 'SOUTH', 'NORTH', 'EAST', 'WEST', 'ISO'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handleSetCameraPreset(p)}
                aria-label={`${p} view`}
                aria-pressed={cameraPreset === p}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  cameraPreset === p
                    ? 'bg-[#2563eb] text-white shadow'
                    : 'bg-[#161c28] hover:bg-[#20293a] text-slate-300'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => handleSetCameraPreset('RESET')}
              title="Reset 3D View"
              aria-label="RESET — restores default view"
              className="flex items-center gap-1 px-2 py-1 bg-[#161c28] hover:bg-[#20293a] text-[#38bdf8] rounded text-[11px] font-mono font-bold cursor-pointer ml-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET</span>
            </button>
          </div>

          <button
            onClick={() => setIsRotating(!isRotating)}
            aria-label={isRotating ? 'Pause Orbit Rotation' : 'Start Auto Orbit'}
            aria-pressed={isRotating}
            className="bg-[#161c28] hover:bg-[#20293a] border border-[#2b3548] text-slate-300 hover:text-white px-2.5 py-1 rounded text-xs flex items-center gap-1.5 font-medium transition-all cursor-pointer"
          >
            {isRotating ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause Orbit</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>Auto Orbit</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Display Canvas */}
      <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden bg-[#0a0d14]">
        {/* Loading Indicator while WebGL context mounts */}
        {!webGlReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0d14] text-slate-400 z-10">
            <Activity className="w-5 h-5 animate-pulse text-[#38bdf8] mr-2" />
            <span className="text-xs font-mono">Initializing Spatial Workspace...</span>
          </div>
        )}

        {/* 3D & Zoning Modes Canvas */}
        <div className={`w-full h-full relative ${viewMode === '2D' ? 'hidden' : 'block'}`}>
          <div ref={threeCanvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
          
          {/* Elevation Datum Overlays (Attached to Physical Horizontal Lines in South/North/East/West Views) */}
          {(cameraPreset === 'SOUTH' || cameraPreset === 'NORTH' || cameraPreset === 'EAST' || cameraPreset === 'WEST' || cameraPreset === 'FRONT' || cameraPreset === 'REAR') && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
              {/* Top Height / Overrun Callout */}
              <div className="space-y-1">
                {heightOverrun > 0 && (
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-400 bg-rose-950/80 px-2 py-1 rounded border border-rose-600 w-fit backdrop-blur-md">
                    <span>▲ +{towerMaxHeight.toFixed(1)}m</span>
                    <span>+{heightOverrun}m Overrun Above 32m Cap</span>
                  </div>
                )}
              </div>

              {/* Dynamic HUD in Corner with +32m, +30m, +9m, +0m */}
              <div className="self-start bg-[#121622]/95 border border-[#2b3548] p-3 rounded-lg text-[11px] font-mono text-slate-300 space-y-1.5 backdrop-blur-md shadow-xl">
                <div className="text-amber-400 font-bold uppercase tracking-wider mb-1 text-xs">
                  {cameraPreset === 'SOUTH' || cameraPreset === 'FRONT' ? 'SOUTH FRONTAGE ELEVATION' : cameraPreset === 'NORTH' || cameraPreset === 'REAR' ? 'NORTH REAR ELEVATION' : `${cameraPreset} ELEVATION`}
                </div>
                
                {heightOverrun > 0 && (
                  <div className="flex justify-between gap-6 text-rose-400 font-bold border-b border-rose-900 pb-1">
                    <span>+{towerMaxHeight.toFixed(1)}m</span>
                    <span>Tower Overrun ({activeScenario.metrics.totalFloors} Fl)</span>
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

              {/* Frontage Road Baseline Callout */}
              {(cameraPreset === 'SOUTH' || cameraPreset === 'FRONT') && (
                <div className="self-center bg-[#161c28]/90 border border-slate-700 px-3 py-1 rounded text-slate-300 text-xs font-mono font-semibold">
                  {`${streetName.toUpperCase()} FRONTAGE (${bounds.width.toFixed(1)}M)`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pure 2D Cadastral Plan Mode with Non-Colliding Indexed Legend */}
        {viewMode === '2D' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-[#0a0d14]">
            <svg viewBox="-90 -115 180 230" className="w-full flex-1 max-w-2xl drop-shadow-2xl">
              {/* Main Road Frontage at South */}
              <rect x="-85" y="76.59" width="170" height="20" fill="#10141e" stroke="#2a3348" strokeWidth="0.8" />
              <text x="0" y="88" fill="#94a3b8" fontSize="4.5" textAnchor="middle" letterSpacing="1" fontWeight="bold">
                {`${streetName.toUpperCase()} (FRONTAGE: ${bounds.width}M)`}
              </text>

              {/* Site Boundary */}
              <rect
                x={bounds.minX}
                y={bounds.minY}
                width={bounds.width}
                height={bounds.length}
                fill="#161f30"
                fillOpacity="0.8"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />

              {/* Buildable Boundary */}
              <rect
                x={bounds.buildableMinX}
                y={bounds.buildableMinY}
                width={bounds.buildableWidth}
                height={bounds.buildableLength}
                fill="#0f172a"
                fillOpacity="0.6"
                stroke="#10b981"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />

              {/* Distinct Building Masses with Indexed Numbers */}
              {activeScenario.masses.map((m, idx) => {
                const w = m.dimensions.width;
                const l = m.dimensions.length;
                const posX = m.position.x - w / 2;
                const posY = m.position.z - l / 2;
                const isViolation = activeScenario.status === 'WARNING_EXCEEDS_CONSTRAINT';

                return (
                  <g key={m.id}>
                    <rect
                      x={posX}
                      y={posY}
                      width={w}
                      height={l}
                      fill={m.type === 'PODIUM' ? '#38bdf8' : isViolation ? '#f43f5e' : '#e2b170'}
                      fillOpacity="0.85"
                      stroke="#ffffff"
                      strokeWidth="0.8"
                      rx="0.5"
                    />
                    <circle cx={posX + w / 2} cy={posY + l / 2} r="4" fill="#0f172a" stroke="#ffffff" strokeWidth="0.6" />
                    <text
                      x={posX + w / 2}
                      y={posY + l / 2 + 1.2}
                      fill="#ffffff"
                      fontSize="3.2"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Dynamic Scenario-Aware Indexed Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2 bg-[#121622] px-3 py-1.5 rounded-lg border border-[#232938] text-[10px] font-mono">
              {activeScenario.masses.map((m, idx) => {
                const nameLower = m.name.toLowerCase();
                const normalized = (m.type === 'PODIUM' || nameLower.includes('podium'))
                  ? 'Podium'
                  : nameLower.includes('east')
                  ? 'East Wing'
                  : nameLower.includes('west')
                  ? 'West Wing'
                  : m.name;
                return (
                  <div key={m.id} className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-white ${m.type === 'PODIUM' ? 'bg-[#2563eb]' : 'bg-[#d97706]'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-slate-300 font-semibold">[{idx + 1}] {normalized}:</span>
                    <span className="text-slate-400">{m.dimensions.width}m × {m.dimensions.length.toFixed(1)}m · {m.floors} Fl ({m.gfa.toLocaleString()} m²)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Architectural Inspection Legend & Scale Bar */}
      <div className="p-2.5 bg-[#101420] border-t border-[#232938] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
            <span>Site ({bounds.width}m × {bounds.length}m = {bounds.grossSiteArea.toLocaleString()} m²)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span>Buildable Envelope ({bounds.netBuildableArea.toLocaleString()} m²)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e2b170]" />
            <span>Massing ({activeScenario.name.split(':')[0]})</span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-1 bg-slate-400 border border-slate-200" />
            <span>50m</span>
          </div>
          <span>Local metric study coordinates (Origin 0,0)</span>
        </div>
      </div>
    </div>
  );
}
