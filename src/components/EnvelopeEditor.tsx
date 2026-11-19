import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SynthTelemetry } from '../synth/audioEngine';
import { PARAM_SPECS, ParamID, normToValue, valueToNorm } from '../synth/parameters';

export type EnvViewMode = 'stage' | 'scope';

interface EnvelopeEditorProps {
  mode: 'filter' | 'amp';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  otherAttack: number;
  otherDecay: number;
  otherSustain: number;
  otherRelease: number;
  getTelemetry: () => SynthTelemetry;
  onChange: (id: ParamID, value: number) => void;
  accent?: 'amber' | 'ivory';
  viewMode?: EnvViewMode;
  onViewModeChange?: (mode: EnvViewMode) => void;
  showCompare?: boolean;
  onToggleCompare?: () => void;
  hideControls?: boolean;
  heightClass?: string;
  viewHeight?: number;
}

type DragNode = 'attack' | 'decay' | 'sustain' | 'release' | null;

function buildEnvelopeGeom(
  W: number,
  H: number,
  atk: number,
  dec: number,
  sus: number,
  rel: number,
) {
  const padX = 12;
  const padTop = 16;
  const padBot = 10;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBot;

  const mapT = (sec: number) => Math.pow(Math.min(8, Math.max(0.001, sec)) / 8, 0.35);

  const wA = 0.08 + mapT(atk) * 0.27;
  const wD = 0.08 + mapT(dec) * 0.27;
  const wS = 0.24;
  const wR = 0.08 + mapT(rel) * 0.27;
  const total = wA + wD + wS + wR;

  const x0 = padX;
  const x1 = x0 + (wA / total) * innerW;
  const x2 = x1 + (wD / total) * innerW;
  const x3 = x2 + (wS / total) * innerW;
  const x4 = x3 + (wR / total) * innerW;

  const yBottom = H - padBot;
  const yPeak = padTop;
  const ySus = yBottom - Math.min(1, Math.max(0, sus)) * innerH;

  const segA = `M ${x0},${yBottom} Q ${(x0 + x1) * 0.45},${yPeak + innerH * 0.14} ${x1.toFixed(1)},${yPeak}`;
  const segD = `M ${x1.toFixed(1)},${yPeak} Q ${(x1 + x2) * 0.42},${ySus} ${x2.toFixed(1)},${ySus.toFixed(1)}`;
  const segS = `M ${x2.toFixed(1)},${ySus.toFixed(1)} L ${x3.toFixed(1)},${ySus.toFixed(1)}`;
  const segR = `M ${x3.toFixed(1)},${ySus.toFixed(1)} Q ${(x3 + x4) * 0.42},${yBottom} ${x4.toFixed(1)},${yBottom}`;

  const line = `${segA} Q ${(x1 + x2) * 0.42},${ySus} ${x2.toFixed(1)},${ySus.toFixed(1)} L ${x3.toFixed(1)},${ySus.toFixed(1)} Q ${(x3 + x4) * 0.42},${yBottom} ${x4.toFixed(1)},${yBottom}`;
  const fill = `${line} L ${x0},${yBottom} Z`;

  return {
    line,
    fill,
    segA,
    segD,
    segS,
    segR,
    x0,
    yPeak,
    ySus,
    yBottom,
    atkPt: { x: x1, y: yPeak },
    decPt: { x: x2, y: ySus },
    susPt: { x: x3, y: ySus },
    relPt: { x: x4, y: yBottom },
  };
}

