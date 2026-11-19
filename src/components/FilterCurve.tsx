import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SynthTelemetry } from '../synth/audioEngine';
import { PARAM_SPECS, ParamID, normToValue, valueToNorm } from '../synth/parameters';

export type FilterViewMode = 'spectrum' | 'harmonics';

interface FilterCurveProps {
  cutoffHz: number;
  resonance: number;
  drive: number;
  envAmount: number;
  keytrack: number;
  getTelemetry: () => SynthTelemetry;
  onChange: (id: ParamID, value: number) => void;
  viewMode?: FilterViewMode;
  onViewModeChange?: (mode: FilterViewMode) => void;
  hideControls?: boolean;
  heightClass?: string;
  viewHeight?: number;
}

export const FilterCurve: React.FC<FilterCurveProps> = ({
  cutoffHz,
  resonance,
  drive,
  envAmount,
  keytrack,
  getTelemetry,
  onChange,
  viewMode: controlledViewMode,
  onViewModeChange,
  hideControls = false,
  heightClass = 'h-[94px]',
  viewHeight = 94,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [internalViewMode, setInternalViewMode] = useState<FilterViewMode>('spectrum');
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (m: FilterViewMode) => {
    setInternalViewMode(m);
    onViewModeChange?.(m);
  };
  const [dragTarget, setDragTarget] = useState<'cutoff' | 'env' | null>(null);
  const liveBeamRef = useRef<SVGLineElement>(null);

  const propsRef = useRef({ cutoffHz, resonance, drive, envAmount, keytrack, viewMode });
  propsRef.current = { cutoffHz, resonance, drive, envAmount, keytrack, viewMode };
  const getTelemetryRef = useRef(getTelemetry);
  getTelemetryRef.current = getTelemetry;

  // Live 60fps OLED Spectrum + Modulated Filter Sweep Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;

    const render = () => {
      if (document.hidden) {
        raf = requestAnimationFrame(render);
        return;
      }
      const { cutoffHz: cut, resonance: res, drive: drv, envAmount: env, viewMode: vm } = propsRef.current;
      const tel = getTelemetryRef.current();

      if (liveBeamRef.current) {
        if (tel.filterEnv > 0.02) {
          const sweepHz = Math.min(20000, Math.max(20, cut * Math.pow(2, env * tel.filterEnv * 5)));
          const lx = ((Math.log10(sweepHz) - Math.log10(20)) / 3) * 320;
          liveBeamRef.current.setAttribute('x1', lx.toFixed(1));
          liveBeamRef.current.setAttribute('x2', lx.toFixed(1));
          liveBeamRef.current.setAttribute('opacity', '1');
        } else {
          liveBeamRef.current.setAttribute('opacity', '0');
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(200, canvas.clientWidth);
      const ch = Math.max(84, canvas.clientHeight);
      if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      // Subtle OLED phosphor backdrop gradient
      const bgGrad = ctx.createRadialGradient(cw * 0.5, ch * 0.4, 10, cw * 0.5, ch * 0.5, cw * 0.7);
      bgGrad.addColorStop(0, 'rgba(22, 40, 28, 0.38)');
      bgGrad.addColorStop(1, 'rgba(5, 9, 6, 0.92)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      // Horizontal dB lines
      ctx.strokeStyle = 'rgba(255, 240, 215, 0.06)';
      ctx.lineWidth = 1;
      for (let g = 1; g <= 3; g++) {
        const gy = (g / 4) * ch;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(cw, gy);
        ctx.stroke();
      }

      const spec = tel.spectrum;
      if (vm === 'spectrum') {
        const bars = 56;
        const barW = cw / bars;
        for (let i = 0; i < bars; i++) {
          // Logarithmic bin mapping across 20Hz..20kHz
          const t = i / (bars - 1);
          const binIdx = Math.min(spec.length - 1, Math.floor(Math.pow(t, 1.85) * (spec.length - 1)));
          const amp = (spec[binIdx] ?? 0) / 255;
          const bh = amp * (ch * 0.72);
          const x = i * barW;
          const y = ch - bh;

          const grad = ctx.createLinearGradient(0, ch, 0, y);
          grad.addColorStop(0, tel.activeVoices > 0 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(52, 211, 153, 0.08)');
          grad.addColorStop(0.65, tel.activeVoices > 0 ? 'rgba(245, 158, 11, 0.38)' : 'rgba(52, 211, 153, 0.22)');
          grad.addColorStop(1, drv > 0.55 ? 'rgba(251, 146, 60, 0.8)' : 'rgba(251, 191, 36, 0.65)');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 0.8, y, Math.max(1.5, barW - 1.6), bh);
        }
      } else {
        // Harmonics + Saturation Wave Ring Overlay
        ctx.strokeStyle = drv > 0.55 ? 'rgba(251, 146, 60, 0.55)' : 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const wf = tel.waveform;
        for (let i = 0; i < wf.length; i++) {
          const x = (i / (wf.length - 1)) * cw;
          const y = ch * 0.65 - wf[i] * (ch * 0.34);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Harmonic overtone spikes modulated by Drive + Resonance
        const overtones = 16;
        for (let h = 1; h <= overtones; h++) {
          const hx = (Math.log10(Math.min(20000, cut * (h * 0.5))) - Math.log10(20)) / 3;
          if (hx < 0 || hx > 1) continue;
          const px = hx * cw;
          const strength = Math.max(0.08, (1 / Math.sqrt(h)) * (0.4 + drv * 0.65 + (h === 2 ? res * 0.4 : 0)));
          const py = ch - strength * (ch * 0.62);
          ctx.strokeStyle = `rgba(251, 191, 36, ${Math.min(0.85, strength * 0.65).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, ch);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
      }

      // Modulated Envelope Cutoff Ghost Beam
      const modCutoff = Math.min(20000, Math.max(20, cut * Math.pow(2, env * tel.filterEnv * 5)));
      if (env > 0.02) {
        const modX = ((Math.log10(modCutoff) - Math.log10(20)) / 3) * cw;
        const cutX = ((Math.log10(Math.max(20, cut)) - Math.log10(20)) / 3) * cw;
        const beamGrad = ctx.createLinearGradient(cutX, 0, modX, 0);
        beamGrad.addColorStop(0, 'rgba(251, 191, 36, 0.04)');
        beamGrad.addColorStop(1, 'rgba(251, 191, 36, 0.22)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(Math.min(cutX, modX), 0, Math.abs(modX - cutX), ch);
      }

      ctx.restore();
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pathData = useMemo(() => {
    const W = 320;
    const H = viewHeight;
    const minHz = 20;
    const maxHz = 20000;
    const logMin = Math.log10(minHz);
    const logMax = Math.log10(maxHz);
    const points: string[] = [];

    const qPeak = 0.7 + resonance * 4.4;
    const driveLift = drive * 0.16;

    const evalCurveY = (hz: number, fc: number) => {
      const ratio = hz / Math.max(20, fc);
      const r2 = ratio * ratio;
      const lp4 = 1 / Math.sqrt(Math.pow(1 + r2, 4));
      const resBump =
        resonance > 0.02
          ? (qPeak - 0.7) * 0.23 * Math.exp(-Math.pow((Math.log2(Math.max(0.05, ratio)) + 0.04) * 3.8, 2))
          : 0;
      const mag = Math.min(1.22, lp4 * (1 + driveLift) + resBump);
      return H - 8 - Math.min(1.18, Math.max(0, mag)) * (H - 22) * 0.84;
    };

    for (let i = 0; i <= 72; i++) {
      const t = i / 72;
      const hz = Math.pow(10, logMin + t * (logMax - logMin));
      const x = t * W;
      const y = evalCurveY(hz, cutoffHz);
      points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }

    const line = points.join(' ');
    const fill = `${line} L${W},${H} L0,${H} Z`;
    const cutX = ((Math.log10(Math.max(minHz, Math.min(maxHz, cutoffHz))) - logMin) / (logMax - logMin)) * W;
    const resY = evalCurveY(cutoffHz, cutoffHz);

    // Envelope Contour Target Cutoff
    const envTargetHz = Math.min(20000, Math.max(20, cutoffHz * Math.pow(2, envAmount * 4.5)));
    const envX = ((Math.log10(envTargetHz) - logMin) / (logMax - logMin)) * W;
    const envY = Math.round(H * 0.24);

    return { W, H, line, fill, cutX, resY, envX, envY };
  }, [cutoffHz, resonance, drive, envAmount, viewHeight]);

  const applyCutoffPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = boxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const ny = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / Math.max(1, rect.height)));
      onChange('FILTER_CUTOFF', normToValue('FILTER_CUTOFF', nx));
      onChange('FILTER_RES', normToValue('FILTER_RES', ny));
    },
    [onChange],
  );

  const applyEnvPointer = useCallback(
    (clientX: number) => {
      const el = boxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      const cutNorm = valueToNorm('FILTER_CUTOFF', cutoffHz);
      const span = Math.max(0, nx - cutNorm);
      const envVal = Math.min(1, Math.max(0, span / 0.55));
      onChange('FILTER_ENV', Number(envVal.toFixed(3)));
    },
    [cutoffHz, onChange],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const step = e.shiftKey ? 0.012 : 0.045;
      const nextDrive = Math.min(1, Math.max(0, propsRef.current.drive + (e.deltaY < 0 ? step : -step)));
      onChange('FILTER_DRIVE', nextDrive);
    },
    [onChange],
  );

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <div
      ref={boxRef}
      onPointerDown={(e) => {
        if (e.button !== 0 || !boxRef.current) return;
        const rect = boxRef.current.getBoundingClientRect();
        const sx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * pathData.W;
        const sy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * pathData.H;
        const distEnv = Math.hypot(sx - pathData.envX, sy - pathData.envY);
        const target = distEnv < 18 ? 'env' : 'cutoff';
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragTarget(target);
        if (target === 'env') applyEnvPointer(e.clientX);
        else applyCutoffPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!dragTarget) return;
        if (dragTarget === 'env') applyEnvPointer(e.clientX);
        else applyCutoffPointer(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (!dragTarget) return;
        setDragTarget(null);
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }}
      onPointerCancel={() => setDragTarget(null)}
      onDoubleClick={() => {
        onChange('FILTER_CUTOFF', PARAM_SPECS.FILTER_CUTOFF.def);
        onChange('FILTER_RES', PARAM_SPECS.FILTER_RES.def);
        onChange('FILTER_ENV', PARAM_SPECS.FILTER_ENV.def);
      }}
      title="Drag Cutoff/Resonance node · Drag Diamond for Env Contour · Scroll for Drive · Double-click to reset"
      className={`recessed-screen rounded-xl relative overflow-hidden cursor-crosshair select-none touch-none ${heightClass}`}
    >
      {/* Live 60fps Spectrum & Harmonic Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />
      <div className="oled-scanlines absolute inset-0 pointer-events-none" aria-hidden="true" />

      {/* Precision Frequency Response & Interactive Nodes SVG Layer */}
      <svg
        viewBox={`0 0 ${pathData.W} ${pathData.H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <linearGradient id="filterFillOled" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={drive > 0.55 ? '#fb923c' : '#f59e0b'} stopOpacity="0.34" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Log Frequency Gridlines (50, 200, 1k, 5k, 15k) */}
        {[0.13, 0.33, 0.56, 0.8, 0.95].map((gx) => (
          <line
            key={gx}
            x1={gx * pathData.W}
            y1={0}
            x2={gx * pathData.W}
            y2={pathData.H}
            stroke="rgba(255,240,215,0.08)"
            strokeDasharray="2 3"
          />
        ))}

        {/* Env Contour Span Line */}
        <line
          x1={pathData.cutX}
          y1={pathData.envY}
          x2={pathData.envX}
          y2={pathData.envY}
          stroke="rgba(110, 231, 183, 0.45)"
          strokeWidth={1.2}
          strokeDasharray="3 2"
        />

        {/* Live Modulated Cutoff Sweep Beam (updated at 60fps via DOM ref) */}
        <line
          ref={liveBeamRef}
          x1={pathData.cutX}
          y1={0}
          x2={pathData.cutX}
          y2={pathData.H}
          stroke="rgba(251, 191, 36, 0.65)"
          strokeWidth={1.4}
          opacity={0}
        />

        <line
          x1={pathData.cutX}
          y1={4}
          x2={pathData.cutX}
          y2={pathData.H}
          stroke="rgba(251, 191, 36, 0.45)"
          strokeWidth={1}
        />

        <path d={pathData.fill} fill="url(#filterFillOled)" />
        <path
          d={pathData.line}
          fill="none"
          stroke={drive > 0.6 ? '#fb923c' : '#fbbf24'}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />

        {/* Active Drag Horizontal Resonance Guide */}
        {dragTarget === 'cutoff' && (
          <line
            x1={0}
            y1={pathData.resY}
            x2={pathData.W}
            y2={pathData.resY}
            stroke="rgba(251, 191, 36, 0.35)"
            strokeWidth={0.9}
            strokeDasharray="3 3"
          />
        )}

        {/* Draggable Env Contour Diamond Node */}
        <polygon
          points={`${pathData.envX},${pathData.envY - 4.5} ${pathData.envX + 4.5},${pathData.envY} ${pathData.envX},${pathData.envY + 4.5} ${pathData.envX - 4.5},${pathData.envY}`}
          fill="#0b130e"
          stroke="#6ee7b7"
          strokeWidth={1.6}
        />

        {/* Primary Interactive Cutoff/Resonance Node */}
        <circle
          cx={pathData.cutX}
          cy={pathData.resY}
          r={dragTarget === 'cutoff' ? 8.5 : 6.5}
          fill="rgba(251, 191, 36, 0.16)"
        />
        <circle
          cx={pathData.cutX}
          cy={pathData.resY}
          r={dragTarget === 'cutoff' ? 4.8 : 3.8}
          fill="#0c120d"
          stroke="#fbbf24"
          strokeWidth={2}
        />
      </svg>

      {!hideControls && (
        <div
          className="absolute top-1.5 right-1.5 flex items-center gap-0.5 p-0.5 rounded bg-[#090f0b]/95 border border-white/[0.12] pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setViewMode('spectrum')}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium leading-none transition-colors ${
              viewMode === 'spectrum' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
            }`}
          >
            Spectrum
          </button>
          <button
            type="button"
            onClick={() => setViewMode('harmonics')}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium leading-none transition-colors ${
              viewMode === 'harmonics' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
            }`}
          >
            Harmonics
          </button>
        </div>
      )}
    </div>
  );
};
