import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SynthTelemetry } from '../synth/audioEngine';
import { ParamID, ParamState, RANGE_LABELS, WAVE_LABELS } from '../synth/parameters';
import { EnvelopeEditor, EnvViewMode } from './EnvelopeEditor';
import { FaderSlider } from './FaderSlider';
import { FilterCurve, FilterViewMode } from './FilterCurve';
import { RotaryKnob } from './RotaryKnob';
import { InteractMode, ViewMode, Waveform3DVisualizer } from './Waveform3DVisualizer';

export type SynthSectionKey = 'osc' | 'filter' | 'env' | 'waveform';

interface SynthDetailModalProps {
  activeSection: SynthSectionKey | null;
  params: ParamState;
  envTab: 'filter' | 'amp';
  onEnvTabChange: (tab: 'filter' | 'amp') => void;
  filterViewMode: FilterViewMode;
  onFilterViewModeChange: (mode: FilterViewMode) => void;
  envViewMode: EnvViewMode;
  onEnvViewModeChange: (mode: EnvViewMode) => void;
  envShowCompare: boolean;
  onToggleEnvCompare: () => void;
  waveViewMode: ViewMode;
  onWaveViewModeChange: (mode: ViewMode) => void;
  waveInteractMode: InteractMode;
  onWaveInteractModeChange: (mode: InteractMode) => void;
  getTelemetry: () => SynthTelemetry;
  onSelectSection: (section: SynthSectionKey) => void;
  onChange: (id: ParamID, value: number) => void;
  onClose: () => void;
}

const SECTION_TABS: { key: SynthSectionKey; title: string }[] = [
  { key: 'osc', title: 'Oscillators' },
  { key: 'filter', title: 'Ladder Filter' },
  { key: 'env', title: 'Envelopes' },
  { key: 'waveform', title: '3D Waveform' },
];

