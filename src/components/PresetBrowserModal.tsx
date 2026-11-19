import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Folder, Search, Star, Trash2, X } from 'lucide-react';
import {
  BrowserTag,
  CLASSIC_FILTER_LABELS,
  QUICK_START_PRESETS,
  SynthPreset,
  formatParamValue,
} from '../synth/parameters';

interface PresetBrowserModalProps {
  open: boolean;
  presets: SynthPreset[];
  activePresetId: string;
  favoriteIds: string[];
  onClose: () => void;
  onSelectPreset: (preset: SynthPreset) => void;
  onToggleFavorite: (id: string) => void;
  onDeletePreset: (id: string) => void;
}

type FolderKey = 'All' | 'Starters' | 'Bass' | 'Pluck' | 'Lead' | 'Pad' | 'Keys' | 'FX' | 'User' | 'Favorites';
type SortMode = 'curated' | 'name' | 'cutoff';

const ALL_TAGS: BrowserTag[] = ['Sub', 'Acid', 'Warm', 'Bright', 'Space', 'Mono', 'Poly', 'Fat', 'FX'];
const STARTER_IDS = new Set(QUICK_START_PRESETS.map((p) => p.id));

function deriveTags(p: SynthPreset): BrowserTag[] {
  const tags = new Set<BrowserTag>(p.tags ?? []);
  if (p.tone) tags.add(p.tone);
  if ((p.params.VOICE_COUNT ?? 8) <= 1) tags.add('Mono');
  else tags.add('Poly');
  if (
    p.params.FX_DELAY_ON >= 0.5 ||
    p.params.FX_REVERB_ON >= 0.5 ||
    p.params.FX_PHASER_ON >= 0.5 ||
    p.params.FX_FLANGER_ON >= 0.5 ||
    p.params.FX_SAT_ON >= 0.5 ||
    p.params.FX_FILTER_ON >= 0.5
  ) {
    tags.add('FX');
  }
  return Array.from(tags);
}

function evalOscSample(wave: number, phase: number): number {
  const ph = ((phase % 1) + 1) % 1;
  if (wave === 0) return ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
  if (wave === 1) return ph * 2 - 1;
  if (wave === 2) return ph < 0.5 ? 1 : -1;
  return ph < 0.24 ? 1 : -1;
}