export const EnvelopeEditor: React.FC<EnvelopeEditorProps> = ({
  mode,
  attack,
  decay,
  sustain,
  release,
  otherAttack,
  otherDecay,
  otherSustain,
  otherRelease,
  getTelemetry,
  onChange,
  accent = 'amber',
  viewMode: controlledViewMode,
  onViewModeChange,
  showCompare: controlledShowCompare,
  onToggleCompare,
  hideControls = false,
  heightClass = 'h-[70px]',
  viewHeight = 70,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [internalViewMode, setInternalViewMode] = useState<EnvViewMode>('stage');
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (m: EnvViewMode) => {
    setInternalViewMode(m);
    onViewModeChange?.(m);
  };
  const [activeNode, setActiveNode] = useState<DragNode>(null);
  const [hoverNode, setHoverNode] = useState<DragNode>(null);
  const [internalShowCompare, setInternalShowCompare] = useState(true);
  const showCompare = controlledShowCompare ?? internalShowCompare;
  const toggleCompare = () => {
    if (onToggleCompare) onToggleCompare();
    else setInternalShowCompare((c) => !c);
  };

  const dragStartRef = useRef<{
    node: DragNode;
    x: number;
    y: number;
    aNorm: number;
    dNorm: number;
    sNorm: number;
    rNorm: number;
  } | null>(null);

  const ids = useMemo(() => {
    const p = mode === 'filter' ? 'FENV' : 'AENV';
    return {
      atk: `${p}_ATTACK` as ParamID,
      dec: `${p}_DECAY` as ParamID,
      sus: `${p}_SUSTAIN` as ParamID,
      rel: `${p}_RELEASE` as ParamID,
    };
  }, [mode]);

  const W = 320;
  const H = viewHeight;

  const geom = useMemo(
    () => buildEnvelopeGeom(W, H, attack, decay, sustain, release),
    [H, attack, decay, sustain, release],
  );

  const ghostGeom = useMemo(
    () => buildEnvelopeGeom(W, H, otherAttack, otherDecay, otherSustain, otherRelease),
    [H, otherAttack, otherDecay, otherSustain, otherRelease],
  );

  const stateRef = useRef({ mode, geom, H, attack, decay, sustain, release, accent, viewMode });
  stateRef.current = { mode, geom, H, attack, decay, sustain, release, accent, viewMode };
  const getTelemetryRef = useRef(getTelemetry);
  getTelemetryRef.current = getTelemetry;

  // Dual-Mode 60fps OLED Stage Energy Bars & Rolling Dual-Envelope Scope (matching Ladder Filter depth)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const primaryTrail = new Float32Array(96);
    const secondaryTrail = new Float32Array(96);

    const draw = (now: number) => {
      if (document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const tel = getTelemetryRef.current();
      const { mode: curMode, geom: g, accent: acc, viewMode: vm } = stateRef.current;
      const primaryLvl = curMode === 'filter' ? tel.filterEnv : tel.ampEnv;
      const secondaryLvl = curMode === 'filter' ? tel.ampEnv : tel.filterEnv;

      for (let i = 0; i < primaryTrail.length - 1; i++) {
        primaryTrail[i] = primaryTrail[i + 1];
        secondaryTrail[i] = secondaryTrail[i + 1];
      }
      primaryTrail[primaryTrail.length - 1] = tel.activeVoices > 0 ? primaryLvl : 0;
      secondaryTrail[secondaryTrail.length - 1] = tel.activeVoices > 0 ? secondaryLvl : 0;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(190, canvas.clientWidth);
      const ch = Math.max(66, canvas.clientHeight);
      if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      // Deep OLED calibrated backdrop matching Ladder Filter
      const bgGrad = ctx.createRadialGradient(cw * 0.5, ch * 0.4, 10, cw * 0.5, ch * 0.5, cw * 0.72);
      bgGrad.addColorStop(0, 'rgba(22, 40, 28, 0.42)');
      bgGrad.addColorStop(1, 'rgba(5, 9, 6, 0.94)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      // Horizontal dB / amplitude calibration gridlines
      ctx.strokeStyle = 'rgba(255, 240, 215, 0.06)';
      ctx.lineWidth = 1;
      for (let j = 1; j <= 3; j++) {
        const y = (j / 4) * ch;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
      }

      // Millimeter ticks along bottom ruler
      ctx.strokeStyle = 'rgba(255, 240, 210, 0.11)';
      for (let i = 0; i <= 20; i++) {
        const x = (i / 20) * cw;
        ctx.beginPath();
        ctx.moveTo(x, ch - 10);
        ctx.lineTo(x, ch - (i % 5 === 0 ? 5 : 8));
        ctx.stroke();
      }

      const scaleX = cw / W;
      const scaleY = ch / stateRef.current.H;
      const padTop = 16 * scaleY;
      const botY = g.yBottom * scaleY;
      const spanH = botY - padTop;
      const rgb = acc === 'ivory' ? '110, 231, 183' : '251, 191, 36';
      const altRgb = acc === 'ivory' ? '251, 191, 36' : '110, 231, 183';

      if (vm === 'stage') {
        // 56 Phosphor Energy Bars sampled underneath the ADSR contour (matching Filter Spectrum bars)
        const bars = 56;
        const barW = (cw - 24 * scaleX) / bars;
        const startX = 14 * scaleX;
        const activePulse = tel.activeVoices > 0 ? primaryLvl : 0.18 + 0.06 * Math.sin(now * 0.0025);

        for (let i = 0; i < bars; i++) {
          const u = i / (bars - 1);
          const xNorm = g.x0 + u * (g.relPt.x - g.x0);
          let envShape = 0;
          if (xNorm <= g.atkPt.x) {
            const k = (xNorm - g.x0) / Math.max(1, g.atkPt.x - g.x0);
            envShape = Math.pow(k, 0.72);
          } else if (xNorm <= g.decPt.x) {
            const k = (xNorm - g.atkPt.x) / Math.max(1, g.decPt.x - g.atkPt.x);
            envShape = 1 - (1 - stateRef.current.sustain) * Math.pow(k, 0.7);
          } else if (xNorm <= g.susPt.x) {
            envShape = stateRef.current.sustain;
          } else {
            const k = (xNorm - g.susPt.x) / Math.max(1, g.relPt.x - g.susPt.x);
            envShape = stateRef.current.sustain * (1 - Math.pow(k, 0.72));
          }

          const ripple = 0.85 + 0.15 * Math.sin(i * 0.6 + now * 0.004);
          const bh = Math.max(2, envShape * spanH * (0.45 + activePulse * 0.55) * ripple);
          const bx = startX + i * barW;
          const by = botY - bh;

          const grad = ctx.createLinearGradient(0, botY, 0, by);
          grad.addColorStop(0, `rgba(${rgb}, 0.05)`);
          grad.addColorStop(0.6, `rgba(${rgb}, ${tel.activeVoices > 0 ? 0.34 : 0.16})`);
          grad.addColorStop(1, `rgba(${rgb}, ${tel.activeVoices > 0 ? 0.72 : 0.36})`);
          ctx.fillStyle = grad;
          ctx.fillRect(bx + 0.7, by, Math.max(1.4, barW - 1.5), bh);
        }

        // Sweeping Vertical Beam & Glowing Tracker Dot when notes play
        if (tel.activeVoices > 0 || primaryLvl > 0.02) {
          const beamX =
            primaryLvl >= stateRef.current.sustain
              ? (g.x0 + (g.atkPt.x - g.x0) * primaryLvl) * scaleX
              : (g.decPt.x + (g.susPt.x - g.decPt.x) * 0.5) * scaleX;
          const beamGrad = ctx.createLinearGradient(14 * scaleX, 0, beamX, 0);
          beamGrad.addColorStop(0, `rgba(${rgb}, 0.02)`);
          beamGrad.addColorStop(1, `rgba(${rgb}, 0.24)`);
          ctx.fillStyle = beamGrad;
          ctx.fillRect(14 * scaleX, padTop, Math.max(0, beamX - 14 * scaleX), spanH);

          const activeY = botY - primaryLvl * spanH;
          ctx.strokeStyle = `rgba(${rgb}, 0.7)`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(beamX, padTop);
          ctx.lineTo(beamX, botY);
          ctx.stroke();

          ctx.fillStyle = `rgba(${rgb}, 0.28)`;
          ctx.beginPath();
          ctx.arc(beamX, activeY, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = acc === 'ivory' ? '#6ee7b7' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(beamX, activeY, 3.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Live Dual-Envelope Rolling Scope Trace
        const drawTrace = (arr: Float32Array, strokeRgba: string, width: number) => {
          ctx.strokeStyle = strokeRgba;
          ctx.lineWidth = width;
          ctx.beginPath();
          for (let i = 0; i < arr.length; i++) {
            const x = (i / (arr.length - 1)) * cw;
            const y = botY - arr[i] * spanH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        };

        drawTrace(secondaryTrail, `rgba(${altRgb}, 0.42)`, 1.4);
        ctx.shadowColor = `rgba(${rgb}, 0.75)`;
        ctx.shadowBlur = 7;
        drawTrace(primaryTrail, `rgba(${rgb}, 0.88)`, 2.2);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pickNodeAt = useCallback(
    (clientX: number): DragNode => {
      if (!boxRef.current) return 'decay';
      const rect = boxRef.current.getBoundingClientRect();
      const sx = ((clientX - rect.left) / Math.max(1, rect.width)) * W;
      if (sx <= (geom.atkPt.x + geom.decPt.x) * 0.5) return 'attack';
      if (sx <= (geom.decPt.x + geom.susPt.x) * 0.5) return 'decay';
      if (sx <= (geom.susPt.x + geom.relPt.x) * 0.5 - 6) return 'sustain';
      return 'release';
    },
    [geom],
  );

  const wheelStateRef = useRef({
    hoverNode,
    pickNodeAt,
    ids,
    attack,
    decay,
    sustain,
    release,
    onChange,
  });
  wheelStateRef.current = {
    hoverNode,
    pickNodeAt,
    ids,
    attack,
    decay,
    sustain,
    release,
    onChange,
  };

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = wheelStateRef.current;
      const node = st.hoverNode ?? st.pickNodeAt(e.clientX);
      const step = e.shiftKey ? 0.01 : 0.04;
      const dir = e.deltaY < 0 ? 1 : -1;
      if (node === 'attack') {
        st.onChange(st.ids.atk, normToValue(st.ids.atk, valueToNorm(st.ids.atk, st.attack) + dir * step));
      } else if (node === 'decay') {
        st.onChange(st.ids.dec, normToValue(st.ids.dec, valueToNorm(st.ids.dec, st.decay) + dir * step));
      } else if (node === 'sustain') {
        st.onChange(st.ids.sus, normToValue(st.ids.sus, valueToNorm(st.ids.sus, st.sustain) + dir * step));
      } else if (node === 'release') {
        st.onChange(st.ids.rel, normToValue(st.ids.rel, valueToNorm(st.ids.rel, st.release) + dir * step));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !boxRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const node = pickNodeAt(e.clientX);
    setActiveNode(node);
    dragStartRef.current = {
      node,
      x: e.clientX,
      y: e.clientY,
      aNorm: valueToNorm(ids.atk, attack),
      dNorm: valueToNorm(ids.dec, decay),
      sNorm: valueToNorm(ids.sus, sustain),
      rNorm: valueToNorm(ids.rel, release),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) {
      setHoverNode(pickNodeAt(e.clientX));
      return;
    }
    const start = dragStartRef.current;
    const scaleX = e.shiftKey ? 280 : 115;
    const scaleY = e.shiftKey ? 180 : 74;
    const dx = (e.clientX - start.x) / scaleX;
    const dy = (start.y - e.clientY) / scaleY;

    if (start.node === 'attack') {
      onChange(ids.atk, normToValue(ids.atk, Math.min(1, Math.max(0, start.aNorm + dx))));
    } else if (start.node === 'decay') {
      onChange(ids.dec, normToValue(ids.dec, Math.min(1, Math.max(0, start.dNorm + dx))));
      onChange(ids.sus, normToValue(ids.sus, Math.min(1, Math.max(0, start.sNorm + dy))));
    } else if (start.node === 'sustain') {
      onChange(ids.sus, normToValue(ids.sus, Math.min(1, Math.max(0, start.sNorm + dy))));
    } else if (start.node === 'release') {
      onChange(ids.rel, normToValue(ids.rel, Math.min(1, Math.max(0, start.rNorm + dx))));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setActiveNode(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const stroke = accent === 'ivory' ? '#6ee7b7' : '#fbbf24';
  const ghostStroke = accent === 'ivory' ? 'rgba(251, 191, 36, 0.34)' : 'rgba(110, 231, 183, 0.32)';
  const fillId = accent === 'ivory' ? 'envIvoryOledV3' : 'envAmberOledV3';
  const hotStage = activeNode ?? hoverNode;

  const activeStageSeg =
    hotStage === 'attack'
      ? geom.segA
      : hotStage === 'decay'
        ? geom.segD
        : hotStage === 'sustain'
          ? geom.segS
          : hotStage === 'release'
            ? geom.segR
            : null;

  return (
    <div
      ref={boxRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => setHoverNode(null)}
      onDoubleClick={() => {
        onChange(ids.atk, PARAM_SPECS[ids.atk].def);
        onChange(ids.dec, PARAM_SPECS[ids.dec].def);
        onChange(ids.sus, PARAM_SPECS[ids.sus].def);
        onChange(ids.rel, PARAM_SPECS[ids.rel].def);
      }}
      title="Drag Attack, Decay/Sustain, Sustain bar, or Release · Scroll segment to fine-tune · Double-click to reset"
      className={`recessed-screen rounded-xl relative overflow-hidden cursor-crosshair select-none touch-none ${heightClass}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />
      <div className="oled-scanlines absolute inset-0 pointer-events-none" aria-hidden="true" />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.34" />
            <stop offset="60%" stopColor={stroke} stopOpacity="0.1" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
          </linearGradient>
          <filter id="envGlowV3" x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Calibrated Vertical Stage Guides matching FilterCurve frequency lines */}
        {[geom.atkPt, geom.decPt, geom.susPt].map((pt, i) => (
          <line
            key={i}
            x1={pt.x}
            y1={0}
            x2={pt.x}
            y2={geom.yBottom}
            stroke="rgba(255, 240, 215, 0.1)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}
        {/* Sustain Reference Threshold Line */}
        <line
          x1={14}
          y1={geom.ySus}
          x2={W - 14}
          y2={geom.ySus}
          stroke={accent === 'ivory' ? 'rgba(110, 231, 183, 0.22)' : 'rgba(251, 191, 36, 0.22)'}
          strokeDasharray="3 3"
        />

        {/* Ghost Comparison Curve of Opposite Envelope */}
        {showCompare && (
          <path
            d={ghostGeom.line}
            fill="none"
            stroke={ghostStroke}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {/* Luminous Gradient Fill + Phosphor Glow Curve */}
        <path d={geom.fill} fill={`url(#${fillId})`} />
        <path
          d={geom.line}
          fill="none"
          stroke={stroke}
          strokeWidth={2.4}
          strokeLinejoin="round"
          filter="url(#envGlowV3)"
        />
        <path
          d={geom.line}
          fill="none"
          stroke="#fffbeb"
          strokeWidth={0.9}
          strokeOpacity={0.65}
          strokeLinejoin="round"
        />

        {/* Highlighted Active/Hovered Stage Segment */}
        {activeStageSeg && (
          <path
            d={activeStageSeg}
            fill="none"
            stroke="#ffffff"
            strokeWidth={3.2}
            strokeOpacity={0.88}
            strokeLinecap="round"
          />
        )}

        {/* Active Drag Orthogonal Precision Crosshair */}
        {activeNode && (() => {
          const pt =
            activeNode === 'attack'
              ? geom.atkPt
              : activeNode === 'decay'
                ? geom.decPt
                : activeNode === 'sustain'
                  ? geom.susPt
                  : geom.relPt;
          return (
            <g stroke="rgba(255, 255, 255, 0.32)" strokeWidth={0.9} strokeDasharray="3 3">
              <line x1={pt.x} y1={0} x2={pt.x} y2={H} />
              <line x1={0} y1={pt.y} x2={W} y2={pt.y} />
            </g>
          );
        })()}

        {/* Multi-Ring Interactive Handles matching FilterCurve Node Rigor */}
        {[
          { key: 'attack' as const, pt: geom.atkPt },
          { key: 'decay' as const, pt: geom.decPt },
          { key: 'sustain' as const, pt: geom.susPt },
          { key: 'release' as const, pt: geom.relPt },
        ].map(({ key, pt }) => {
          const isHot = activeNode === key || hoverNode === key;
          return (
            <g key={key}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHot ? 8.5 : 5.8}
                fill={accent === 'ivory' ? 'rgba(110,231,183,0.18)' : 'rgba(251,191,36,0.18)'}
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHot ? 4.8 : 3.5}
                fill="#0b120d"
                stroke={isHot ? '#ffffff' : stroke}
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>

      {!hideControls && (
        <div
          className="absolute top-1 right-1.5 flex items-center gap-0.5 p-0.5 rounded bg-[#090f0b]/95 border border-white/[0.12] pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setViewMode('stage')}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium leading-none transition-colors ${
              viewMode === 'stage' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
            }`}
          >
            Stage
          </button>
          <button
            type="button"
            onClick={() => setViewMode('scope')}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium leading-none transition-colors ${
              viewMode === 'scope' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
            }`}
          >
            Scope
          </button>
          <button
            type="button"
            onClick={toggleCompare}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium leading-none transition-colors ${
              showCompare ? 'text-emerald-300' : 'text-[#6e7e71] hover:text-[#f4efe6]'
            }`}
            title={`Toggle ghost overlay of ${mode === 'filter' ? 'Amp' : 'Filter'} envelope`}
          >
            Cmp
          </button>
        </div>
      )}
    </div>
  );
};
