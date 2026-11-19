import React, { useMemo } from 'react';
import { Maximize2 } from 'lucide-react';
import { CLASSIC_FILTER_LABELS, ParamID, ParamState } from '../synth/parameters';
import { EffectKey } from './EffectDetailModal';
import { RotaryKnob } from './RotaryKnob';

interface EffectsRackProps {
  params: ParamState;
  onChange: (id: ParamID, value: number) => void;
  onOpenEffect: (key: EffectKey) => void;
}

interface EffectCardDef {
  key: EffectKey;
  title: string;
  toggleId: ParamID;
  knobA: ParamID;
  knobB: ParamID;
  accent: 'amber' | 'copper' | 'ivory';
}

const EFFECTS: EffectCardDef[] = [
  { key: 'delay', title: 'Delay', toggleId: 'FX_DELAY_ON', knobA: 'FX_DELAY_MIX', knobB: 'FX_DELAY_TIME', accent: 'amber' },
  { key: 'reverb', title: 'Reverb', toggleId: 'FX_REVERB_ON', knobA: 'FX_REVERB_MIX', knobB: 'FX_REVERB_SIZE', accent: 'ivory' },
  { key: 'phaser', title: 'Phaser', toggleId: 'FX_PHASER_ON', knobA: 'FX_PHASER_MIX', knobB: 'FX_PHASER_RATE', accent: 'amber' },
  { key: 'flanger', title: 'Flanger', toggleId: 'FX_FLANGER_ON', knobA: 'FX_FLANGER_MIX', knobB: 'FX_FLANGER_DEPTH', accent: 'ivory' },
  { key: 'sat', title: 'Saturation', toggleId: 'FX_SAT_ON', knobA: 'FX_SAT_DRIVE', knobB: 'FX_SAT_TONE', accent: 'copper' },
];

