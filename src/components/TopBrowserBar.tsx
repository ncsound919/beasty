import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Dices, Minus, Plus, RotateCcw, Search, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { ParamID, ParamState, SynthPreset, formatParamValue } from '../synth/parameters';

interface TopBrowserBarProps {
  presets: SynthPreset[];
  activePresetId: string;
  isDirty: boolean;
  audioReady: boolean;
  isJuceHosted: boolean;
  activeModCount: number;
  params: ParamState;
  onParamChange: (id: ParamID, value: number) => void;
  onSelectPreset: (preset: SynthPreset) => void;
  onOpenBrowser: () => void;
  onOpenModMatrix: () => void;
  onSavePreset: (name: string, category: SynthPreset['category']) => void;
  onResetInit: () => void;
  onRandomize: () => void;
  onToggleAudio: () => void;
  onPanic: () => void;
}

export const TopBrowserBar: React.FC<TopBrowserBarProps> = ({
  presets,
  activePresetId,
  isDirty,
  audioReady,
  isJuceHosted,
  activeModCount,
  params,
  onParamChange,
  onSelectPreset,
  onOpenBrowser,
  onOpenModMatrix,
  onSavePreset,
  onResetInit,
  onRandomize,
  onToggleAudio,
  onPanic,
}) => {
  const [saveOpen, setSaveOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<SynthPreset['category']>('User');
  const saveRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, presets.findIndex((p) => p.id === activePresetId));
  const activePreset = presets[activeIndex] ?? presets[0];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) {
        setSaveOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const stepPreset = (delta: number) => {
    const nextIdx = (activeIndex + delta + presets.length) % presets.length;
    onSelectPreset(presets[nextIdx]);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onSavePreset(trimmed, newCategory);
    setNewName('');
    setSaveOpen(false);
  };

  const transpose = Math.round(params.TRANSPOSE);
  const voices = Math.round(params.VOICE_COUNT);
  const masterPct = Math.round(params.MASTER_VOLUME * 100);

  return (
    <header className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-1.5 gap-y-1.5 px-2.5 py-1.5 border-b border-amber-500/20 bg-[#0c120e]/92">
      {/* Zone 1: Aggressive Scratchy Brand Wordmark + Claw Mark */}
      <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
        <svg viewBox="0 0 28 24" className="w-5 h-4 text-amber-400 shrink-0" aria-hidden="true">
          <path
            d="M 4 21 Q 10 11 16 3 M 11 22 Q 16 12 21 3 M 18 21 Q 22 14 26 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-scratch text-[19px] xl:text-[22px] tracking-wider leading-none bg-gradient-to-b from-amber-200 via-amber-400 to-orange-600 bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(245,158,11,0.38)]">
          BEASTY
        </span>
      </div>

      {/* Zone 2: Clean Single-Row Sound Browser + Save + Randomize + Init */}
      <div ref={saveRef} className="relative flex items-center gap-1 min-w-0">
        <div className="flex items-center rounded-lg border border-amber-500/35 bg-gradient-to-b from-[#0b130d] to-[#050906] p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9),0_1px_0_rgba(255,235,190,0.08)] min-w-0">
          <button
            type="button"
            onClick={() => stepPreset(-1)}
            aria-label="Previous sound"
            className="p-1 rounded text-[#b8c4b9] hover:text-amber-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenBrowser}
            title="Open Patch Matrix browser"
            className="flex items-center gap-1.5 px-2 py-0.5 w-[132px] sm:w-[164px] lg:w-[142px] xl:w-[196px] justify-between text-left rounded hover:bg-white/[0.05] transition-colors min-w-0"
          >
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#f4efe6] truncate min-w-0">
              <Search className="w-3.5 h-3.5 text-amber-400/85 shrink-0" />
              <span className="truncate">
                {activePreset?.name ?? 'Init Beasty'}
              </span>
              {isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.9)] shrink-0" title="Modified preset" />
              )}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8fa192] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => stepPreset(1)}
            aria-label="Next sound"
            className="p-1 rounded text-[#b8c4b9] hover:text-amber-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setSaveOpen((s) => !s);
            setNewName(isDirty ? `${activePreset?.name ?? 'Sound'} Mod` : '');
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-400/50 bg-amber-500/18 text-amber-200 hover:bg-amber-500/28 text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,235,190,0.2)] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3 h-3" />
          <span>Save</span>
        </button>

        <button
          type="button"
          onClick={onRandomize}
          title="Randomize synth patch"
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-400/45 bg-emerald-500/18 text-emerald-200 hover:bg-emerald-500/28 text-[11px] font-bold transition-colors whitespace-nowrap shrink-0"
        >
          <Dices className="w-3 h-3" />
          <span>Random</span>
        </button>

        <button
          type="button"
          onClick={onResetInit}
          title="Reset to Init Beasty"
          className="p-1 rounded-lg border border-white/[0.12] bg-[#121914] text-[#a6b4a8] hover:text-[#f4efe6] hover:border-amber-400/35 transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Save Sound Popover */}
        {saveOpen && (
          <form
            onSubmit={handleSaveSubmit}
            className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[310px] max-w-[calc(100vw-2rem)] rounded-xl border border-amber-500/35 bg-[#101812] shadow-2xl p-3.5 z-50 space-y-3"
          >
            <div className="text-xs font-semibold text-[#f4efe6]">Save New Sound</div>
            <input
              type="text"
              autoFocus
              maxLength={36}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Grizzly Cedar Bass"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070b08] border border-white/[0.14] text-xs text-[#f4efe6] placeholder:text-[#6e7d70] focus:outline-none focus:border-amber-500/60"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {(['Bass', 'Pluck', 'Lead', 'Pad', 'Keys', 'FX'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewCategory(cat)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      newCategory === cat
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                        : 'text-[#8fa192] hover:text-[#e2d9cb] border border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-[#120f0b] hover:bg-amber-400 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Zone 3: Header Performance & Output Controls (Transpose, Voices, Master Volume, Audio, Mod Matrix, Panic) */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0 max-w-full">
        {/* Transpose Stepper */}
        <div
          className="flex items-center rounded-lg border border-white/[0.12] bg-[#080c09] px-1 py-0.5 gap-0.5"
          title="Master Pitch Transpose (-24 to +24 semitones)"
        >
          <span className="text-[10px] font-medium text-[#8fa192] pr-0.5">Trans</span>
          <button
            type="button"
            onClick={() => onParamChange('TRANSPOSE', Math.max(-24, transpose - 1))}
            aria-label="Transpose down"
            className="p-0.5 rounded text-[#b5c2b6] hover:text-amber-300 hover:bg-white/[0.06]"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span
            onDoubleClick={() => onParamChange('TRANSPOSE', 0)}
            className="min-w-[32px] text-center text-[10.5px] font-mono-tabular font-semibold text-amber-200 cursor-pointer"
          >
            {formatParamValue('TRANSPOSE', transpose)}
          </span>
          <button
            type="button"
            onClick={() => onParamChange('TRANSPOSE', Math.min(24, transpose + 1))}
            aria-label="Transpose up"
            className="p-0.5 rounded text-[#b5c2b6] hover:text-amber-300 hover:bg-white/[0.06]"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Polyphony Voices Stepper */}
        <div
          className="flex items-center rounded-lg border border-white/[0.12] bg-[#080c09] px-1 py-0.5 gap-0.5"
          title="Active Synth Voice Polyphony (Mono to 8 Voices)"
        >
          <span className="text-[10px] font-medium text-[#8fa192] pr-0.5">Voices</span>
          <button
            type="button"
            onClick={() => onParamChange('VOICE_COUNT', Math.max(1, voices - 1))}
            aria-label="Decrease voices"
            className="p-0.5 rounded text-[#b5c2b6] hover:text-amber-300 hover:bg-white/[0.06]"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="min-w-[34px] text-center text-[10.5px] font-mono-tabular font-semibold text-[#f4efe6]">
            {voices === 1 ? 'Mono' : `${voices}v`}
          </span>
          <button
            type="button"
            onClick={() => onParamChange('VOICE_COUNT', Math.min(8, voices + 1))}
            aria-label="Increase voices"
            className="p-0.5 rounded text-[#b5c2b6] hover:text-amber-300 hover:bg-white/[0.06]"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Master Volume Slider Control */}
        <label
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-[#080c09] px-2 py-1 cursor-pointer"
          title={`Master Volume: ${masterPct}%`}
        >
          <span className="text-[10px] font-medium text-[#98a69a]">Master</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={params.MASTER_VOLUME}
            onChange={(e) => onParamChange('MASTER_VOLUME', parseFloat(e.target.value))}
            aria-label="Master Volume"
            className="w-12 xl:w-14 h-1.5 appearance-none rounded-full bg-[#1a241d] border border-white/[0.08] cursor-pointer accent-amber-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-b [&::-webkit-slider-thumb]:from-amber-200 [&::-webkit-slider-thumb]:to-amber-500 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-amber-100/60 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(251,191,36,0.75)]"
          />
          <span className="text-[10.5px] font-mono-tabular font-semibold text-amber-300 min-w-[28px] text-right">
            {masterPct}%
          </span>
        </label>

        {!isJuceHosted && (
          <button
            type="button"
            onClick={onToggleAudio}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              audioReady
                ? 'border-amber-500/25 bg-[#121914] text-[#e5ddd0] hover:border-amber-400/50'
                : 'border-amber-400 bg-amber-500 text-[#120f0b] hover:bg-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
            }`}
          >
            {audioReady ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{audioReady ? 'Audio' : 'Enable'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenModMatrix}
          title="Open Mod Matrix & Pattern Presets"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeModCount > 0
              ? 'border-amber-400/55 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.18)]'
              : 'border-white/[0.12] bg-[#121914] text-[#b5c2b6] hover:text-[#f4efe6] hover:border-amber-400/35'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span>Mod{activeModCount > 0 ? ` · ${activeModCount}` : ''}</span>
        </button>

        <button
          type="button"
          onClick={onPanic}
          className="px-2 py-1 rounded-lg border border-white/[0.12] bg-[#121914] text-[11px] font-medium text-[#b5c2b6] hover:text-red-200 hover:border-red-400/50 hover:bg-red-500/10 transition-colors whitespace-nowrap shrink-0"
          title="Stop all sounding notes"
        >
          Panic
        </button>
      </div>
    </header>
  );
};
