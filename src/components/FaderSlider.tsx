import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PARAM_SPECS, ParamID, formatParamValue, normToValue, valueToNorm } from '../synth/parameters';

interface FaderSliderProps {
  id: ParamID;
  value: number;
  onChange: (id: ParamID, value: number) => void;
  height?: number;
  narrow?: boolean;
  labelOverride?: string;
  accent?: 'amber' | 'copper' | 'ivory';
}

export const FaderSlider: React.FC<FaderSliderProps> = ({
  id,
  value,
  onChange,
  height = 104,
  narrow = false,
  labelOverride,
  accent = 'amber',
}) => {
  const spec = PARAM_SPECS[id];
  const uid = useId();
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef<{ startY: number; startNorm: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const norm = valueToNorm(id, value);
  const accentColor =
    accent === 'copper' ? '#fb923c' : accent === 'ivory' ? '#ede4d4' : '#fbbf24';

  const commitNorm = useCallback(
    (nextNorm: number) => {
      const clamped = Math.min(1, Math.max(0, nextNorm));
      onChange(id, normToValue(id, clamped));
    },
    [id, onChange],
  );

  const capH = height < 80 ? 14 : narrow ? 17 : 22;
  const travel = Math.max(18, height - capH - 4);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const rect = el.getBoundingClientRect();
    const relY = Math.min(travel, Math.max(0, e.clientY - rect.top - (capH / 2 + 2)));
    const clickedNorm = 1 - relY / travel;
    commitNorm(clickedNorm);
    dragRef.current = { startY: e.clientY, startNorm: clickedNorm };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    const scale = e.shiftKey ? travel * 3 : travel;
    commitNorm(dragRef.current.startNorm + dy / scale);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if released
    }
  };

  const wheelStateRef = useRef({ norm, commitNorm });
  wheelStateRef.current = { norm, commitNorm };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.shiftKey ? 0.006 : 0.03;
      const { norm: curNorm, commitNorm: commit } = wheelStateRef.current;
      commit(curNorm + (e.deltaY < 0 ? 1 : -1) * step);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.01 : 0.05;
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

  const capTop = 2 + (1 - norm) * travel;
  const active = dragging || hovered;
  const svgW = narrow ? 28 : 44;
  const bezelX = narrow ? 6 : 10;
  const bezelW = narrow ? 16 : 24;
  const grooveX = narrow ? 12 : 19;
  const grooveW = narrow ? 4 : 6;
  const railX = narrow ? 12.7 : 20.2;
  const railW = narrow ? 2.6 : 3.6;
  const capX = narrow ? 2 : 4;
  const capW = narrow ? 24 : 36;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={trackRef}
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
        onDoubleClick={() => onChange(id, spec.def)}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative flex items-center justify-center cursor-ns-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 rounded ${
          narrow ? 'w-[30px]' : 'w-11'
        }`}
        style={{ height }}
        title={`${spec.label}: ${formatParamValue(id, value)} (Drag · Shift = Fine · Double-click = Reset)`}
      >
        <svg width={svgW} height={height} className="overflow-visible pointer-events-none">
          <defs>
            <linearGradient id={`bezel-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1f2821" />
              <stop offset="100%" stopColor="#090d0a" />
            </linearGradient>
            <linearGradient id={`cap-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5b544b" />
              <stop offset="35%" stopColor="#2e2924" />
              <stop offset="55%" stopColor="#1c1815" />
              <stop offset="100%" stopColor="#3c352e" />
            </linearGradient>
            <linearGradient id={`rail-${uid}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="65%" stopColor={accentColor} />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
          </defs>

          {/* Recessed Brushed Metal Fader Plate + Micro Mounting Rivets */}
          <rect
            x={bezelX}
            y={3}
            width={bezelW}
            height={height - 6}
            rx={3.5}
            fill={`url(#bezel-${uid})`}
            stroke="rgba(245,158,11,0.24)"
            strokeWidth={1}
          />
          <circle cx={bezelX + bezelW / 2} cy={5.5} r={0.9} fill="rgba(255,232,190,0.32)" />
          <circle cx={bezelX + bezelW / 2} cy={height - 5.5} r={0.9} fill="rgba(255,232,190,0.32)" />

          {/* Calibrated dB / ms Ruler Markings */}
          {[0, 0.166, 0.333, 0.5, 0.666, 0.833, 1].map((t, i) => {
            const y = 8 + t * (height - 16);
            const major = i % 2 === 0;
            const centerMark = i === 3;
            return (
              <g key={t}>
                <line
                  x1={narrow ? (major ? 0.5 : 3) : (major ? 2 : 5)}
                  y1={y}
                  x2={bezelX - 1}
                  y2={y}
                  stroke={
                    centerMark
                      ? 'rgba(251,191,36,0.55)'
                      : major
                        ? 'rgba(244,239,230,0.38)'
                        : 'rgba(244,239,230,0.16)'
                  }
                  strokeWidth={major ? 1.2 : 0.85}
                />
                <line
                  x1={bezelX + bezelW + 1}
                  y1={y}
                  x2={narrow ? (major ? svgW - 0.5 : svgW - 3) : (major ? 42 : 39)}
                  y2={y}
                  stroke={
                    centerMark
                      ? 'rgba(251,191,36,0.55)'
                      : major
                        ? 'rgba(244,239,230,0.38)'
                        : 'rgba(244,239,230,0.16)'
                  }
                  strokeWidth={major ? 1.2 : 0.85}
                />
              </g>
            );
          })}

          {/* Deep Milled Track Groove */}
          <rect
            x={grooveX}
            y={8}
            width={grooveW}
            height={height - 16}
            rx={grooveW / 2}
            fill="#040605"
            stroke="rgba(255,245,225,0.1)"
            strokeWidth={0.8}
          />

          {/* Dual Glowing LED Level Rail */}
          <rect
            x={railX}
            y={capTop + capH / 2}
            width={railW}
            height={Math.max(0, height - 9 - (capTop + capH / 2))}
            rx={railW / 2}
            fill={`url(#rail-${uid})`}
            opacity={active ? 0.98 : 0.8}
            style={{
              filter: active ? `drop-shadow(0 0 5px ${accentColor})` : undefined,
            }}
          />

          {/* High-End Machined Slider Cap with Embossed Bearclaw Slashes */}
          <g
            transform={`translate(${capX}, ${capTop})`}
            style={{ transition: dragging ? 'none' : 'transform 90ms ease-out' }}
          >
            <rect x={0} y={2} width={capW} height={capH} rx={3} fill="rgba(0,0,0,0.85)" />
            <rect
              x={0}
              y={0}
              width={capW}
              height={capH}
              rx={3}
              fill={`url(#cap-${uid})`}
              stroke={active ? 'rgba(251,191,36,0.8)' : 'rgba(255,232,190,0.32)'}
              strokeWidth={1.05}
            />
            <line x1={2} y1={1.2} x2={capW - 2} y2={1.2} stroke="rgba(255,248,230,0.32)" strokeWidth={0.9} />

            {/* Triple Bearclaw Slash Emblem Embossed on Slider Cap */}
            <g
              transform={
                narrow
                  ? `translate(2, ${capH < 16 ? 0.5 : 1}) scale(0.58, ${capH < 16 ? 0.62 : 0.76})`
                  : undefined
              }
            >
              <path
                d="M 11 17 Q 14 10 17 5 M 16.5 18 Q 19 10.5 22 4.5 M 22 17 Q 24 11 26.5 5.5"
                fill="none"
                stroke="#070605"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              <path
                d="M 11 17 Q 14 10 17 5 M 16.5 18 Q 19 10.5 22 4.5 M 22 17 Q 24 11 26.5 5.5"
                fill="none"
                stroke={accentColor}
                strokeWidth={1.45}
                strokeLinecap="round"
                opacity={active ? 1 : 0.88}
                style={{
                  filter: active ? `drop-shadow(0 0 4px ${accentColor})` : undefined,
                }}
              />
            </g>

            {/* Side Center Position Notches */}
            <line
              x1={1.5}
              y1={capH / 2}
              x2={narrow ? 4.2 : 7}
              y2={capH / 2}
              stroke={accentColor}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <line
              x1={capW - (narrow ? 4.2 : 7)}
              y1={capH / 2}
              x2={capW - 1.5}
              y2={capH / 2}
              stroke={accentColor}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      <span className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#e5ddd0] whitespace-nowrap">
        {labelOverride ?? spec.shortLabel}
      </span>
      <span
        className={`font-mono-tabular text-[9.5px] leading-tight whitespace-nowrap ${
          active ? 'text-amber-300 font-semibold' : 'text-[#9aa89c]'
        }`}
      >
        {formatParamValue(id, value)}
      </span>
    </div>
  );
};