function buildPatchWaveformSvg(preset: SynthPreset): { line: string; fill: string; envLine: string; stroke: string } {
  const W = 200;
  const H = 64;
  const mid = H * 0.52;
  const p = preset.params;

  const w1 = Math.round(p.OSC1_WAVE);
  const w2 = Math.round(p.OSC2_WAVE);
  const w3 = Math.round(p.OSC3_WAVE);
  const r1 = Math.pow(2, Math.max(-1, Math.round(p.OSC1_RANGE) - 1));
  const r2 = Math.pow(2, Math.max(-1, Math.round(p.OSC2_RANGE) - 1)) * (1 + (p.OSC2_FREQ ?? 0) * 0.004);
  const r3 = Math.pow(2, Math.max(-1, Math.round(p.OSC3_RANGE) - 1)) * (1 + (p.OSC3_FREQ ?? 0) * 0.004);
  const m1 = p.MIX_OSC1 ?? 0.8;
  const m2 = p.MIX_OSC2 ?? 0.5;
  const m3 = p.MIX_OSC3 ?? 0.3;
  const mN = p.MIX_NOISE ?? 0;

  const cutNorm = Math.min(1, Math.max(0.06, Math.log10(Math.max(40, p.FILTER_CUTOFF ?? 1200) / 30) / 2.8));
  const res = p.FILTER_RES ?? 0.2;
  const drive = Math.min(1, (p.FILTER_DRIVE ?? 0.3) + (p.FX_SAT_ON >= 0.5 ? (p.FX_SAT_DRIVE ?? 0) * 0.45 : 0));

  const N = 112;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2.2;
    const s1 = evalOscSample(w1, u * r1) * m1;
    const s2 = evalOscSample(w2, u * r2 + 0.12) * m2;
    const s3 = evalOscSample(w3, u * r3 + 0.27) * m3;
    const n = (Math.sin(i * 19.37) * Math.cos(i * 7.13)) * mN * 0.55;
    let v = (s1 + s2 + s3 + n) / Math.max(0.8, m1 + m2 + m3 + 0.2);
    // Soft saturation waveshaper
    v = Math.tanh(v * (1.1 + drive * 2.4));
    raw[i] = v;
  }

  // Single-pole ladder smoothing + resonant ring approximation
  const lpAlpha = Math.min(0.92, 0.14 + cutNorm * 0.78);
  let y1 = raw[0];
  let y2 = raw[0];
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    y1 += (raw[i] - y1) * lpAlpha;
    y2 += (y1 - y2) * lpAlpha;
    const ring = res > 0.25 ? Math.sin((i / N) * Math.PI * (8 + cutNorm * 10)) * (res - 0.2) * 0.26 * (1 - i / (N * 1.15)) : 0;
    const sample = Math.max(-1.05, Math.min(1.05, y2 * 1.15 + ring));
    const px = (i / (N - 1)) * W;
    const py = mid - sample * (H * 0.36);
    pts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
  }

  // Subtle amp envelope contour silhouette across the background
  const atk = Math.min(0.45, Math.max(0.03, (p.AENV_ATTACK ?? 0.01) / 2.2));
  const dec = Math.min(0.4, Math.max(0.08, (p.AENV_DECAY ?? 0.3) / 3.5));
  const sus = Math.min(1, Math.max(0.08, p.AENV_SUSTAIN ?? 0.8));
  const ex1 = atk * W;
  const ex2 = Math.min(W * 0.82, ex1 + dec * W);
  const eyPeak = 8;
  const eySus = H - 8 - sus * (H - 18);
  const envLine = `M 0,${H - 6} L ${ex1.toFixed(1)},${eyPeak} L ${ex2.toFixed(1)},${eySus.toFixed(1)} L ${(W * 0.85).toFixed(1)},${eySus.toFixed(1)} L ${W},${H - 6}`;

  const line = pts.join(' ');
  const fill = `${line} L ${W},${mid} L 0,${mid} Z`;
  const stroke = preset.tone === 'Acid' || drive > 0.65 ? '#fb923c' : preset.tone === 'Space' ? '#6ee7b7' : '#fbbf24';
  return { line, fill, envLine, stroke };
}

