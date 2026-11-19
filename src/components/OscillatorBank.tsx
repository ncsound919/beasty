import React from 'react';
import { Maximize2 } from 'lucide-react';
import { ParamID, ParamState, RANGE_LABELS, WAVE_LABELS } from '../synth/parameters';
import { FaderSlider } from './FaderSlider';
import { RotaryKnob } from './RotaryKnob';

interface OscillatorBankProps {
  params: ParamState;
  onChange: (id: ParamID, value: number) => void;
  onOpenDetail?: () => void;
}

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

function buildMiniWavePath(waveIdx: number, level: number, cycles: number): string {
  const W = 120;
  const H = 28;
  const mid = H / 2;
  const amp = Math.max(2, level * 10.5);
  const pts: string[] = [];
  const steps = 64;

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const ph = (u * cycles) % 1;
    let yVal = 0;
    if (waveIdx === 0) {
      yVal = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
    } else if (waveIdx === 1) {
      yVal = ph * 2 - 1;
    } else if (waveIdx === 2) {
      yVal = ph < 0.5 ? 1 : -1;
    } else {
      yVal = ph < 0.24 ? 1 : -1;
    }
    const x = u * W;
    const y = mid - yVal * amp;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export const OscillatorBank: React.FC<OscillatorBankProps> = ({ params, onChange, onOpenDetail }) => {
  const oscConfigs: {
    num: 1 | 2 | 3;
    rangeId: ParamID;
    waveId: ParamID;
    fineId: ParamID;
    mixId: ParamID;
  }[] = [
    { num: 1, rangeId: 'OSC1_RANGE', waveId: 'OSC1_WAVE', fineId: 'FINE_TUNE', mixId: 'MIX_OSC1' },
    { num: 2, rangeId: 'OSC2_RANGE', waveId: 'OSC2_WAVE', fineId: 'OSC2_FREQ', mixId: 'MIX_OSC2' },
    { num: 3, rangeId: 'OSC3_RANGE', waveId: 'OSC3_WAVE', fineId: 'OSC3_FREQ', mixId: 'MIX_OSC3' },
  ];

  return (
    <div className="flex flex-col justify-between h-full">
      <div
        onClick={onOpenDetail}
        role={onOpenDetail ? 'button' : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        onKeyDown={(e) => {
          if (onOpenDetail && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpenDetail();
          }
        }}
        title="Click to open large Oscillators view"
        className={`flex items-center justify-between h-[20px] mb-1 shrink-0 group ${
          onOpenDetail ? 'cursor-pointer' : ''
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]" />
          <h2 className="font-display text-[12.5px] font-bold tracking-[0.06em] text-[#f4efe6] group-hover:text-amber-200 uppercase leading-none transition-colors">
            Oscillators
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono-tabular text-[#98a69a] group-hover:text-amber-200 transition-colors">
          <span>3 × PolyBLEP · Noise</span>
          {onOpenDetail && <Maximize2 className="w-3 h-3 text-[#8fa192] group-hover:text-amber-300" />}
        </div>
      </div>

      {/* Synchronized Compact Osc Cards + Skinny Bearclaw Noise Fader */}
      <div className="flex flex-col sm:flex-row items-stretch gap-1.5 flex-1 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 flex-1 min-w-0">
          {oscConfigs.map((osc) => {
            const activeRange = Math.round(params[osc.rangeId]);
            const activeWave = Math.round(params[osc.waveId]);
            const level = params[osc.mixId];
            const cycles = Math.min(4, Math.max(1.5, 1.5 + activeRange * 0.55));
            const wavePath = buildMiniWavePath(activeWave, level, cycles);

            const cycleRange = (e: React.MouseEvent) => {
              e.stopPropagation();
              onChange(osc.rangeId, (activeRange + 1) % RANGE_LABELS.length);
            };

            return (
              <div
                key={osc.num}
                onClick={onOpenDetail}
                title="Click card frame to expand Oscillators view"
                className="h-full flex flex-col justify-between p-1.5 rounded-xl beasty-card-3d hover:border-amber-400/45 min-w-0 cursor-pointer transition-colors gap-1 sm:gap-0"
              >
                {/* Header: Bold OSC Badge + Range Switch */}
                <div className="flex items-center justify-between gap-1">
                  <span className="font-display text-[11.5px] font-black tracking-wide text-amber-300 whitespace-nowrap leading-none">
                    OSC {osc.num}
                  </span>
                  <button
                    type="button"
                    onClick={cycleRange}
                    title={`Osc ${osc.num} Range: ${RANGE_LABELS[activeRange]} (Click to step octave)`}
                    className="px-1.5 py-0.5 rounded bg-[#080d09] border border-amber-500/35 text-[10px] font-mono-tabular font-bold text-[#f4efe6] hover:border-amber-400/75 hover:text-amber-200 transition-colors leading-none"
                  >
                    {RANGE_LABELS[activeRange]}
                  </button>
                </div>

                {/* Compact Mini OLED Wave Preview */}
                <div className="recessed-screen rounded-md h-[20px] px-1 overflow-hidden relative flex items-center">
                  <div className="oled-scanlines absolute inset-0 pointer-events-none" aria-hidden="true" />
                  <svg viewBox="0 0 120 28" className="w-full h-full block relative z-10">
                    <line x1="0" y1="14" x2="120" y2="14" stroke="rgba(255,240,215,0.08)" strokeWidth="1" />
                    <path
                      d={wavePath}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="1.9"
                      strokeLinejoin="round"
                      style={{ filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.55))' }}
                    />
                  </svg>
                </div>

                {/* Single-Row Symbol-Only Wave Selector Buttons */}
                <div className="grid grid-cols-4 gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {WAVE_LABELS.map((wName, wIdx) => (
                    <button
                      key={wName}
                      type="button"
                      onClick={() => onChange(osc.waveId, wIdx)}
                      title={`Osc ${osc.num} ${wName}`}
                      aria-label={`Osc ${osc.num} ${wName}`}
                      className={`flex items-center justify-center py-0.5 rounded border transition-colors ${
                        activeWave === wIdx
                          ? 'border-amber-400/65 bg-amber-500/22 text-amber-200 shadow-[inset_0_1px_0_rgba(255,235,190,0.2)]'
                          : 'border-white/[0.08] bg-[#0a0f0b] text-[#859488] hover:text-[#f4efe6] hover:border-white/20'
                      }`}
                    >
                      <WaveGlyph index={wIdx} />
                    </button>
                  ))}
                </div>

                {/* Matching Dual Knobs Across Osc 1, 2 & 3 */}
                <div className="flex items-center justify-around gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <RotaryKnob
                    id={osc.fineId}
                    value={params[osc.fineId]}
                    onChange={onChange}
                    size="xxs"
                    labelOverride="Tune"
                    accent="ivory"
                  />
                  <RotaryKnob
                    id={osc.mixId}
                    value={params[osc.mixId]}
                    onChange={onChange}
                    size="xxs"
                    labelOverride="Level"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Skinnier Bearclaw Noise Fader Card */}
        <div
          onClick={onOpenDetail}
          className="flex flex-col items-center justify-center px-1.5 py-1.5 sm:py-1 rounded-xl beasty-card-3d hover:border-amber-400/45 shrink-0 cursor-pointer transition-colors"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <FaderSlider
              id="MIX_NOISE"
              value={params.MIX_NOISE}
              onChange={onChange}
              height={106}
              narrow
              labelOverride="Noise"
              accent="ivory"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