export const EffectsRack: React.FC<EffectsRackProps> = ({ params, onChange, onOpenEffect }) => {
  const filterTypeIdx = Math.round(params.FX_FILTER_TYPE);
  const filterEnabled = params.FX_FILTER_ON >= 0.5;

  const miniFilterPath = useMemo(() => {
    const W = 100;
    const H = 30;
    const cut = params.FX_FILTER_CUTOFF;
    const lpCut = params.FX_FILTER_LP;
    const hpCut = params.FX_FILTER_HP;
    const res = params.FX_FILTER_RES;
    const logMin = Math.log10(25);
    const logMax = Math.log10(18000);
    const pts: string[] = [];

    for (let i = 0; i <= 36; i++) {
      const u = i / 36;
      const hz = Math.pow(10, logMin + u * (logMax - logMin));
      const hpMag = 1 / Math.sqrt(1 + Math.pow(Math.max(20, hpCut) / Math.max(15, hz), 4));
      const lpMag = 1 / Math.sqrt(1 + Math.pow(hz / Math.max(60, lpCut), 4));
      const ratio = hz / Math.max(40, cut);
      let charMag = 0.78;
      if (filterTypeIdx === 4) {
        const inv = 1 / Math.max(0.05, ratio);
        charMag =
          (1 / Math.sqrt(1 + Math.pow(inv, 4))) * 0.78 +
          res * 0.28 * Math.exp(-Math.pow(Math.log2(Math.max(0.05, ratio)) * 3.5, 2));
      } else if (filterTypeIdx === 3) {
        const lp = 1 / Math.sqrt(1 + Math.pow(ratio, 4));
        const hp = 1 / Math.sqrt(1 + Math.pow(0.22 / Math.max(0.02, ratio), 2));
        charMag =
          lp * hp * 0.8 +
          res * 0.42 * Math.exp(-Math.pow(Math.log2(Math.max(0.05, ratio)) * 4.2, 2));
      } else {
        const poles = filterTypeIdx === 2 ? 2 : filterTypeIdx === 1 ? 3 : 4;
        const lp = 1 / Math.sqrt(Math.pow(1 + ratio * ratio, poles));
        charMag =
          lp * 0.78 +
          res * 0.36 * Math.exp(-Math.pow(Math.log2(Math.max(0.05, ratio)) * 3.8, 2));
      }
      const mag = charMag * hpMag * lpMag;
      const x = u * W;
      const y = H - 3 - Math.min(1.04, Math.max(0.03, mag)) * (H - 8);
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [filterTypeIdx, params.FX_FILTER_CUTOFF, params.FX_FILTER_HP, params.FX_FILTER_LP, params.FX_FILTER_RES]);

  return (
    <section
      aria-label="Master Effects Rack"
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 px-3 pb-2 items-stretch"
    >
      {EFFECTS.map((fx) => {
        const enabled = params[fx.toggleId] >= 0.5;
        return (
          <div
            key={fx.key}
            onClick={() => onOpenEffect(fx.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenEffect(fx.key);
              }
            }}
            title={`Click to open ${fx.title} detailed rack`}
            className={`h-[70px] rounded-xl px-2 py-1 flex flex-col justify-between cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              enabled
                ? 'beasty-card-3d border-amber-400/55 shadow-[inset_0_1px_0_rgba(255,235,190,0.22),0_4px_14px_rgba(245,158,11,0.14)] hover:border-amber-300/75'
                : 'beasty-card-3d opacity-85 hover:opacity-100 hover:border-amber-400/40'
            }`}
          >
            <div className="flex items-center justify-between gap-1 pb-0.5 border-b border-white/[0.06]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(fx.toggleId, enabled ? 0 : 1);
                }}
                aria-pressed={enabled}
                className="flex items-center gap-1.5 text-left group focus:outline-none min-w-0"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                    enabled
                      ? fx.accent === 'copper'
                        ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.95)]'
                        : fx.accent === 'ivory'
                          ? 'bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.95)]'
                          : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.95)]'
                      : 'bg-[#253228] border border-white/15'
                  }`}
                />
                <span
                  className={`font-display text-[10.5px] font-bold tracking-[0.05em] uppercase leading-none truncate ${
                    enabled ? 'text-[#f6efe2]' : 'text-[#9aa89c]'
                  }`}
                >
                  {fx.title}
                </span>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(fx.toggleId, enabled ? 0 : 1);
                  }}
                  className={`px-1 py-0.5 rounded text-[8.5px] font-mono-tabular font-semibold border leading-none transition-colors ${
                    enabled
                      ? 'border-amber-400/55 bg-amber-500/20 text-amber-200'
                      : 'border-white/[0.1] bg-[#080c09] text-[#7f8f82] hover:text-[#e2d9cb]'
                  }`}
                >
                  {enabled ? 'ON' : 'BYP'}
                </button>
                <Maximize2 className="w-2.5 h-2.5 text-[#7f8f82]" />
              </div>
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center justify-around gap-1 transition-opacity ${
                enabled ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <RotaryKnob id={fx.knobA} value={params[fx.knobA]} onChange={onChange} size="xxs" layout="inline" accent={fx.accent} />
              <div className="w-px h-5 bg-amber-500/15 shrink-0" aria-hidden="true" />
              <RotaryKnob id={fx.knobB} value={params[fx.knobB]} onChange={onChange} size="xxs" layout="inline" accent={fx.accent} />
            </div>
          </div>
        );
      })}

      {/* 6th Card: Slim Classic Synth Filter FX with Model Switcher + Curve + Inline LP & HP Knobs */}
      <div
        onClick={() => onOpenEffect('filter')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenEffect('filter');
          }
        }}
        title="Click to open Classic Synth Filter FX detailed rack"
        className={`h-[70px] rounded-xl px-2 py-1 flex flex-col justify-between cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          filterEnabled
            ? 'beasty-card-3d border-amber-400/55 shadow-[inset_0_1px_0_rgba(255,235,190,0.22),0_4px_14px_rgba(245,158,11,0.14)] hover:border-amber-300/75'
            : 'beasty-card-3d opacity-85 hover:opacity-100 hover:border-amber-400/40'
        }`}
      >
        <div className="flex items-center justify-between gap-1 pb-0.5 border-b border-white/[0.06]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('FX_FILTER_ON', filterEnabled ? 0 : 1);
            }}
            aria-pressed={filterEnabled}
            className="flex items-center gap-1 text-left focus:outline-none shrink-0"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                filterEnabled
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.95)]'
                  : 'bg-[#253228] border border-white/15'
              }`}
            />
            <span className={`font-display text-[10.5px] font-bold tracking-[0.04em] uppercase leading-none ${filterEnabled ? 'text-[#f6efe2]' : 'text-[#9aa89c]'}`}>
              Filter FX
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('FX_FILTER_TYPE', (filterTypeIdx + 1) % CLASSIC_FILTER_LABELS.length);
            }}
            title="Click to cycle classic synth filter models"
            className="px-1 py-0.5 rounded bg-[#080c09] border border-amber-500/30 text-[8.5px] font-semibold text-amber-200 hover:border-amber-400/70 truncate leading-none min-w-0"
          >
            {CLASSIC_FILTER_LABELS[filterTypeIdx]}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('FX_FILTER_ON', filterEnabled ? 0 : 1);
              }}
              className={`px-1 py-0.5 rounded text-[8.5px] font-mono-tabular font-semibold border leading-none transition-colors ${
                filterEnabled
                  ? 'border-amber-400/55 bg-amber-500/20 text-amber-200'
                  : 'border-white/[0.1] bg-[#080c09] text-[#7f8f82] hover:text-[#e2d9cb]'
              }`}
            >
              {filterEnabled ? 'ON' : 'BYP'}
            </button>
            <Maximize2 className="w-2.5 h-2.5 text-[#7f8f82]" />
          </div>
        </div>

        {/* Mini Filter Curve + Inline LP & HP Knobs */}
        <div className="flex items-center justify-between gap-1">
          <div className="recessed-screen rounded w-[36px] h-[28px] overflow-hidden px-0.5 shrink-0 relative sm:block lg:hidden xl:block">
            <div className="oled-scanlines absolute inset-0 pointer-events-none" aria-hidden="true" />
            <svg viewBox="0 0 100 30" className="w-full h-full block relative z-10">
              <path
                d={miniFilterPath}
                fill="none"
                stroke={filterTypeIdx === 1 ? '#a3e635' : filterTypeIdx === 3 ? '#fb923c' : '#fbbf24'}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center justify-around gap-1 flex-1 min-w-0 transition-opacity ${
              filterEnabled ? 'opacity-100' : 'opacity-70'
            }`}
          >
            <RotaryKnob
              id="FX_FILTER_LP"
              value={params.FX_FILTER_LP}
              onChange={onChange}
              size="xxs"
              layout="inline"
              accent="amber"
            />
            <div className="w-px h-5 bg-amber-500/15 shrink-0" aria-hidden="true" />
            <RotaryKnob
              id="FX_FILTER_HP"
              value={params.FX_FILTER_HP}
              onChange={onChange}
              size="xxs"
              layout="inline"
              accent="ivory"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
