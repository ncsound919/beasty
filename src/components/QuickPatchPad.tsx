import React from 'react';
import { QUICK_START_PRESETS, SynthPreset } from '../synth/parameters';

interface QuickPatchPadProps {
  activePresetId: string;
  onSelect: (preset: SynthPreset) => void;
}

export const QuickPatchPad: React.FC<QuickPatchPadProps> = ({ activePresetId, onSelect }) => {
  return (
    <div className="flex flex-col justify-center gap-1.5 w-full max-w-[500px] mx-auto">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]" />
          <span className="font-display text-[11px] font-bold tracking-[0.06em] text-[#f4efe6] uppercase leading-none">
            Quick Starters
          </span>
        </div>
        <span className="text-[9.5px] font-mono-tabular text-[#8f9f92]">3 Bass · 1 Pluck · 2 Lead · 2 Pad</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {QUICK_START_PRESETS.map((preset) => {
          const active = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset)}
              title={`${preset.category}: ${preset.name}`}
              className={`group relative flex flex-col justify-between px-2 py-1 rounded-lg text-left transition-all duration-150 h-[42px] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                active
                  ? 'bg-gradient-to-b from-amber-500/28 to-amber-950/40 border border-amber-400/75 shadow-[inset_0_1px_0_rgba(255,235,190,0.34),0_2px_10px_rgba(245,158,11,0.24)]'
                  : 'beasty-card-3d hover:border-amber-400/45 active:translate-y-px'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="flex items-center gap-1 text-[8px] font-mono-tabular font-bold text-[#95a497] uppercase tracking-[0.08em] leading-none">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      preset.category === 'Bass'
                        ? 'bg-amber-400/85'
                        : preset.category === 'Pluck'
                          ? 'bg-emerald-300/85'
                          : preset.category === 'Lead'
                            ? 'bg-orange-400/85'
                            : 'bg-sky-300/85'
                    }`}
                  />
                  {preset.category}
                </span>
                <span
                  className={`w-3 h-[2.5px] rounded-full transition-colors ${
                    active
                      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.95)]'
                      : 'bg-[#1f2921] group-hover:bg-amber-500/45'
                  }`}
                />
              </div>
              <span
                className={`text-[10.5px] font-bold truncate leading-tight w-full ${
                  active ? 'text-amber-100' : 'text-[#efe8dc] group-hover:text-amber-200'
                }`}
              >
                {preset.shortLabel ?? preset.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
