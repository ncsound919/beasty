import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ParamID, ParamState, normToValue, valueToNorm } from '../synth/parameters';
import { SynthTelemetry } from '../synth/audioEngine';

export type ViewMode = 'waterfall' | 'torus';
export type InteractMode = 'sculpt' | 'orbit';

interface Waveform3DVisualizerProps {
  params: ParamState;
  onChange: (id: ParamID, value: number) => void;
  getTelemetry: () => SynthTelemetry;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  interactMode?: InteractMode;
  onInteractModeChange?: (mode: InteractMode) => void;
  hideControls?: boolean;
  wide?: boolean;
}

const SLICES = 18;
const POINTS = 96;

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const Waveform3DVisualizer: React.FC<Waveform3DVisualizerProps> = ({
  params,
  onChange,
  getTelemetry,
  viewMode: controlledViewMode,
  onViewModeChange,
  interactMode: controlledInteractMode,
  onInteractModeChange,
  hideControls = false,
  wide = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('waterfall');
  const [internalInteractMode, setInternalInteractMode] = useState<InteractMode>('sculpt');
  const viewMode = controlledViewMode ?? internalViewMode;
  const interactMode = controlledInteractMode ?? internalInteractMode;
  const setViewMode = (m: ViewMode) => {
    setInternalViewMode(m);
    onViewModeChange?.(m);
  };
  const setInteractMode = (m: InteractMode) => {
    setInternalInteractMode(m);
    onInteractModeChange?.(m);
  };
  const [sculpting, setSculpting] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  const viewModeRef = useRef<ViewMode>(viewMode);
  viewModeRef.current = viewMode;
  const interactModeRef = useRef<InteractMode>(interactMode);
  interactModeRef.current = interactMode;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const getTelemetryRef = useRef(getTelemetry);
  getTelemetryRef.current = getTelemetry;

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = interactMode === 'orbit';
    }
  }, [interactMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x070b08, 1);

    const width = Math.max(200, container.clientWidth);
    const height = Math.max(88, container.clientHeight);
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b08);
    scene.fog = new THREE.FogExp2(0x070b08, 0.08);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 60);
    camera.position.set(0, 1.66, 3.12);
    camera.lookAt(0, -0.04, -0.3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minAzimuthAngle = -Math.PI * 0.35;
    controls.maxAzimuthAngle = Math.PI * 0.35;
    controls.target.set(0, -0.04, -0.32);
    controls.enabled = interactModeRef.current === 'orbit';
    controls.update();
    controlsRef.current = controls;

    const hemiLight = new THREE.HemisphereLight(0xa5b4fc, 0x1c140d, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.8);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xf59e0b, 3.4, 16);
    rimLight.position.set(0, 1.5, 2.5);
    scene.add(rimLight);

    const gridHelper = new THREE.GridHelper(10, 20, 0x2c4232, 0x162219);
    gridHelper.position.y = -0.95;
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.polygonOffset = true;
    gridMat.polygonOffsetFactor = 1;
    gridMat.polygonOffsetUnits = 1;
    gridMat.transparent = true;
    gridMat.opacity = 0.55;
    scene.add(gridHelper);

    const waterfallGroup = new THREE.Group();
    scene.add(waterfallGroup);

    const history: Float32Array[] = Array.from({ length: SLICES }, () => new Float32Array(POINTS));
    const sliceGeos: THREE.BufferGeometry[] = [];
    const sliceMats: THREE.LineBasicMaterial[] = [];

    const sliceWidth = wide ? 5.8 : 3.22;

    for (let s = 0; s < SLICES; s++) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(POINTS * 3);
      const z = 1.0 - s * 0.2;
      for (let i = 0; i < POINTS; i++) {
        const x = ((i / (POINTS - 1)) - 0.5) * sliceWidth;
        positions[i * 3] = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const t = s / (SLICES - 1);
      const col = new THREE.Color().setHSL(0.095 - t * 0.045, 0.94 - t * 0.2, 0.62 - t * 0.34);
      const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: 1 - t * 0.78,
      });

      const line = new THREE.Line(geo, mat);
      waterfallGroup.add(line);
      sliceGeos.push(geo);
      sliceMats.push(mat);
    }

    const ribbonGeo = new THREE.BufferGeometry();
    const ribbonVerts = new Float32Array(POINTS * 2 * 3);
    const ribbonIndices: number[] = [];
    for (let i = 0; i < POINTS - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      ribbonIndices.push(a, b, c, b, d, c);
    }
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonVerts, 3));
    ribbonGeo.setIndex(ribbonIndices);
    ribbonGeo.computeVertexNormals();

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.75,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.48,
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    waterfallGroup.add(ribbonMesh);

    const torusGroup = new THREE.Group();
    torusGroup.visible = false;
    scene.add(torusGroup);

    const ringGeo = new THREE.BufferGeometry();
    const ringPositions = new Float32Array((POINTS + 1) * 3);
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
    const ringMat = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
    const ringLine = new THREE.Line(ringGeo, ringMat);
    torusGroup.add(ringLine);

    const innerRingGeo = new THREE.TorusGeometry(0.76, 0.036, 16, 72);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.88,
      roughness: 0.22,
    });
    const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
    torusGroup.add(innerRingMesh);

    const coreSphereGeo = new THREE.IcosahedronGeometry(0.32, 2);
    const coreSphereMat = new THREE.MeshStandardMaterial({
      color: 0x261a10,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      metalness: 0.7,
      roughness: 0.25,
      wireframe: true,
    });
    const coreSphere = new THREE.Mesh(coreSphereGeo, coreSphereMat);
    torusGroup.add(coreSphere);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(120, Math.floor(entry.contentRect.width));
        const h = Math.max(84, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    const onContextRestored = () => {
      setWebglFailed(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let pushAccum = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl.isContextLost?.() || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        if (gl.isContextLost?.()) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      if (document.hidden) {
        lastTime = performance.now();
        if (isSoftwareGl) {
          frameId = window.setTimeout(tick, 120);
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const tel = getTelemetryRef.current();
      const p = paramsRef.current;
      const wf = tel.waveform;
      const drive = p.FILTER_DRIVE;

      pushAccum += dt;
      const stepInterval = reducedMotion ? 0.12 : 0.033;
      if (pushAccum >= stepInterval) {
        pushAccum = 0;
        for (let s = SLICES - 1; s > 0; s--) {
          history[s].set(history[s - 1]);
        }
      }

      const front = history[0];
      const stride = Math.max(1, Math.floor(wf.length / POINTS));
      for (let i = 0; i < POINTS; i++) {
        front[i] = wf[Math.min(wf.length - 1, i * stride)] ?? 0;
      }

      const isTorus = viewModeRef.current === 'torus';
      waterfallGroup.visible = !isTorus;
      torusGroup.visible = isTorus;

      if (!isTorus) {
        const ampScale = 1.25 + drive * 0.45;
        for (let s = 0; s < SLICES; s++) {
          const posAttr = sliceGeos[s].getAttribute('position') as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          const sliceData = history[s];
          const baseLift = -0.18 + s * 0.024;
          for (let i = 0; i < POINTS; i++) {
            arr[i * 3 + 1] = sliceData[i] * ampScale + baseLift;
          }
          posAttr.needsUpdate = true;
        }

        const rAttr = ribbonGeo.getAttribute('position') as THREE.BufferAttribute;
        const rArr = rAttr.array as Float32Array;
        const s0 = history[0];
        const s1 = history[1];
        for (let i = 0; i < POINTS; i++) {
          const x = ((i / (POINTS - 1)) - 0.5) * sliceWidth;
          const vIdx = i * 6;
          rArr[vIdx] = x;
          rArr[vIdx + 1] = s0[i] * ampScale - 0.18;
          rArr[vIdx + 2] = 1.0;

          rArr[vIdx + 3] = x;
          rArr[vIdx + 4] = s1[i] * ampScale - 0.156;
          rArr[vIdx + 5] = 0.8;
        }
        rAttr.needsUpdate = true;
        ribbonGeo.computeVertexNormals();
        ribbonMat.emissive.setHex(drive > 0.6 ? 0x9a3412 : 0x78350f);
      } else {
        const posAttr = ringGeo.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i <= POINTS; i++) {
          const idx = i % POINTS;
          const theta = (idx / POINTS) * Math.PI * 2;
          const rad = 1.15 + front[idx] * (0.58 + drive * 0.28);
          arr[i * 3] = Math.cos(theta) * rad;
          arr[i * 3 + 1] = Math.sin(theta) * rad * 0.78 + front[(idx + 16) % POINTS] * 0.24;
          arr[i * 3 + 2] = Math.sin(theta * 2 + now * 0.002) * 0.22;
        }
        posAttr.needsUpdate = true;
        if (!reducedMotion) {
          torusGroup.rotation.y += dt * (0.35 + tel.rms * 1.4);
          innerRingMesh.rotation.x = Math.sin(now * 0.0012) * 0.35;
          const coreScale = 0.9 + tel.rms * 1.1 + tel.filterEnv * 0.25;
          coreSphere.scale.setScalar(coreScale);
          coreSphere.rotation.y -= dt * 0.6;
        }
      }

      rimLight.intensity = 2.8 + tel.rms * 5.0 + drive * 1.4;
      if (controls.enabled) controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      controls.dispose();
      controlsRef.current = null;
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      sliceGeos.forEach((g) => g.dispose());
      sliceMats.forEach((m) => m.dispose());
      gridHelper.geometry.dispose();
      gridMat.dispose();
      ribbonGeo.dispose();
      ribbonMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      coreSphereGeo.dispose();
      coreSphereMat.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, [wide]);

  // Direct XY Sound Sculpting on the 3D Visualizer (Cutoff = X, Resonance = Y, Wheel = Drive)
  const applySculptPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = overlayRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const ny = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / Math.max(1, rect.height)));
      onChange('FILTER_CUTOFF', normToValue('FILTER_CUTOFF', nx));
      onChange('FILTER_RES', normToValue('FILTER_RES', ny));
    },
    [onChange],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (interactModeRef.current !== 'sculpt') return;
      e.preventDefault();
      const curDrive = paramsRef.current.FILTER_DRIVE;
      const nextDrive = Math.min(1, Math.max(0, curDrive + (e.deltaY < 0 ? 0.04 : -0.04)));
      onChange('FILTER_DRIVE', nextDrive);
    },
    [onChange],
  );

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (!webglFailed || !fallbackCanvasRef.current) return;
    const canvas = fallbackCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const tel = getTelemetryRef.current();
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#070b08';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < tel.waveform.length; i++) {
        const x = (i / (tel.waveform.length - 1)) * w;
        const y = h / 2 - tel.waveform[i] * (h * 0.4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [webglFailed]);

  const cutNorm = valueToNorm('FILTER_CUTOFF', params.FILTER_CUTOFF);
  const resNorm = valueToNorm('FILTER_RES', params.FILTER_RES);

  return (
    <div
      ref={overlayRef}
      className="relative w-full h-full min-h-[90px] rounded-xl recessed-screen overflow-hidden"
    >
      {!webglFailed ? (
        <div
          ref={mountRef}
          className={`w-full h-full ${interactMode === 'orbit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        />
      ) : (
        <canvas ref={fallbackCanvasRef} width={560} height={240} className="w-full h-full block" />
      )}
      <div className="oled-scanlines absolute inset-0 pointer-events-none z-[5]" aria-hidden="true" />

      {/* Interactive XY Sound Sculpt Layer when Sculpt mode is active */}
      {interactMode === 'sculpt' && (
        <div
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setSculpting(true);
            applySculptPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!sculpting) return;
            applySculptPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (!sculpting) return;
            setSculpting(false);
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // Ignore
            }
          }}
          onPointerCancel={() => setSculpting(false)}
          title="Drag horizontally for Cutoff, vertically for Resonance, scroll for Drive"
          className="absolute inset-0 cursor-crosshair z-10"
        >
          {/* Active Sculpt Precision Crosshairs */}
          {sculpting && (
            <>
              <div
                className="absolute inset-y-0 w-px bg-amber-300/35 pointer-events-none"
                style={{ left: `${(cutNorm * 100).toFixed(1)}%` }}
              />
              <div
                className="absolute inset-x-0 h-px bg-amber-300/35 pointer-events-none"
                style={{ top: `${((1 - resNorm) * 100).toFixed(1)}%` }}
              />
            </>
          )}

          {/* Live Sculpt Target Reticle */}
          <div
            className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 border-amber-300 bg-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.9)] pointer-events-none transition-transform duration-75"
            style={{
              left: `${(cutNorm * 100).toFixed(1)}%`,
              top: `${((1 - resNorm) * 100).toFixed(1)}%`,
              transform: sculpting ? 'scale(1.35)' : 'scale(1)',
            }}
          />
        </div>
      )}

      {!hideControls && (
        <>
          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 p-0.5 rounded-md bg-[#0b110d]/90 border border-white/[0.12] z-20 pointer-events-auto">
            <button
              type="button"
              onClick={() => setInteractMode('sculpt')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none transition-colors ${
                interactMode === 'sculpt'
                  ? 'bg-amber-500/25 text-amber-200'
                  : 'text-[#8c9d8f] hover:text-[#f4efe6]'
              }`}
            >
              Sculpt
            </button>
            <button
              type="button"
              onClick={() => setInteractMode('orbit')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none transition-colors ${
                interactMode === 'orbit'
                  ? 'bg-amber-500/25 text-amber-200'
                  : 'text-[#8c9d8f] hover:text-[#f4efe6]'
              }`}
            >
              Orbit
            </button>
          </div>

          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 p-0.5 rounded-md bg-[#0b110d]/90 border border-white/[0.12] z-20 pointer-events-auto">
            <button
              type="button"
              onClick={() => setViewMode('waterfall')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none transition-colors ${
                viewMode === 'waterfall'
                  ? 'bg-amber-500/25 text-amber-200'
                  : 'text-[#8c9d8f] hover:text-[#f4efe6]'
              }`}
            >
              Wave
            </button>
            <button
              type="button"
              onClick={() => setViewMode('torus')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none transition-colors ${
                viewMode === 'torus'
                  ? 'bg-amber-500/25 text-amber-200'
                  : 'text-[#8c9d8f] hover:text-[#f4efe6]'
              }`}
            >
              Ring
            </button>
          </div>
        </>
      )}
    </div>
  );
};