export const PresetBrowserModal: React.FC<PresetBrowserModalProps> = ({
  open,
  presets,
  activePresetId,
  favoriteIds,
  onClose,
  onSelectPreset,
  onToggleFavorite,
  onDeletePreset,
}) => {
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<FolderKey>('All');
  const [selectedTags, setSelectedTags] = useState<BrowserTag[]>([]);
  const [sortBy, setSortBy] = useState<SortMode>('curated');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const folderCounts = useMemo(() => {
    const counts: Record<FolderKey, number> = {
      All: presets.length,
      Starters: 0,
      Bass: 0,
      Pluck: 0,
      Lead: 0,
      Pad: 0,
      Keys: 0,
      FX: 0,
      User: 0,
      Favorites: 0,
    };
    for (const p of presets) {
      if (STARTER_IDS.has(p.id)) counts.Starters++;
      if (!p.isFactory) counts.User++;
      if (favSet.has(p.id)) counts.Favorites++;
      if (p.category === 'Bass') counts.Bass++;
      else if (p.category === 'Pluck') counts.Pluck++;
      else if (p.category === 'Lead') counts.Lead++;
      else if (p.category === 'Pad') counts.Pad++;
      else if (p.category === 'Keys') counts.Keys++;
      else if (p.category === 'FX') counts.FX++;
    }
    return counts;
  }, [favSet, presets]);

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = presets.filter((p) => {
      if (folder === 'Starters' && !STARTER_IDS.has(p.id)) return false;
      if (folder === 'User' && p.isFactory) return false;
      if (folder === 'Favorites' && !favSet.has(p.id)) return false;
      if (
        folder !== 'All' &&
        folder !== 'Starters' &&
        folder !== 'User' &&
        folder !== 'Favorites' &&
        p.category !== folder
      ) {
        return false;
      }

      const pTags = deriveTags(p);
      if (selectedTags.length > 0 && !selectedTags.every((t) => pTags.includes(t))) {
        return false;
      }

      if (q) {
        const hay = `${p.name} ${p.category} ${p.tone ?? ''} ${pTags.join(' ')} ${p.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list].sort((a, b) => {
      const aFav = favSet.has(a.id) ? 1 : 0;
      const bFav = favSet.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'cutoff') return (b.params.FILTER_CUTOFF ?? 0) - (a.params.FILTER_CUTOFF ?? 0);
      return 0;
    });
    return sorted;
  }, [favSet, folder, presets, query, selectedTags, sortBy]);

  const inspectedPreset = useMemo(
    () =>
      filteredPresets.find((p) => p.id === activePresetId) ??
      presets.find((p) => p.id === activePresetId) ??
      filteredPresets[0] ??
      presets[0],
    [activePresetId, filteredPresets, presets],
  );

  const inspectedTags = inspectedPreset ? deriveTags(inspectedPreset) : [];
  const inspectedFxList = inspectedPreset
    ? [
        inspectedPreset.params.FX_DELAY_ON >= 0.5 ? 'Delay' : null,
        inspectedPreset.params.FX_REVERB_ON >= 0.5 ? 'Reverb' : null,
        inspectedPreset.params.FX_PHASER_ON >= 0.5 ? 'Phaser' : null,
        inspectedPreset.params.FX_FLANGER_ON >= 0.5 ? 'Flanger' : null,
        inspectedPreset.params.FX_SAT_ON >= 0.5 ? 'Sat' : null,
        inspectedPreset.params.FX_FILTER_ON >= 0.5
          ? CLASSIC_FILTER_LABELS[Math.round(inspectedPreset.params.FX_FILTER_TYPE)]
          : null,
      ].filter(Boolean)
    : [];
  const inspectedWave = useMemo(
    () => (inspectedPreset ? buildPatchWaveformSvg(inspectedPreset) : null),
    [inspectedPreset],
  );

  // Instant u-he style arrow-key auditioning & Esc/Enter shortcuts
  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (filteredPresets.length === 0) return;
        e.preventDefault();
        const curIdx = filteredPresets.findIndex((p) => p.id === activePresetId);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx =
          curIdx === -1
            ? 0
            : (curIdx + delta + filteredPresets.length) % filteredPresets.length;
        const nextPreset = filteredPresets[nextIdx];
        onSelectPreset(nextPreset);
        const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(nextPreset.id) : nextPreset.id;
        const row = listRef.current?.querySelector(`[data-preset-id="${escapedId}"]`);
        row?.scrollIntoView({ block: 'nearest' });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [activePresetId, filteredPresets, onClose, onSelectPreset, open]);

  if (!open) return null;

  const toggleTag = (tag: BrowserTag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const FOLDERS: { key: FolderKey; label: string }[] = [
    { key: 'Favorites', label: 'Favorites' },
    { key: 'All', label: 'All Sounds' },
    { key: 'Starters', label: 'Quick Starters' },
    { key: 'Bass', label: 'Bass' },
    { key: 'Lead', label: 'Lead' },
    { key: 'Pluck', label: 'Pluck' },
    { key: 'Pad', label: 'Pad' },
    { key: 'Keys', label: 'Keys' },
    { key: 'FX', label: 'FX' },
    { key: 'User', label: 'User Bank' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 bg-black/80"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Beasty Patch Browser"
    >
      <div className="w-full max-w-[920px] h-[88vh] md:h-[540px] max-h-[88vh] rounded-2xl beasty-card-3d border border-amber-500/45 shadow-[0_32px_90px_rgba(0,0,0,0.96)] overflow-hidden flex flex-col">
        {/* Top Hardware Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 border-b border-amber-500/20 bg-[#0b110d]">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-scratch text-xl tracking-wide text-amber-300">
              PATCH MATRIX
            </span>
            <span className="text-xs font-mono-tabular text-[#8fa192]">
              {filteredPresets.length} / {presets.length}
            </span>
          </div>

          <div className="relative flex-1 min-w-[180px] max-w-[380px]">
            <Search className="w-4 h-4 text-amber-400/75 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Instant filter · name, tag, character (↑/↓ audition)"
              className="w-full pl-9 pr-8 py-1.5 rounded-lg recessed-screen text-xs text-[#f4efe6] placeholder:text-[#6f7e71] focus:outline-none focus:border-amber-400/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a998d] hover:text-[#f4efe6]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-lg bg-[#070b08] border border-white/[0.12] p-0.5">
              {([
                ['curated', 'Bank'],
                ['name', 'A–Z'],
                ['cutoff', 'Hz'],
              ] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSortBy(val)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    sortBy === val ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/55 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-xs font-bold transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* u-he Style Attribute Tag Matrix Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-amber-500/15 bg-[#090e0b]">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-semibold text-[#7f8f82] mr-1 uppercase tracking-wider">
              Tags:
            </span>
            {ALL_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-0.5 rounded text-[11.5px] font-semibold border transition-colors ${
                    active
                      ? 'border-amber-400/70 bg-amber-500/25 text-amber-100'
                      : 'border-white/[0.08] bg-[#101712] text-[#8fa192] hover:text-[#f4efe6] hover:border-amber-500/30'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {(selectedTags.length > 0 || query || folder !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFolder('All');
                setSelectedTags([]);
              }}
              className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              Clear All
            </button>
          )}
        </div>

        {/* 3-Column Studio Browser Body: Folder Tree | Fast Patch Matrix | Patch DNA Inspector */}
        <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[175px_1fr_235px] divide-y md:divide-y-0 md:divide-x divide-amber-500/15">
          {/* Col 1: Directory Tree (Horizontal strip on mobile, vertical sidebar on md+) */}
          <aside className="p-2 md:p-2.5 bg-[#080d0a] overflow-x-auto md:overflow-x-hidden md:overflow-y-auto beasty-scroll flex md:flex-col gap-1 md:gap-0.5 shrink-0">
            {FOLDERS.map((item) => {
              const active = folder === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFolder(item.key)}
                  className={`shrink-0 md:w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-amber-500/22 text-amber-100 border border-amber-400/45'
                      : 'text-[#9aa89c] hover:text-[#f4efe6] hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {item.key === 'Favorites' ? (
                      <Star className={`w-3.5 h-3.5 shrink-0 ${active ? 'fill-amber-400 text-amber-400' : ''}`} />
                    ) : (
                      <Folder className="w-3.5 h-3.5 shrink-0 opacity-75" />
                    )}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="text-[11px] font-mono-tabular opacity-75">
                    {folderCounts[item.key]}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Col 2: Fast Single-Click Audition List */}
          <div ref={listRef} className="flex-1 min-h-[180px] overflow-y-auto beasty-scroll bg-[#0b110d] divide-y divide-white/[0.04]">
            {filteredPresets.length === 0 ? (
              <div className="py-16 text-center space-y-2 px-4">
                <p className="text-sm font-semibold text-[#c5cfc6]">No matching patches in vault</p>
                <p className="text-xs text-[#7d8d80]">Adjust tag filters or search text to audition patches.</p>
              </div>
            ) : (
              filteredPresets.map((preset) => {
                const selected = preset.id === activePresetId;
                const isFav = favSet.has(preset.id);
                return (
                  <div
                    key={preset.id}
                    data-preset-id={preset.id}
                    onClick={() => onSelectPreset(preset)}
                    onDoubleClick={() => {
                      onSelectPreset(preset);
                      onClose();
                    }}
                    className={`group flex items-center justify-between gap-2 px-3 py-2 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-amber-500/20 border-l-2 border-l-amber-400'
                        : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(preset.id);
                        }}
                        aria-label={isFav ? `Unstar ${preset.name}` : `Star ${preset.name}`}
                        className="p-0.5 text-[#6e7e71] hover:text-amber-300 shrink-0"
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      <span
                        className={`text-[13px] font-semibold truncate ${
                          selected ? 'text-amber-100' : 'text-[#efe8dc] group-hover:text-amber-200'
                        }`}
                      >
                        {preset.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-[11px]">
                      <span className="text-[#8fa192] font-medium">
                        {preset.isFactory ? preset.category : `User`}
                      </span>
                      <span className="font-mono-tabular text-amber-300/85 w-[56px] text-right">
                        {formatParamValue('FILTER_CUTOFF', preset.params.FILTER_CUTOFF)}
                      </span>
                      {selected && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Col 3: Right Patch DNA Inspector */}
          {inspectedPreset && (
            <aside className="max-h-[34vh] md:max-h-none p-3 md:p-3.5 bg-[#080d0a] flex flex-col justify-between overflow-y-auto beasty-scroll shrink-0">
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-semibold text-amber-300/85 uppercase tracking-wider">
                    {inspectedPreset.isFactory ? 'Factory Patch' : 'User Sound'} · {inspectedPreset.category}
                  </div>
                  <h3 className="font-display text-base font-bold text-[#f4efe6] mt-0.5">
                    {inspectedPreset.name}
                  </h3>
                  {inspectedPreset.description && (
                    <p className="text-xs text-[#98a69a] mt-1 leading-relaxed">
                      {inspectedPreset.description}
                    </p>
                  )}
                </div>

                {/* Patch Profile Waveform & Envelope Silhouette OLED */}
                {inspectedWave && (
                  <div className="recessed-screen rounded-xl h-[68px] relative overflow-hidden">
                    <div className="oled-scanlines absolute inset-0 pointer-events-none z-10" aria-hidden="true" />
                    <svg viewBox="0 0 200 64" preserveAspectRatio="none" className="w-full h-full block">
                      <defs>
                        <linearGradient id="patchProfileFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={inspectedWave.stroke} stopOpacity="0.34" />
                          <stop offset="100%" stopColor={inspectedWave.stroke} stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="33" x2="200" y2="33" stroke="rgba(255,240,215,0.08)" strokeDasharray="2 3" />
                      <line x1="66" y1="0" x2="66" y2="64" stroke="rgba(255,240,215,0.05)" />
                      <line x1="133" y1="0" x2="133" y2="64" stroke="rgba(255,240,215,0.05)" />
                      <path
                        d={inspectedWave.envLine}
                        fill="none"
                        stroke="rgba(110, 231, 183, 0.25)"
                        strokeWidth={1.1}
                        strokeDasharray="3 2"
                      />
                      <path d={inspectedWave.fill} fill="url(#patchProfileFill)" />
                      <path
                        d={inspectedWave.line}
                        fill="none"
                        stroke={inspectedWave.stroke}
                        strokeWidth={1.9}
                        strokeLinejoin="round"
                        style={{ filter: `drop-shadow(0 0 4px ${inspectedWave.stroke}88)` }}
                      />
                    </svg>
                  </div>
                )}

                {/* DNA Attributes */}
                <div className="flex flex-wrap gap-1">
                  {inspectedTags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded bg-[#121a14] border border-white/[0.1] text-[10.5px] font-semibold text-[#c9d3ca]"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Numeric Synth DNA Snapshot */}
                <div className="recessed-screen rounded-xl p-2.5 space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-[#869689]">Cutoff / Res</span>
                    <span className="font-mono-tabular font-semibold text-amber-200">
                      {formatParamValue('FILTER_CUTOFF', inspectedPreset.params.FILTER_CUTOFF)} ·{' '}
                      {Math.round(inspectedPreset.params.FILTER_RES * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869689]">Ladder Drive</span>
                    <span className="font-mono-tabular font-semibold text-orange-300">
                      {Math.round(inspectedPreset.params.FILTER_DRIVE * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869689]">Analog Drift</span>
                    <span className="font-mono-tabular font-semibold text-[#f4efe6]">
                      {Math.round(inspectedPreset.params.ANALOG_DRIFT * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869689]">Voice Mode</span>
                    <span className="font-mono-tabular font-semibold text-[#f4efe6]">
                      {inspectedPreset.params.VOICE_COUNT <= 1
                        ? 'Mono Legato'
                        : `${Math.round(inspectedPreset.params.VOICE_COUNT)} Voices`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#869689] shrink-0">Active FX</span>
                    <span className="font-mono-tabular font-semibold text-emerald-300 truncate text-right">
                      {inspectedFxList.length > 0 ? inspectedFxList.join(', ') : 'Dry'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(inspectedPreset.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    favSet.has(inspectedPreset.id)
                      ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                      : 'border-white/[0.12] bg-[#121914] text-[#a5b3a7] hover:text-[#f4efe6]'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${favSet.has(inspectedPreset.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span>{favSet.has(inspectedPreset.id) ? 'Starred' : 'Favorite'}</span>
                </button>

                {!inspectedPreset.isFactory && (
                  <button
                    type="button"
                    onClick={() => onDeletePreset(inspectedPreset.id)}
                    aria-label={`Delete ${inspectedPreset.name}`}
                    className="p-2 rounded-lg border border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
