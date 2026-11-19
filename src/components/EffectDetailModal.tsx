import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  CLASSIC_FILTER_LABELS,
  ParamID,
  ParamState,
  SAT_MODE_LABELS,
} from '../synth/parameters';
import { RotaryKnob } from './RotaryKnob';

export type EffectKey = 'delay' | 'reverb' | 'phaser' | 'flanger' | 'sat' | 'filter';

interface EffectDetailModalProps {
  activeEffect: EffectKey | null;
  params: ParamState;
  onSelectEffect: (key: EffectKey) => void;
  onChange: (id: ParamID, value: number) => void;
  onClose: () => void;
}

const FX_TABS: { key: EffectKey; title: string; toggleId: ParamID }[] = [
  { key: 'delay', title: 'Tape Delay', toggleId: 'FX_DELAY_ON' },
  { key: 'reverb', title: 'Forest Reverb', toggleId: 'FX_REVERB_ON' },
  { key: 'phaser', title: '4-Stage Phaser', toggleId: 'FX_PHASER_ON' },
  { key: 'flanger', title: 'Jet Flanger', toggleId: 'FX_FLANGER_ON' },
  { key: 'sat', title: 'Analog Saturation', toggleId: 'FX_SAT_ON' },
  { key: 'filter', title: 'Classic Filter FX', toggleId: 'FX_FILTER_ON' },
];

