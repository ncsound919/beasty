import React, { useEffect, useRef } from 'react';
import { ArrowLeftRight, Check, RotateCcw, Sparkles, X } from 'lucide-react';
import { SynthTelemetry } from '../synth/audioEngine';
import {
  LFO_WAVE_LABELS,
  MOD_DEST_LABELS,
  MOD_MATRIX_PRESETS,
  MOD_SOURCE_LABELS,
  ModMatrixPreset,
  ParamID,
  ParamState,
} from '../synth/parameters';
import { RotaryKnob } from './RotaryKnob';

interface ModMatrixModalProps {
  open: boolean;
  params: ParamState;
  getTelemetry: () => SynthTelemetry;
  onChange: (id: ParamID, value: number) => void;
  onApplyPattern: (patch: Partial<ParamState>) => void;
  onClose: () => void;
}

const SLOTS = [1, 2, 3, 4, 5, 6] as const;

function evalLfoShape(phase: number, wave: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (wave === 0) return Math.sin(p * Math.PI * 2);
  if (wave === 1) return p < 0.25 ? p * 4 : p < 0.75 ? 2 - p * 4 : p * 4 - 4;
  if (wave === 2) return p * 2 - 1;
  if (wave === 3) return p < 0.5 ? 1 : -1;
  const step = Math.floor(p * 6);
  const pseudo = Math.sin(step * 12.9898 + 4.14) * 43758.5453;
  return (pseudo - Math.floor(pseudo)) * 2 - 1;
}

const LfoScope: React.FC<{ rate: number; wave: number; color: string }> = ({ rate, wave, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ rate, wave, color });
  stateRef.current = { rate, wave, color };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = (now: number) => {
      if (document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const { rate: r, wave: w, color: col } = stateRef.current;
      const t = now * 0.001;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(140, canvas.clientWidth);
      const ch = Math.max(44, canvas.clientHeight);
      if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
      }
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      ctx.strokeStyle = 'rgba(255, 240, 215, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ch / 2);
      ctx.lineTo(cw, ch / 2);
      ctx.stroke();

      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.shadowColor = col;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      const cycles = Math.max(1, Math.min(4, 1 + r * 0.25));
      for (let i = 0; i <= 72; i++) {
        const u = i / 72;
        const val = evalLfoShape(u * cycles + t * r * 0.35, w);
        const x = u * cw;
        const y = ch / 2 - val * (ch * 0.36);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative rounded-lg recessed-screen overflow-hidden h-[54px]">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="oled-scanlines absolute inset-0 pointer-events-none" aria-hidden="true" />
    </div>
  );
};