function WaveGlyph({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 20 12" className="w-3.5 h-2.5 shrink-0">
        <path d="M 1 9 L 6 2 L 14 10 L 19 3" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 20 12" className="w-3.5 h-2.5 shrink-0">
        <path d="M 1 10 L 9 2 L 9 10 L 18 2 L 18 10" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg viewBox="0 0 20 12" className="w-3.5 h-2.5 shrink-0">
        <path d="M 1 10 L 1 2 L 10 2 L 10 10 L 19 10 L 19 2" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 12" className="w-3.5 h-2.5 shrink-0">
      <path d="M 1 10 L 1 2 L 5.5 2 L 5.5 10 L 13 10 L 13 2 L 17.5 2 L 17.5 10" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function evalOscSample(waveIdx: number, phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (waveIdx === 0) return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
  if (waveIdx === 1) return p * 2 - 1;
  if (waveIdx === 2) return p < 0.5 ? 1 : -1;
  return p < 0.24 ? 1 : -1;
}

export const SynthDetailModal: React.FC<SynthDetailModalProps> = ({
  activeSection,
  params,
  envTab,
  onEnvTabChange,
  filterViewMode,
  onFilterViewModeChange,
  envViewMode,
  onEnvViewModeChange,
  envShowCompare,
  onToggleEnvCompare,
  waveViewMode,
  onWaveViewModeChange,
  waveInteractMode,
  onWaveInteractModeChange,
  getTelemetry,
  onSelectSection,
  onChange,
  onClose,
}) => {
  const oscCanvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ activeSection, params, getTelemetry });
  stateRef.current = { activeSection, params, getTelemetry };

  useEffect(() => {
    if (!activeSection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSection, onClose]);

  // 60fps Multi-Oscillator Composite + Live Audio OLED Scope when viewing Oscillators
  useEffect(() => {
    if (activeSection !== 'osc') return;
    const canvas = oscCanvasRef.current;
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
      const { params: p, getTelemetry: getTel } = stateRef.current;
      const tel = getTel();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(320, canvas.clientWidth);
      const ch = Math.max(160, canvas.clientHeight);
      if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
        canvas.width = Math.floor(cw * dpr);
        canvas.height = Math.floor(ch * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      const bg = ctx.createRadialGradient(cw * 0.5, ch * 0.45, 16, cw * 0.5, ch * 0.5, cw * 0.68);
      bg.addColorStop(0, '#132118');
      bg.addColorStop(1, '#050906');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);

      // Calibration grid
      ctx.strokeStyle = 'rgba(255, 240, 215, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const x = (i / 8) * cw;
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

      const midY = ch * 0.5;
      const oscDefs = [
        {
          wave: Math.round(p.OSC1_WAVE),
          range: Math.round(p.OSC1_RANGE),
          fine: p.FINE_TUNE,
          lvl: p.MIX_OSC1,
          color: 'rgba(251, 191, 36, 0.35)',
        },
        {
          wave: Math.round(p.OSC2_WAVE),
          range: Math.round(p.OSC2_RANGE),
          fine: p.OSC2_FREQ,
          lvl: p.MIX_OSC2,
          color: 'rgba(237, 228, 212, 0.3)',
        },
        {
          wave: Math.round(p.OSC3_WAVE),
          range: Math.round(p.OSC3_RANGE),
          fine: p.OSC3_FREQ,
          lvl: p.MIX_OSC3,
          color: 'rgba(110, 231, 183, 0.3)',
        },
      ];

      const steps = 200;
      // Draw individual osc ghost traces
      for (const osc of oscDefs) {
        if (osc.lvl <= 0.01) continue;
        const mult = Math.pow(2, osc.range - 1) * (1 + osc.fine * 0.0005);
        ctx.strokeStyle = osc.color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const s = evalOscSample(osc.wave, u * 2 * mult + t * (0.2 + osc.fine * 0.002)) * osc.lvl;
          const x = u * cw;
          const y = midY - s * (ch * 0.22);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw summed composite PolyBLEP + Noise waveform (or live audio when voices sound)
      ctx.save();
      ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.6;
      ctx.beginPath();

      if (tel.activeVoices > 0 && tel.waveform.length > 8) {
        const wf = tel.waveform;
        for (let i = 0; i < wf.length; i++) {
          const x = (i / (wf.length - 1)) * cw;
          const y = midY - wf[i] * (ch * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        const normDiv = Math.max(0.85, p.MIX_OSC1 + p.MIX_OSC2 + p.MIX_OSC3 + p.MIX_NOISE * 0.45);
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          let sum = 0;
          for (const osc of oscDefs) {
            const mult = Math.pow(2, osc.range - 1) * (1 + osc.fine * 0.0005);
            sum += evalOscSample(osc.wave, u * 2 * mult + t * (0.2 + osc.fine * 0.002)) * osc.lvl;
          }
          const pseudoNoise =
            Math.sin(i * 19.7 + t * 47.0) * Math.cos(i * 11.3 - t * 31.0) * p.MIX_NOISE * 0.65;
          const val = Math.tanh(((sum + pseudoNoise) / normDiv) * (1 + p.FILTER_DRIVE * 0.9));
          const x = u * cw;
          const y = midY - val * (ch * 0.34);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [activeSection]);

  if (!activeSection) return null;

  const oscConfigs: {
    num: 1 | 2 | 3;
    rangeId: ParamID;
    waveId: ParamID;
    fineId: ParamID;
    mixId: ParamID;
    accent: 'amber' | 'ivory' | 'copper';
  }[] = [
    { num: 1, rangeId: 'OSC1_RANGE', waveId: 'OSC1_WAVE', fineId: 'FINE_TUNE', mixId: 'MIX_OSC1', accent: 'amber' },
    { num: 2, rangeId: 'OSC2_RANGE', waveId: 'OSC2_WAVE', fineId: 'OSC2_FREQ', mixId: 'MIX_OSC2', accent: 'ivory' },
    { num: 3, rangeId: 'OSC3_RANGE', waveId: 'OSC3_WAVE', fineId: 'OSC3_FREQ', mixId: 'MIX_OSC3', accent: 'amber' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-6 bg-black/80"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Synth Module Detail View"
    >
      <div className="w-full max-w-[820px] max-h-[92vh] rounded-2xl beasty-card-3d border border-amber-500/45 shadow-[0_32px_90px_rgba(0,0,0,0.96)] overflow-hidden flex flex-col">
        {/* Top Modal Header: Section Switcher Tabs + Contextual Visualizer Mode Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-amber-500/20 bg-[#0b110d]">
          <div className="flex flex-wrap items-center gap-1">
            {SECTION_TABS.map((tab) => {
              const active = tab.key === activeSection;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onSelectSection(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide transition-colors ${
                    active
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/55'
                      : 'text-[#8fa192] hover:text-[#f4efe6] border border-transparent'
                  }`}
                >
                  {tab.title}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Contextual Visualizer Buttons Beside Header */}
            {activeSection === 'filter' && (
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#080c09] border border-amber-500/25">
                <button
                  type="button"
                  onClick={() => onFilterViewModeChange('spectrum')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    filterViewMode === 'spectrum'
                      ? 'bg-amber-500/25 text-amber-200'
                      : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                  }`}
                >
                  Spectrum
                </button>
                <button
                  type="button"
                  onClick={() => onFilterViewModeChange('harmonics')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    filterViewMode === 'harmonics'
                      ? 'bg-amber-500/25 text-amber-200'
                      : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                  }`}
                >
                  Harmonics
                </button>
              </div>
            )}

            {activeSection === 'env' && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-lg bg-[#080c09] border border-amber-500/25 p-0.5">
                  <button
                    type="button"
                    onClick={() => onEnvTabChange('filter')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                      envTab === 'filter'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-[#8fa192] hover:text-[#f4efe6]'
                    }`}
                  >
                    Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnvTabChange('amp')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                      envTab === 'amp'
                        ? 'bg-emerald-500/25 text-emerald-200'
                        : 'text-[#8fa192] hover:text-[#f4efe6]'
                    }`}
                  >
                    Amp
                  </button>
                </div>

                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#080c09] border border-white/[0.12]">
                  <button
                    type="button"
                    onClick={() => onEnvViewModeChange('stage')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      envViewMode === 'stage'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                    }`}
                  >
                    Stage
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnvViewModeChange('scope')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      envViewMode === 'scope'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                    }`}
                  >
                    Scope
                  </button>
                  <button
                    type="button"
                    onClick={onToggleEnvCompare}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      envShowCompare ? 'text-emerald-300' : 'text-[#6e7e71] hover:text-[#f4efe6]'
                    }`}
                  >
                    Cmp
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'waveform' && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#080c09] border border-amber-500/25">
                  <button
                    type="button"
                    onClick={() => onWaveInteractModeChange('sculpt')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      waveInteractMode === 'sculpt'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                    }`}
                  >
                    Sculpt
                  </button>
                  <button
                    type="button"
                    onClick={() => onWaveInteractModeChange('orbit')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      waveInteractMode === 'orbit'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                    }`}
                  >
                    Orbit
                  </button>
                </div>

                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#080c09] border border-white/[0.12]">
                  <button
                    type="button"
                    onClick={() => onWaveViewModeChange('waterfall')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      waveViewMode === 'waterfall'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                    }`}
                  >
                    Waterfall
                  </button>
                  <button
                    type="button"
                    onClick={() => onWaveViewModeChange('torus')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      waveViewMode === 'torus'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                    }`}
                  >
                    Ring
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail view"
              className="p-1.5 rounded-lg border border-white/[0.12] bg-[#121914] text-[#9aa89c] hover:text-[#f4efe6]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Large Interactive Visualizer + Compact Small Knobs Strip at Bottom */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto beasty-scroll">
          {activeSection === 'osc' && (
            <>
              <div className="recessed-screen rounded-xl h-[210px] overflow-hidden relative">
                <canvas ref={oscCanvasRef} className="w-full h-full block" />
                <div className="oled-scanlines absolute inset-0 pointer-events-none" aria-hidden="true" />
              </div>

              {/* Compact Osc Waveform & Octave Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {oscConfigs.map((osc) => {
                  const activeRange = Math.round(params[osc.rangeId]);
                  const activeWave = Math.round(params[osc.waveId]);
                  return (
                    <div
                      key={osc.num}
                      className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0a100c] border border-white/[0.08]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-[11px] font-black text-amber-300">
                          OSC {osc.num}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChange(osc.rangeId, (activeRange + 1) % RANGE_LABELS.length)}
                          className="px-1.5 py-0.5 rounded bg-[#080d09] border border-amber-500/35 text-[10px] font-mono-tabular font-bold text-[#f4efe6] hover:border-amber-400/75 leading-none"
                        >
                          {RANGE_LABELS[activeRange]}
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {WAVE_LABELS.map((wName, wIdx) => (
                          <button
                            key={wName}
                            type="button"
                            onClick={() => onChange(osc.waveId, wIdx)}
                            title={`Osc ${osc.num} ${wName}`}
                            className={`p-1 rounded border transition-colors ${
                              activeWave === wIdx
                                ? 'border-amber-400/65 bg-amber-500/22 text-amber-200'
                                : 'border-white/[0.08] bg-[#080c09] text-[#859488] hover:text-[#f4efe6]'
                            }`}
                          >
                            <WaveGlyph index={wIdx} />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Small Bottom Knobs Strip */}
              <div className="beasty-card-3d rounded-xl px-2.5 py-2 flex flex-wrap items-center justify-around gap-1.5">
                <RotaryKnob id="FINE_TUNE" value={params.FINE_TUNE} onChange={onChange} size="xxs" layout="inline" labelOverride="O1 Tune" accent="ivory" />
                <RotaryKnob id="MIX_OSC1" value={params.MIX_OSC1} onChange={onChange} size="xxs" layout="inline" labelOverride="O1 Lvl" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="OSC2_FREQ" value={params.OSC2_FREQ} onChange={onChange} size="xxs" layout="inline" labelOverride="O2 Tune" accent="ivory" />
                <RotaryKnob id="MIX_OSC2" value={params.MIX_OSC2} onChange={onChange} size="xxs" layout="inline" labelOverride="O2 Lvl" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="OSC3_FREQ" value={params.OSC3_FREQ} onChange={onChange} size="xxs" layout="inline" labelOverride="O3 Tune" accent="ivory" />
                <RotaryKnob id="MIX_OSC3" value={params.MIX_OSC3} onChange={onChange} size="xxs" layout="inline" labelOverride="O3 Lvl" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="MIX_NOISE" value={params.MIX_NOISE} onChange={onChange} size="xxs" layout="inline" labelOverride="Noise" accent="copper" />
              </div>
            </>
          )}

          {activeSection === 'filter' && (
            <>
              <FilterCurve
                cutoffHz={params.FILTER_CUTOFF}
                resonance={params.FILTER_RES}
                drive={params.FILTER_DRIVE}
                envAmount={params.FILTER_ENV}
                keytrack={params.FILTER_KEYTRACK}
                getTelemetry={getTelemetry}
                onChange={onChange}
                viewMode={filterViewMode}
                onViewModeChange={onFilterViewModeChange}
                hideControls
                heightClass="h-[250px]"
                viewHeight={250}
              />

              {/* Small Bottom Knobs Strip */}
              <div className="beasty-card-3d rounded-xl px-3 py-2 flex flex-wrap items-center justify-around gap-1.5">
                <RotaryKnob id="FILTER_CUTOFF" value={params.FILTER_CUTOFF} onChange={onChange} size="xxs" layout="inline" labelOverride="Cutoff" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="FILTER_RES" value={params.FILTER_RES} onChange={onChange} size="xxs" layout="inline" labelOverride="Res" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="FILTER_DRIVE" value={params.FILTER_DRIVE} onChange={onChange} size="xxs" layout="inline" labelOverride="Drive" accent="copper" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="FILTER_ENV" value={params.FILTER_ENV} onChange={onChange} size="xxs" layout="inline" labelOverride="Contour" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="FILTER_KEYTRACK" value={params.FILTER_KEYTRACK} onChange={onChange} size="xxs" layout="inline" labelOverride="Keytrack" accent="ivory" />
              </div>
            </>
          )}

          {activeSection === 'env' && (
            <>
              {envTab === 'filter' ? (
                <EnvelopeEditor
                  mode="filter"
                  attack={params.FENV_ATTACK}
                  decay={params.FENV_DECAY}
                  sustain={params.FENV_SUSTAIN}
                  release={params.FENV_RELEASE}
                  otherAttack={params.AENV_ATTACK}
                  otherDecay={params.AENV_DECAY}
                  otherSustain={params.AENV_SUSTAIN}
                  otherRelease={params.AENV_RELEASE}
                  getTelemetry={getTelemetry}
                  onChange={onChange}
                  accent="amber"
                  viewMode={envViewMode}
                  onViewModeChange={onEnvViewModeChange}
                  showCompare={envShowCompare}
                  onToggleCompare={onToggleEnvCompare}
                  hideControls
                  heightClass="h-[198px]"
                  viewHeight={198}
                />
              ) : (
                <EnvelopeEditor
                  mode="amp"
                  attack={params.AENV_ATTACK}
                  decay={params.AENV_DECAY}
                  sustain={params.AENV_SUSTAIN}
                  release={params.AENV_RELEASE}
                  otherAttack={params.FENV_ATTACK}
                  otherDecay={params.FENV_DECAY}
                  otherSustain={params.FENV_SUSTAIN}
                  otherRelease={params.FENV_RELEASE}
                  getTelemetry={getTelemetry}
                  onChange={onChange}
                  accent="ivory"
                  viewMode={envViewMode}
                  onViewModeChange={onEnvViewModeChange}
                  showCompare={envShowCompare}
                  onToggleCompare={onToggleEnvCompare}
                  hideControls
                  heightClass="h-[198px]"
                  viewHeight={198}
                />
              )}

              {/* Bearclaw ADSR Faders Tray in Zoomed-In View */}
              <div className="beasty-card-3d rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-around gap-3">
                {envTab === 'filter' ? (
                  <>
                    <FaderSlider id="FENV_ATTACK" value={params.FENV_ATTACK} onChange={onChange} height={82} labelOverride="Attack" />
                    <FaderSlider id="FENV_DECAY" value={params.FENV_DECAY} onChange={onChange} height={82} labelOverride="Decay" />
                    <FaderSlider id="FENV_SUSTAIN" value={params.FENV_SUSTAIN} onChange={onChange} height={82} labelOverride="Sustain" />
                    <FaderSlider id="FENV_RELEASE" value={params.FENV_RELEASE} onChange={onChange} height={82} labelOverride="Release" />
                    <div className="w-px h-16 bg-amber-500/15 hidden sm:block" />
                    <RotaryKnob id="FILTER_ENV" value={params.FILTER_ENV} onChange={onChange} size="xs" labelOverride="Depth" accent="copper" />
                  </>
                ) : (
                  <>
                    <FaderSlider id="AENV_ATTACK" value={params.AENV_ATTACK} onChange={onChange} height={82} labelOverride="Attack" accent="ivory" />
                    <FaderSlider id="AENV_DECAY" value={params.AENV_DECAY} onChange={onChange} height={82} labelOverride="Decay" accent="ivory" />
                    <FaderSlider id="AENV_SUSTAIN" value={params.AENV_SUSTAIN} onChange={onChange} height={82} labelOverride="Sustain" accent="ivory" />
                    <FaderSlider id="AENV_RELEASE" value={params.AENV_RELEASE} onChange={onChange} height={82} labelOverride="Release" accent="ivory" />
                    <div className="w-px h-16 bg-amber-500/15 hidden sm:block" />
                    <RotaryKnob id="MASTER_VOLUME" value={params.MASTER_VOLUME} onChange={onChange} size="xs" labelOverride="Master" />
                  </>
                )}
              </div>
            </>
          )}

          {activeSection === 'waveform' && (
            <>
              <div className="h-[260px] w-full flex">
                <Waveform3DVisualizer
                  params={params}
                  onChange={onChange}
                  getTelemetry={getTelemetry}
                  viewMode={waveViewMode}
                  onViewModeChange={onWaveViewModeChange}
                  interactMode={waveInteractMode}
                  onInteractModeChange={onWaveInteractModeChange}
                  hideControls
                  wide
                />
              </div>

              {/* Small Bottom Knobs Strip */}
              <div className="beasty-card-3d rounded-xl px-3 py-2 flex flex-wrap items-center justify-around gap-1.5">
                <RotaryKnob id="FILTER_CUTOFF" value={params.FILTER_CUTOFF} onChange={onChange} size="xxs" layout="inline" labelOverride="Cutoff" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="FILTER_RES" value={params.FILTER_RES} onChange={onChange} size="xxs" layout="inline" labelOverride="Res" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="FILTER_DRIVE" value={params.FILTER_DRIVE} onChange={onChange} size="xxs" layout="inline" labelOverride="Drive" accent="copper" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="ANALOG_DRIFT" value={params.ANALOG_DRIFT} onChange={onChange} size="xxs" layout="inline" labelOverride="Drift" accent="copper" />
                <div className="w-px h-5 bg-amber-500/15 hidden sm:block" />
                <RotaryKnob id="MASTER_VOLUME" value={params.MASTER_VOLUME} onChange={onChange} size="xxs" layout="inline" labelOverride="Master" accent="ivory" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
