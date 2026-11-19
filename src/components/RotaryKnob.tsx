import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { juceBridge } from '../synth/juceBridge';
import { PARAM_SPECS, ParamID, formatParamValue, normToValue, valueToNorm } from '../synth/parameters';

interface RotaryKnobProps {
  id: ParamID;
  value: number;
  onChange: (id: ParamID, value: number) => void;
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
  layout?: 'vertical' | 'inline';
  labelOverride?: string;
  accent?: 'amber' | 'copper' | 'ivory';
  hideValue?: boolean;
}

const SIZE_MAP = {
  xxs: { px: 36, r: 13.5, stroke: 2.2, cap: 21, inner: 15, knurls: 18, tickGap: 2.1, tickLen: 1.8 },
  xs: { px: 42, r: 16, stroke: 2.5, cap: 26, inner: 18.5, knurls: 22, tickGap: 2.4, tickLen: 2.2 },
  sm: { px: 52, r: 20.5, stroke: 2.9, cap: 35, inner: 24.5, knurls: 26, tickGap: 2.6, tickLen: 2.6 },
  md: { px: 74, r: 30, stroke: 3.6, cap: 52, inner: 37, knurls: 32, tickGap: 3.0, tickLen: 3.2 },
  lg: { px: 100, r: 42, stroke: 4.4, cap: 72, inner: 54, knurls: 36, tickGap: 3.4, tickLen: 3.8 },
};