export const EffectDetailModal: React.FC<EffectDetailModalProps> = ({
  activeEffect,
  params,
  onSelectEffect,
  onChange,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ activeEffect, params });
  stateRef.current = { activeEffect, params };

  useEffect(() => {
    if (!activeEffect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeEffect, onClose]);

  useEffect(() => {
    if (!activeEffect) return;
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
      const t = now * 0.001;
      const { activeEffect: fx, params: p } = stateRef.current;
      if (!fx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(320, canvas.clientWidth);
      const ch = Math.max(130, canvas.clientHeight);
      if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      const bg = ctx.createRadialGradient(cw * 0.5, ch * 0.45, 12, cw * 0.5, ch * 0.5, cw * 0.65);
      bg.addColorStop(0, '#132118');
      bg.addColorStop(1, '#050906');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);

      // Calibration grid
      ctx.strokeStyle = 'rgba(255, 240, 215, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const x = (i / 6) * cw;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
        ctx.stroke();
      }
      for (let j = 1; j < 4; j++) {
        const y = (j / 4) * ch;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
      }

      if (fx === 'delay') {
        const time = p.FX_DELAY_TIME;
        const fb = p.FX_DELAY_FEEDBACK;
        const mix = p.FX_DELAY_MIX;
        const tone = p.FX_DELAY_TONE;
        const taps = 9;
        const baseSpacing = 22 + time * 52;
        for (let i = 0; i < taps; i++) {
          const amp = (i === 0 ? 1 : Math.pow(Math.max(0.15, fb), i) * (0.45 + mix * 0.75));
          const x = 36 + i * baseSpacing;
          if (x > cw - 20) break;
          const barH = Math.max(4, amp * (ch * 0.72));
          const y = ch - 18 - barH;
          const pulse = 0.85 + 0.15 * Math.sin(t * 4 - i * 0.6);
          ctx.fillStyle = i === 0 ? '#ede4d4' : `rgba(251, 191, 36, ${Math.max(0.18, amp * pulse).toFixed(2)})`;
          ctx.fillRect(x, y, 12, barH);
          // Warm tone cap
          ctx.fillStyle = `rgba(110, 231, 183, ${(tone * amp * 0.8).toFixed(2)})`;
          ctx.fillRect(x, y, 12, 3);
        }
      } else if (fx === 'reverb') {
        const size = p.FX_REVERB_SIZE;
        const damp = p.FX_REVERB_DAMP;
        const mix = p.FX_REVERB_MIX;
        ctx.beginPath();
        ctx.moveTo(16, ch - 18);
        for (let x = 16; x < cw - 16; x += 3) {
          const norm = (x - 16) / (cw - 32);
          const env = Math.exp(-norm * (4.2 - size * 3.1)) * (0.35 + mix * 0.65);
          const scatter = (0.72 + 0.28 * Math.sin(norm * 65 + t * 5.5) * Math.cos(norm * 31 - t * 3.2)) * (1 - damp * norm * 0.45);
          const y = ch - 18 - env * scatter * (ch - 40);
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.lineTo(cw - 16, ch - 18);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 18, 0, ch - 18);
        grad.addColorStop(0, 'rgba(110, 231, 183, 0.34)');
        grad.addColorStop(1, 'rgba(110, 231, 183, 0.02)');
        ctx.fillStyle = grad;
        ctx.fill();
      } else if (fx === 'phaser') {
        const rate = p.FX_PHASER_RATE;
        const depth = p.FX_PHASER_DEPTH;
        const fb = p.FX_PHASER_FB;
        const sweep = Math.sin(t * rate * Math.PI * 1.4) * depth;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i <= 140; i++) {
          const u = i / 140;
          const notches = [0.22 + sweep * 0.12, 0.42 + sweep * 0.14, 0.64 + sweep * 0.12, 0.82 + sweep * 0.1];
          let mag = 0.72;
          for (const nPos of notches) {
            const d = Math.abs(u - nPos);
            mag -= (0.55 + fb * 0.25) * Math.exp(-d * d * 420);
          }
          const x = u * cw;
          const y = ch * 0.78 - mag * (ch * 0.56);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (fx === 'flanger') {
        const rate = p.FX_FLANGER_RATE;
        const depth = p.FX_FLANGER_DEPTH;
        const fb = p.FX_FLANGER_FB;
        const phaseShift = Math.sin(t * rate * Math.PI * 1.6) * (1.2 + depth * 2.5);
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i <= 150; i++) {
          const u = i / 150;
          const comb = 0.5 + 0.5 * Math.cos(u * Math.PI * (8 + depth * 12) + phaseShift);
          const shaped = Math.pow(comb, 0.75 + fb * 1.4);
          const x = u * cw;
          const y = ch - 20 - shaped * (ch - 44);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (fx === 'sat') {
        const drv = p.FX_SAT_DRIVE;
        const mode = Math.round(p.FX_SAT_MODE);
        const k = 1 + drv * (mode === 2 ? 28 : mode === 3 ? 20 : 14);
        // Transfer curve
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const xNorm = (i / 120) * 2 - 1;
          let yNorm = 0;
          if (mode === 1) {
            yNorm = (xNorm >= 0 ? Math.tanh(xNorm * k * 1.15) : Math.tanh(xNorm * k * 0.85)) / Math.tanh(k);
          } else if (mode === 2) {
            yNorm = Math.max(-0.88, Math.min(0.88, Math.tanh(xNorm * k) * 1.12));
          } else if (mode === 3) {
            yNorm = Math.sin(Math.min(Math.PI * 0.48, Math.max(-Math.PI * 0.48, xNorm * (1 + drv * 3.2))));
          } else {
            yNorm = Math.tanh(xNorm * k) / Math.tanh(k);
          }
          const px = (i / 120) * cw;
          const py = ch * 0.5 - yNorm * (ch * 0.36);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (fx === 'filter') {
        const fltType = Math.round(p.FX_FILTER_TYPE);
        const cut = p.FX_FILTER_CUTOFF;
        const lpCut = p.FX_FILTER_LP;
        const hpCut = p.FX_FILTER_HP;
        const res = p.FX_FILTER_RES;
        const drv = p.FX_FILTER_DRIVE;
        const logMin = Math.log10(20);
        const logMax = Math.log10(18000);

        // Subtle vertical HP and LP band-edge guides
        const hpU = Math.max(0, Math.min(1, (Math.log10(Math.max(20, hpCut)) - logMin) / (logMax - logMin)));
        const lpU = Math.max(0, Math.min(1, (Math.log10(Math.max(60, lpCut)) - logMin) / (logMax - logMin)));
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(237, 228, 212, 0.32)';
        ctx.beginPath();
        ctx.moveTo(hpU * cw, 12);
        ctx.lineTo(hpU * cw, ch - 12);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.beginPath();
        ctx.moveTo(lpU * cw, 12);
        ctx.lineTo(lpU * cw, ch - 12);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = fltType === 1 ? '#a3e635' : fltType === 3 ? '#fb923c' : '#fbbf24';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const u = i / 120;
          const hz = Math.pow(10, logMin + u * (logMax - logMin));
          const hpMag = 1 / Math.sqrt(1 + Math.pow(Math.max(20, hpCut) / Math.max(15, hz), 4));
          const lpMag = 1 / Math.sqrt(1 + Math.pow(hz / Math.max(60, lpCut), 4));
          const ratio = hz / Math.max(40, cut);
          let charMag = 0.7;
          if (fltType === 4) {
            const inv = 1 / Math.max(0.05, ratio);
            charMag =
              (1 / Math.sqrt(1 + Math.pow(inv, 4))) * 0.78 +
              res * 0.32 * Math.exp(-Math.pow(Math.log2(Math.max(0.05, ratio)) * 3.5, 2));
          } else if (fltType === 3) {
            const lp = 1 / Math.sqrt(1 + Math.pow(ratio, 4));
            const hp = 1 / Math.sqrt(1 + Math.pow(0.22 / Math.max(0.02, ratio), 2));
            charMag =
              lp * hp * (0.8 + drv * 0.2) +
              res * 0.5 * Math.exp(-Math.pow(Math.log2(Math.max(0.05, ratio)) * 4.5, 2));
          } else {
            const poles = fltType === 2 ? 2 : fltType === 1 ? 3 : 4;
            const lp = 1 / Math.sqrt(Math.pow(1 + ratio * ratio, poles));
            const peak =
              res *
              (fltType === 1 ? 0.52 : 0.38) *
              Math.exp(-Math.pow(Math.log2(Math.max(0.05, ratio)) * 3.8, 2));
            charMag = lp * (0.76 + drv * 0.14) + peak;
          }
          const mag = charMag * hpMag * lpMag;
          const px = u * cw;
          const py = ch - 16 - Math.min(1.12, Math.max(0.02, mag)) * (ch - 36);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [activeEffect]);

  if (!activeEffect) return null;

  const currentTab = FX_TABS.find((t) => t.key === activeEffect) ?? FX_TABS[0];
  const isEnabled = params[currentTab.toggleId] >= 0.5;
  const activeFilterType = Math.round(params.FX_FILTER_TYPE);
  const activeSatMode = Math.round(params.FX_SAT_MODE);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/75"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${currentTab.title} Detail Editor`}
    >
      <div className="w-full max-w-[700px] max-h-[92vh] rounded-2xl beasty-card-3d border border-amber-500/45 shadow-[0_32px_90px_rgba(0,0,0,0.96)] overflow-hidden flex flex-col">
        {/* Top Effect Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-amber-500/20 bg-[#0b110d]">
          <div className="flex flex-wrap items-center gap-1">
            {FX_TABS.map((tab) => {
              const active = tab.key === activeEffect;
              const on = params[tab.toggleId] >= 0.5;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onSelectEffect(tab.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                      : 'text-[#8fa192] hover:text-[#f4efe6] border border-transparent'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-amber-400' : 'bg-[#2a382d]'}`} />
                  <span>{tab.title.split(' ').slice(-1)[0]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChange(currentTab.toggleId, isEnabled ? 0 : 1)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                isEnabled
                  ? 'border-amber-400/60 bg-amber-500/25 text-amber-200'
                  : 'border-white/[0.14] bg-[#121914] text-[#9aa89c]'
              }`}
            >
              {isEnabled ? 'ACTIVE' : 'BYPASSED'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close effect editor"
              className="p-1.5 rounded-lg border border-white/[0.12] bg-[#121914] text-[#9aa89c] hover:text-[#f4efe6]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Large Visualizer Scope */}
        <div className="p-4 space-y-4 overflow-y-auto beasty-scroll">
          <div className="recessed-screen rounded-xl h-[146px] relative overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="oled-scanlines absolute inset-0 pointer-events-none" aria-hidden="true" />
            <div className="absolute top-2 left-3 text-xs font-display font-bold tracking-wide text-amber-200 uppercase z-10">
              {currentTab.title}
            </div>
          </div>

          {/* Model / Mode Switchers for Filter FX and Saturation */}
          {activeEffect === 'filter' && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-xl bg-[#080c09] border border-amber-500/20">
              {CLASSIC_FILTER_LABELS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange('FX_FILTER_TYPE', idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeFilterType === idx
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/55'
                      : 'text-[#92a395] hover:text-[#f4efe6] border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {activeEffect === 'sat' && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-xl bg-[#080c09] border border-amber-500/20">
              {SAT_MODE_LABELS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onChange('FX_SAT_MODE', idx)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeSatMode === idx
                      ? 'bg-orange-500/25 text-orange-200 border border-orange-400/55'
                      : 'text-[#92a395] hover:text-[#f4efe6] border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Detailed Rotary Knobs Grid */}
          <div className="beasty-card-3d rounded-xl p-3 flex flex-wrap items-center justify-around gap-3">
            {activeEffect === 'delay' && (
              <>
                <RotaryKnob id="FX_DELAY_MIX" value={params.FX_DELAY_MIX} onChange={onChange} size="md" />
                <RotaryKnob id="FX_DELAY_TIME" value={params.FX_DELAY_TIME} onChange={onChange} size="md" accent="ivory" />
                <RotaryKnob id="FX_DELAY_FEEDBACK" value={params.FX_DELAY_FEEDBACK} onChange={onChange} size="md" accent="copper" />
                <RotaryKnob id="FX_DELAY_TONE" value={params.FX_DELAY_TONE} onChange={onChange} size="md" accent="ivory" />
              </>
            )}
            {activeEffect === 'reverb' && (
              <>
                <RotaryKnob id="FX_REVERB_MIX" value={params.FX_REVERB_MIX} onChange={onChange} size="md" accent="ivory" />
                <RotaryKnob id="FX_REVERB_SIZE" value={params.FX_REVERB_SIZE} onChange={onChange} size="md" />
                <RotaryKnob id="FX_REVERB_DAMP" value={params.FX_REVERB_DAMP} onChange={onChange} size="md" accent="copper" />
              </>
            )}
            {activeEffect === 'phaser' && (
              <>
                <RotaryKnob id="FX_PHASER_MIX" value={params.FX_PHASER_MIX} onChange={onChange} size="md" />
                <RotaryKnob id="FX_PHASER_RATE" value={params.FX_PHASER_RATE} onChange={onChange} size="md" accent="ivory" />
                <RotaryKnob id="FX_PHASER_DEPTH" value={params.FX_PHASER_DEPTH} onChange={onChange} size="md" />
                <RotaryKnob id="FX_PHASER_FB" value={params.FX_PHASER_FB} onChange={onChange} size="md" accent="copper" />
              </>
            )}
            {activeEffect === 'flanger' && (
              <>
                <RotaryKnob id="FX_FLANGER_MIX" value={params.FX_FLANGER_MIX} onChange={onChange} size="md" accent="ivory" />
                <RotaryKnob id="FX_FLANGER_RATE" value={params.FX_FLANGER_RATE} onChange={onChange} size="md" />
                <RotaryKnob id="FX_FLANGER_DEPTH" value={params.FX_FLANGER_DEPTH} onChange={onChange} size="md" accent="ivory" />
                <RotaryKnob id="FX_FLANGER_FB" value={params.FX_FLANGER_FB} onChange={onChange} size="md" accent="copper" />
              </>
            )}
            {activeEffect === 'sat' && (
              <>
                <RotaryKnob id="FX_SAT_DRIVE" value={params.FX_SAT_DRIVE} onChange={onChange} size="md" accent="copper" />
                <RotaryKnob id="FX_SAT_TONE" value={params.FX_SAT_TONE} onChange={onChange} size="md" accent="ivory" />
                <RotaryKnob id="FX_SAT_MIX" value={params.FX_SAT_MIX} onChange={onChange} size="md" />
              </>
            )}
            {activeEffect === 'filter' && (
              <>
                <RotaryKnob id="FX_FILTER_LP" value={params.FX_FILTER_LP} onChange={onChange} size="sm" />
                <RotaryKnob id="FX_FILTER_HP" value={params.FX_FILTER_HP} onChange={onChange} size="sm" accent="ivory" />
                <RotaryKnob id="FX_FILTER_CUTOFF" value={params.FX_FILTER_CUTOFF} onChange={onChange} size="sm" />
                <RotaryKnob id="FX_FILTER_RES" value={params.FX_FILTER_RES} onChange={onChange} size="sm" accent="copper" />
                <RotaryKnob id="FX_FILTER_DRIVE" value={params.FX_FILTER_DRIVE} onChange={onChange} size="sm" accent="copper" />
                <RotaryKnob id="FX_FILTER_MIX" value={params.FX_FILTER_MIX} onChange={onChange} size="sm" accent="ivory" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