export const ModMatrixModal: React.FC<ModMatrixModalProps> = ({
  open,
  params,
  getTelemetry,
  onChange,
  onApplyPattern,
  onClose,
}) => {
  const meterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const telRef = useRef(getTelemetry);
  telRef.current = getTelemetry;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      if (document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const tel = telRef.current();
      const p = paramsRef.current;
      SLOTS.forEach((slot, idx) => {
        const el = meterRefs.current[idx];
        if (!el) return;
        const src = Math.round(p[`MOD${slot}_SRC` as ParamID] ?? 0);
        const dst = Math.round(p[`MOD${slot}_DST` as ParamID] ?? 0);
        const amt = p[`MOD${slot}_AMT` as ParamID] ?? 0;
        if (src === 0 || dst === 0 || Math.abs(amt) < 0.01) {
          el.style.opacity = '0.15';
          return;
        }
        let sv = 0;
        if (src === 1) sv = tel.lfo1;
        else if (src === 2) sv = tel.lfo2;
        else if (src === 3) sv = tel.filterEnv;
        else if (src === 4) sv = tel.ampEnv;
        else if (src === 5) sv = tel.activeVoices > 0 ? 0.8 : 0.25;
        else if (src === 7) sv = p.ANALOG_DRIFT;
        else sv = 0.45;
        const pulse = Math.min(1, 0.35 + Math.abs(sv * amt) * 0.9);
        el.style.opacity = pulse.toFixed(2);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const activeSlotsCount = SLOTS.filter((slot) => {
    const s = Math.round(params[`MOD${slot}_SRC` as ParamID] ?? 0);
    const d = Math.round(params[`MOD${slot}_DST` as ParamID] ?? 0);
    const a = params[`MOD${slot}_AMT` as ParamID] ?? 0;
    return s > 0 && d > 0 && Math.abs(a) > 0.01;
  }).length;

  const isPatternActive = (preset: ModMatrixPreset): boolean => {
    for (const [k, v] of Object.entries(preset.patch)) {
      if (Math.abs((params[k as ParamID] ?? 0) - (v as number)) > 0.02) return false;
    }
    return true;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-5 bg-black/80"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Beasty Modulation Matrix"
    >
      <div className="w-full max-w-[920px] max-h-[90vh] rounded-2xl beasty-card-3d border border-amber-500/45 shadow-[0_32px_90px_rgba(0,0,0,0.96)] overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-amber-500/20 bg-[#0b110d]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-scratch text-xl sm:text-2xl tracking-wider text-amber-300">
              MOD MATRIX
            </span>
            <span className="text-xs font-mono-tabular text-[#98a69a]">
              {activeSlotsCount} / 6 Active Routings · Dual LFO
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const clear = MOD_MATRIX_PRESETS.find((m) => m.id === 'mod-clear');
                if (clear) onApplyPattern(clear.patch);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.12] bg-[#121914] text-xs font-semibold text-[#b8c4b9] hover:text-[#f4efe6] hover:border-amber-400/40 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-amber-400/55 bg-amber-500/22 text-amber-200 hover:bg-amber-500/32 text-xs font-bold transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto beasty-scroll">
          {/* Mod Matrix Classic Effect Pattern Presets */}
          <div className="rounded-xl bg-[#090e0b] border border-amber-500/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fast Effect Pattern Presets</span>
              </div>
              <span className="text-[11px] text-[#8fa192]">
                One-click modulation patterns for instant motion
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MOD_MATRIX_PRESETS.filter((p) => p.id !== 'mod-clear').map((preset) => {
                const active = isPatternActive(preset);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplyPattern(preset.patch)}
                    title={preset.description}
                    className={`flex flex-col items-start text-left px-2.5 py-2 rounded-lg border transition-all ${
                      active
                        ? 'border-amber-400/70 bg-amber-500/22 text-amber-100 shadow-[inset_0_1px_0_rgba(255,235,190,0.2)]'
                        : 'border-white/[0.09] bg-[#101712] text-[#e8e0d2] hover:border-amber-400/45 hover:bg-[#141d17]'
                    }`}
                  >
                    <span className="text-xs font-bold truncate w-full">{preset.name}</span>
                    <span className="text-[10px] text-[#8b9b8e] truncate w-full mt-0.5">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual LFO Hardware Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              { num: 1, rateId: 'LFO1_RATE' as ParamID, waveId: 'LFO1_WAVE' as ParamID, color: '#fbbf24' },
              { num: 2, rateId: 'LFO2_RATE' as ParamID, waveId: 'LFO2_WAVE' as ParamID, color: '#6ee7b7' },
            ]).map((lfo) => {
              const rate = params[lfo.rateId];
              const wave = Math.round(params[lfo.waveId]);
              return (
                <div
                  key={lfo.num}
                  className="beasty-card-3d rounded-xl p-3 flex items-center gap-3"
                >
                  <RotaryKnob
                    id={lfo.rateId}
                    value={rate}
                    onChange={onChange}
                    size="sm"
                    labelOverride={`LFO ${lfo.num}`}
                    accent={lfo.num === 1 ? 'amber' : 'ivory'}
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <LfoScope rate={rate} wave={wave} color={lfo.color} />
                    <div className="grid grid-cols-5 gap-1">
                      {LFO_WAVE_LABELS.map((wLbl, idx) => (
                        <button
                          key={wLbl}
                          type="button"
                          onClick={() => onChange(lfo.waveId, idx)}
                          className={`py-1 rounded text-[11px] font-bold border transition-colors ${
                            wave === idx
                              ? 'border-amber-400/65 bg-amber-500/22 text-amber-100'
                              : 'border-white/[0.08] bg-[#080c09] text-[#8b9b8e] hover:text-[#f4efe6]'
                          }`}
                        >
                          {wLbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 6-Slot Modulation Routing Matrix */}
          <div className="rounded-xl bg-[#090e0b] border border-amber-500/20 p-3 space-y-2">
            <div className="hidden sm:grid grid-cols-[44px_1fr_1.45fr_1fr_64px] gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-[#8fa192]">
              <span>Slot</span>
              <span>Source</span>
              <span>Depth (-100% to +100%)</span>
              <span>Destination</span>
              <span className="text-right">Action</span>
            </div>

            <div className="space-y-1.5">
              {SLOTS.map((slot, idx) => {
                const srcId = `MOD${slot}_SRC` as ParamID;
                const dstId = `MOD${slot}_DST` as ParamID;
                const amtId = `MOD${slot}_AMT` as ParamID;
                const src = Math.round(params[srcId] ?? 0);
                const dst = Math.round(params[dstId] ?? 0);
                const amt = params[amtId] ?? 0;
                const active = src > 0 && dst > 0 && Math.abs(amt) > 0.01;
                const pct = Math.round(amt * 100);

                return (
                  <div
                    key={slot}
                    className={`grid grid-cols-1 sm:grid-cols-[44px_1fr_1.45fr_1fr_64px] gap-2 items-center rounded-lg px-2 py-1.5 border transition-colors ${
                      active
                        ? 'bg-[#121a14] border-amber-400/40'
                        : 'bg-[#0d140f] border-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        ref={(el) => {
                          meterRefs.current[idx] = el;
                        }}
                        className={`w-2 h-2 rounded-full ${active ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-[#2a382d]'}`}
                      />
                      <span className="font-mono-tabular text-xs font-bold text-[#f4efe6]">
                        M{slot}
                      </span>
                    </div>

                    <select
                      aria-label={`Slot ${slot} Source`}
                      value={src}
                      onChange={(e) => {
                        const nextSrc = Number(e.target.value);
                        onChange(srcId, nextSrc);
                        if (nextSrc > 0 && dst === 0) onChange(dstId, 1);
                        if (nextSrc > 0 && Math.abs(amt) < 0.01) onChange(amtId, 0.35);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-md recessed-screen text-xs font-semibold text-[#f4efe6] focus:outline-none focus:border-amber-400/60"
                    >
                      {MOD_SOURCE_LABELS.map((lbl, i) => (
                        <option key={lbl} value={i} className="bg-[#0d140f] text-[#f4efe6]">
                          {lbl}
                        </option>
                      ))}
                    </select>

                    {/* Bipolar Modulation Amount Slider */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 flex items-center">
                        <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-px h-3 bg-white/25 pointer-events-none" />
                        <input
                          type="range"
                          min={-1}
                          max={1}
                          step={0.01}
                          value={amt}
                          onChange={(e) => onChange(amtId, parseFloat(e.target.value))}
                          onDoubleClick={() => onChange(amtId, 0)}
                          aria-label={`Slot ${slot} Depth`}
                          className="w-full h-1.5 appearance-none rounded-full bg-[#070b08] border border-white/[0.1] cursor-pointer accent-amber-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-b [&::-webkit-slider-thumb]:from-amber-200 [&::-webkit-slider-thumb]:to-amber-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-amber-100/70 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(251,191,36,0.75)]"
                        />
                      </div>
                      <span
                        className={`w-12 text-right font-mono-tabular text-xs font-bold ${
                          pct > 0 ? 'text-amber-300' : pct < 0 ? 'text-emerald-300' : 'text-[#7f8f82]'
                        }`}
                      >
                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                      </span>
                    </div>

                    <select
                      aria-label={`Slot ${slot} Destination`}
                      value={dst}
                      onChange={(e) => {
                        const nextDst = Number(e.target.value);
                        onChange(dstId, nextDst);
                        if (nextDst > 0 && src === 0) onChange(srcId, 1);
                        if (nextDst > 0 && Math.abs(amt) < 0.01) onChange(amtId, 0.35);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-md recessed-screen text-xs font-semibold text-[#f4efe6] focus:outline-none focus:border-amber-400/60"
                    >
                      {MOD_DEST_LABELS.map((lbl, i) => (
                        <option key={lbl} value={i} className="bg-[#0d140f] text-[#f4efe6]">
                          {lbl}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onChange(amtId, Number((-amt).toFixed(2)))}
                        title="Invert polarity"
                        aria-label={`Invert slot ${slot}`}
                        className="p-1.5 rounded bg-[#080c09] border border-white/[0.1] text-[#98a69a] hover:text-amber-300 hover:border-amber-400/40"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(srcId, 0);
                          onChange(dstId, 0);
                          onChange(amtId, 0);
                        }}
                        title="Clear slot"
                        aria-label={`Clear slot ${slot}`}
                        className="p-1.5 rounded bg-[#080c09] border border-white/[0.1] text-[#98a69a] hover:text-red-300 hover:border-red-400/40"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