const START_ANGLE = -135;
const END_ANGLE = 135;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  id,
  value,
  onChange,
  size = 'md',
  layout = 'vertical',
  labelOverride,
  accent = 'amber',
  hideValue = false,
}) => {
  const spec = PARAM_SPECS[id];
  const dims = SIZE_MAP[size];
  const uid = useId();
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef<{ startY: number; startNorm: number } | null>(null);

  const norm = valueToNorm(id, value);
  const angle = START_ANGLE + norm * (END_ANGLE - START_ANGLE);
  const center = dims.px / 2;

  const isBipolar = spec.min < 0 && spec.max > 0;
  const zeroNorm = isBipolar ? valueToNorm(id, 0) : 0;
  const zeroAngle = START_ANGLE + zeroNorm * (END_ANGLE - START_ANGLE);

  const arcStart = isBipolar ? Math.min(zeroAngle, angle) : START_ANGLE;
  const arcEnd = isBipolar ? Math.max(zeroAngle, angle) : angle;
  const hasArc = Math.abs(arcEnd - arcStart) > 0.8;

  const accentColor =
    accent === 'copper' ? '#fb923c' : accent === 'ivory' ? '#ede4d4' : '#fbbf24';

  const commitNorm = useCallback(
    (nextNorm: number) => {
      const clamped = Math.min(1, Math.max(0, nextNorm));
      const nextVal = normToValue(id, clamped);
      onChange(id, nextVal);
    },
    [id, onChange],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startNorm: norm };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    const sensitivity = e.shiftKey ? 520 : 170;
    commitNorm(dragRef.current.startNorm + dy / sensitivity);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if released
    }
  };

  const handleDoubleClick = () => {
    onChange(id, spec.def);
  };

  // CC learn (hosted builds): right-click arms MIDI learn for this parameter.
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!juceBridge.isHostedInJuce()) return;
    e.preventDefault();
    juceBridge.learnAutomation(id);
  };

  const wheelStateRef = useRef({ norm, commitNorm });
  wheelStateRef.current = { norm, commitNorm };

  const knobRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = knobRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.shiftKey ? 0.004 : 0.025;
      const dir = e.deltaY < 0 ? 1 : -1;
      const { norm: curNorm, commitNorm: commit } = wheelStateRef.current;
      commit(curNorm + dir * step);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.01 : 0.04;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      commitNorm(norm + step);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      commitNorm(norm - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(id, spec.min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(id, spec.max);
    }
  };

  const scaleTicks = useMemo(() => {
    const ticks: { x1: number; y1: number; x2: number; y2: number; major: boolean; zero: boolean }[] = [];
    for (let i = 0; i <= 12; i++) {
      const deg = START_ANGLE + (i / 12) * (END_ANGLE - START_ANGLE);
      const major = i % 2 === 0;
      const p1 = polarToCartesian(center, center, dims.r + dims.tickGap, deg);
      const p2 = polarToCartesian(center, center, dims.r + dims.tickGap + (major ? dims.tickLen : dims.tickLen * 0.55), deg);
      ticks.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, major, zero: i === 6 && isBipolar });
    }
    return ticks;
  }, [center, dims.r, dims.tickGap, dims.tickLen, isBipolar]);

  const knurlLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const outerR = dims.cap / 2;
    const innerR = dims.inner / 2 + 1.5;
    for (let i = 0; i < dims.knurls; i++) {
      const deg = (i / dims.knurls) * 360;
      const p1 = polarToCartesian(center, center, innerR, deg);
      const p2 = polarToCartesian(center, center, outerR - 0.6, deg);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    return lines;
  }, [center, dims.cap, dims.inner, dims.knurls]);

  const active = dragging || hovered;
  const isSmall = size === 'xxs' || size === 'xs';

  return (
    <div
      className={
        layout === 'inline'
          ? `flex items-center ${size === 'xxs' ? 'gap-1' : 'gap-1.5'} select-none group min-w-0`
          : 'flex flex-col items-center select-none group'
      }
    >
      <div
        ref={knobRef}
        role="slider"
        tabIndex={0}
        aria-label={spec.label}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        aria-valuetext={formatParamValue(id, value)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative flex items-center justify-center rounded-full cursor-ns-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 transition-transform duration-150 ${
          dragging ? 'scale-[1.04]' : hovered ? 'scale-[1.02]' : ''
        }`}
        style={{ width: dims.px, height: dims.px }}
        title={`${spec.label}: ${formatParamValue(id, value)} (Drag · Shift = Fine · Double-click = Reset · Right-click = CC Learn)`}
      >
        {/* Subtle Animated Ambient Halo */}
        <div
          className={`absolute inset-1 rounded-full pointer-events-none transition-opacity duration-200 ${
            active ? 'opacity-90 knob-active-glow' : 'opacity-25'
          }`}
          style={{
            background: `radial-gradient(circle, ${accentColor}33 0%, transparent 72%)`,
          }}
        />

        <svg width={dims.px} height={dims.px} className="overflow-visible pointer-events-none relative z-10">
          <defs>
            <radialGradient id={`skirt-${uid}`} cx="34%" cy="26%" r="74%">
              <stop offset="0%" stopColor="#524b43" />
              <stop offset="52%" stopColor="#24201c" />
              <stop offset="100%" stopColor="#0b0908" />
            </radialGradient>
            <radialGradient id={`top-${uid}`} cx="35%" cy="25%" r="75%">
              <stop offset="0%" stopColor="#433d36" />
              <stop offset="55%" stopColor="#1b1815" />
              <stop offset="100%" stopColor="#0d0b0a" />
            </radialGradient>
            <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,236,195,0.42)" />
              <stop offset="50%" stopColor="rgba(217,155,67,0.18)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.92)" />
            </linearGradient>
          </defs>

          {/* Calibrated Scale Ticks */}
          {scaleTicks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.zero ? 'rgba(251,191,36,0.9)' : t.major ? 'rgba(244,239,230,0.34)' : 'rgba(244,239,230,0.14)'}
              strokeWidth={t.zero ? 1.8 : t.major ? 1.3 : 0.9}
              strokeLinecap="round"
            />
          ))}

          {/* Recessed Track Groove + Outer Ring */}
          <path
            d={describeArc(center, center, dims.r, START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="rgba(0, 0, 0, 0.72)"
            strokeWidth={dims.stroke + 1.2}
            strokeLinecap="round"
          />
          <path
            d={describeArc(center, center, dims.r, START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="rgba(255, 240, 220, 0.1)"
            strokeWidth={dims.stroke}
            strokeLinecap="round"
          />

          {/* Active Luminous Arc */}
          {hasArc && (
            <path
              d={describeArc(center, center, dims.r, arcStart, arcEnd)}
              fill="none"
              stroke={accentColor}
              strokeWidth={dims.stroke}
              strokeLinecap="round"
              style={{
                filter: active ? `drop-shadow(0 0 6px ${accentColor})` : `drop-shadow(0 0 2.5px ${accentColor}55)`,
              }}
            />
          )}

          {/* 3D Drop Shadow & Collar Recess */}
          <circle cx={center} cy={center + 2.4} r={dims.cap / 2} fill="rgba(0, 0, 0, 0.88)" />
          <circle cx={center} cy={center} r={dims.cap / 2 + 0.8} fill="#060807" />

          {/* Machined Knurled Brass/Steel Skirt */}
          <circle
            cx={center}
            cy={center}
            r={dims.cap / 2}
            fill={`url(#skirt-${uid})`}
            stroke={`url(#rim-${uid})`}
            strokeWidth={1.35}
          />

          {/* Rotating Knurls + Brushed Specular Top + Glowing Indicator */}
          <g
            transform={`rotate(${angle} ${center} ${center})`}
            style={{ transition: dragging ? 'none' : 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {knurlLines.map((kl, idx) => (
              <line
                key={idx}
                x1={kl.x1}
                y1={kl.y1}
                x2={kl.x2}
                y2={kl.y2}
                stroke="rgba(0,0,0,0.68)"
                strokeWidth={isSmall ? 1.0 : 1.2}
              />
            ))}

            {/* Stepped Inner Anodized Dish */}
            <circle
              cx={center}
              cy={center}
              r={dims.inner / 2}
              fill={`url(#top-${uid})`}
              stroke="rgba(255,235,195,0.26)"
              strokeWidth={1}
            />
            <circle
              cx={center}
              cy={center}
              r={dims.inner / 2 - 2.2}
              fill="none"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={0.7}
            />
            {/* Dynamic Specular Reflection Wedge */}
            <path
              d={`M ${center} ${center} L ${center - dims.inner * 0.25} ${center - dims.inner * 0.42} A ${dims.inner / 2} ${dims.inner / 2} 0 0 1 ${center + dims.inner * 0.25} ${center - dims.inner * 0.42} Z`}
              fill="rgba(255,245,220,0.09)"
            />

            {/* Recessed Pointer Channel + Luminous Tip */}
            <line
              x1={center}
              y1={center - dims.cap / 2 + 1.4}
              x2={center}
              y2={center - dims.inner / 2 + (size === 'lg' ? 14 : size === 'xxs' ? 5.2 : size === 'xs' ? 6.8 : 10)}
              stroke="#070605"
              strokeWidth={size === 'lg' ? 4.6 : size === 'xxs' ? 2.4 : size === 'xs' ? 2.8 : 3.4}
              strokeLinecap="round"
            />
            <line
              x1={center}
              y1={center - dims.cap / 2 + 1.8}
              x2={center}
              y2={center - dims.inner / 2 + (size === 'lg' ? 13 : size === 'xxs' ? 4.6 : size === 'xs' ? 6.2 : 9.2)}
              stroke={accentColor}
              strokeWidth={size === 'lg' ? 2.6 : size === 'xxs' ? 1.4 : size === 'xs' ? 1.7 : 2.0}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 3.5px ${accentColor})`,
              }}
            />
            {/* Precision Tip Dot */}
            <circle
              cx={center}
              cy={center - dims.cap / 2 + 2.2}
              r={isSmall ? 1.0 : 1.4}
              fill="#fffbeb"
              opacity={0.9}
            />
          </g>
        </svg>
      </div>

      <div className={layout === 'inline' ? `flex flex-col leading-tight ${size === 'xxs' ? 'min-w-[24px]' : 'min-w-[30px]'}` : 'flex flex-col items-center'}>
        <span
          className={`font-bold uppercase tracking-[0.06em] text-[#e5ddd0] whitespace-nowrap ${
            layout === 'inline'
              ? 'text-[9.5px] leading-tight'
              : size === 'xxs'
                ? 'mt-0.5 text-[9.5px] leading-tight'
                : size === 'xs'
                  ? 'mt-0.5 text-[10px] leading-tight'
                  : 'mt-0.5 text-[11px] leading-tight'
          }`}
        >
          {labelOverride ?? spec.shortLabel}
        </span>
        {!hideValue && (
          <span
            className={`font-mono-tabular leading-tight transition-colors duration-150 whitespace-nowrap ${
              size === 'xxs' ? 'text-[9px]' : isSmall ? 'text-[9.5px]' : 'text-[10.5px]'
            } ${
              active ? 'text-amber-300 font-semibold' : 'text-[#9aa89c]'
            }`}
          >
            {formatParamValue(id, value)}
          </span>
        )}
      </div>
    </div>
  );
};
