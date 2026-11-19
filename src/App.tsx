/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { BeastyMascot } from './components/BeastyMascot';
import { EffectDetailModal, EffectKey } from './components/EffectDetailModal';
import { EffectsRack } from './components/EffectsRack';
import { EnvelopeEditor, EnvViewMode } from './components/EnvelopeEditor';
import { FilterCurve, FilterViewMode } from './components/FilterCurve';
import { ForestBackdrop } from './components/ForestBackdrop';
import { ModMatrixModal } from './components/ModMatrixModal';
import { OscillatorBank } from './components/OscillatorBank';
import { PerformanceStrip } from './components/PerformanceStrip';
import { PianoKeyboard } from './components/PianoKeyboard';
import { PresetBrowserModal } from './components/PresetBrowserModal';
import { QuickPatchPad } from './components/QuickPatchPad';
import { RotaryKnob } from './components/RotaryKnob';
import { SynthDetailModal, SynthSectionKey } from './components/SynthDetailModal';
import { TopBrowserBar } from './components/TopBrowserBar';
import { InteractMode, ViewMode, Waveform3DVisualizer } from './components/Waveform3DVisualizer';
import { audioEngine } from './synth/audioEngine';
import { juceBridge } from './synth/juceBridge';
import {
  ALL_PARAM_IDS,
  FACTORY_PRESETS,
  ParamID,
  ParamState,
  SynthPreset,
  getDefaultParams,
  loadFavoriteIds,
  loadUserPresets,
  randomizeParams,
  saveFavoriteIds,
  saveUserPresets,
} from './synth/parameters';

function paramsEqual(a: ParamState, b: ParamState): boolean {
  for (const id of ALL_PARAM_IDS) {
    if (Math.abs((a[id] ?? 0) - (b[id] ?? 0)) > 1e-4) return false;
  }
  return true;
}

export default function App() {
  const [userPresets, setUserPresets] = useState<SynthPreset[]>(() => loadUserPresets());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavoriteIds());
  const allPresets = useMemo(() => [...FACTORY_PRESETS, ...userPresets], [userPresets]);

  const [activePresetId, setActivePresetId] = useState<string>(FACTORY_PRESETS[0].id);
  const [params, setParams] = useState<ParamState>(() => ({ ...FACTORY_PRESETS[0].params }));
  const [envTab, setEnvTab] = useState<'filter' | 'amp'>('filter');
  const [filterViewMode, setFilterViewMode] = useState<FilterViewMode>('spectrum');
  const [envViewMode, setEnvViewMode] = useState<EnvViewMode>('stage');
  const [envShowCompare, setEnvShowCompare] = useState(true);
  const [waveViewMode, setWaveViewMode] = useState<ViewMode>('waterfall');
  const [waveInteractMode, setWaveInteractMode] = useState<InteractMode>('sculpt');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [modMatrixOpen, setModMatrixOpen] = useState(false);
  const [activeEffect, setActiveEffect] = useState<EffectKey | null>(null);
  const [activeSynthSection, setActiveSynthSection] = useState<SynthSectionKey | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [isJuceHosted, setIsJuceHosted] = useState(false);
  const [panicSignal, setPanicSignal] = useState(0);

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const roarTimerRef = useRef<number | null>(null);

  const activePreset = useMemo(
    () => allPresets.find((p) => p.id === activePresetId) ?? allPresets[0],
    [activePresetId, allPresets],
  );
  const isDirty = useMemo(
    () => !paramsEqual(params, activePreset.params),
    [activePreset.params, params],
  );
  const activeModCount = useMemo(() => {
    let count = 0;
    for (let i = 1; i <= 6; i++) {
      const src = params[`MOD${i}_SRC` as ParamID] ?? 0;
      const dst = params[`MOD${i}_DST` as ParamID] ?? 0;
      const amt = params[`MOD${i}_AMT` as ParamID] ?? 0;
      if (src > 0 && dst > 0 && Math.abs(amt) > 0.005) count++;
    }
    return count;
  }, [params]);

  useEffect(() => {
    const hosted = juceBridge.init();
    setIsJuceHosted(hosted);

    const unsub = juceBridge.onHostParamChange((id, value) => {
      setParams((prev) => {
        if (Math.abs(prev[id] - value) < 1e-5) return prev;
        const next = { ...prev, [id]: value };
        audioEngine.setParams(next);
        return next;
      });
    });

    audioEngine.setParams(paramsRef.current);
    return () => {
      unsub();
      if (roarTimerRef.current !== null) {
        window.clearTimeout(roarTimerRef.current);
        roarTimerRef.current = null;
      }
    };
  }, []);

  const handleParamChange = useCallback((id: ParamID, value: number) => {
    setParams((prev) => {
      if (Math.abs(prev[id] - value) < 1e-6) return prev;
      const next = { ...prev, [id]: value };
      audioEngine.setParams(next);
      return next;
    });
    juceBridge.sendParam(id, value);
  }, []);

  const applyPreset = useCallback((preset: SynthPreset) => {
    const next = { ...getDefaultParams(), ...preset.params };
    setActivePresetId(preset.id);
    setParams(next);
    audioEngine.setParams(next);
    for (const id of ALL_PARAM_IDS) {
      juceBridge.sendParam(id, next[id]);
    }
  }, []);

  const handleRandomize = useCallback(() => {
    const next = randomizeParams(paramsRef.current);
    setParams(next);
    audioEngine.setParams(next);
    for (const id of ALL_PARAM_IDS) {
      juceBridge.sendParam(id, next[id]);
    }
  }, []);

  const handleSavePreset = useCallback(
    (name: string, category: SynthPreset['category']) => {
      const created: SynthPreset = {
        id: `user-${Date.now()}`,
        name,
        category,
        tone: 'Warm',
        description: 'Custom user sound',
        isFactory: false,
        params: { ...paramsRef.current },
      };
      const updated = [created, ...userPresets];
      setUserPresets(updated);
      saveUserPresets(updated);
      setActivePresetId(created.id);
    },
    [userPresets],
  );

  const handleDeletePreset = useCallback(
    (id: string) => {
      const updated = userPresets.filter((p) => p.id !== id);
      setUserPresets(updated);
      saveUserPresets(updated);
      if (activePresetId === id) {
        applyPreset(FACTORY_PRESETS[0]);
      }
    },
    [activePresetId, applyPreset, userPresets],
  );

  const handleToggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveFavoriteIds(next);
      return next;
    });
  }, []);

  const handleResetInit = useCallback(() => {
    const next = getDefaultParams();
    setParams(next);
    audioEngine.setParams(next);
    for (const id of ALL_PARAM_IDS) {
      juceBridge.sendParam(id, next[id]);
    }
  }, []);

  const handleApplyModPattern = useCallback((patch: Partial<ParamState>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      audioEngine.setParams(next);
      for (const [k, v] of Object.entries(patch)) {
        if (typeof v === 'number') {
          juceBridge.sendParam(k as ParamID, v);
        }
      }
      return next;
    });
  }, []);

  const handleEnableAudio = useCallback(async () => {
    const ok = await audioEngine.ensureStarted();
    setAudioReady(ok);
  }, []);

  const handleNoteOn = useCallback(
    (midiNote: number) => {
      if (isJuceHosted) {
        juceBridge.invokeNoteOn(midiNote);
      } else {
        audioEngine.noteOn(midiNote, 0.88).then(() => {
          setAudioReady(audioEngine.isRunning());
        });
      }
    },
    [isJuceHosted],
  );

  const handleNoteOff = useCallback(
    (midiNote: number) => {
      if (isJuceHosted) {
        juceBridge.invokeNoteOff(midiNote);
      } else {
        audioEngine.noteOff(midiNote);
      }
    },
    [isJuceHosted],
  );

  const handlePitchBend = useCallback(
    (semis: number) => {
      if (isJuceHosted) {
        juceBridge.invokePitchBend(semis);
      }
      audioEngine.setPitchBend(semis);
    },
    [isJuceHosted],
  );

  const handlePanic = useCallback(() => {
    if (isJuceHosted) {
      juceBridge.invokePanic();
    }
    audioEngine.allNotesOff();
    setPanicSignal((n) => n + 1);
  }, [isJuceHosted]);

  const handleRoar = useCallback(() => {
    if (isJuceHosted) {
      if (roarTimerRef.current !== null) {
        window.clearTimeout(roarTimerRef.current);
      }
      juceBridge.invokeNoteOn(36);
      roarTimerRef.current = window.setTimeout(() => {
        roarTimerRef.current = null;
        juceBridge.invokeNoteOff(36);
      }, 480);
    } else {
      audioEngine.triggerRoar().then(() => {
        setAudioReady(audioEngine.isRunning());
      });
    }
  }, [isJuceHosted]);

  const getTelemetry = useCallback(() => audioEngine.getTelemetry(), []);
  const anyModalOpen = Boolean(browserOpen || modMatrixOpen || activeEffect || activeSynthSection);

  return (
    <div className="relative min-h-screen bg-[#060b08] text-[#f4efe6] flex flex-col justify-center p-1.5 sm:p-2.5">
      {/* Real Twilight Pine Forest Photo Backdrop */}
      <ForestBackdrop />

      {/* u-he Style Fast Patch Browser Modal */}
      <PresetBrowserModal
        open={browserOpen}
        presets={allPresets}
        activePresetId={activePresetId}
        favoriteIds={favoriteIds}
        onClose={() => setBrowserOpen(false)}
        onSelectPreset={applyPreset}
        onToggleFavorite={handleToggleFavorite}
        onDeletePreset={handleDeletePreset}
      />

      {/* Mod Matrix Routing & Classic Modulation Patterns */}
      <ModMatrixModal
        open={modMatrixOpen}
        params={params}
        getTelemetry={getTelemetry}
        onChange={handleParamChange}
        onApplyPattern={handleApplyModPattern}
        onClose={() => setModMatrixOpen(false)}
      />

      {/* Clickable FX Rack Detail Pop-out Editor */}
      <EffectDetailModal
        activeEffect={activeEffect}
        params={params}
        onSelectEffect={setActiveEffect}
        onChange={handleParamChange}
        onClose={() => setActiveEffect(null)}
      />

      {/* Clickable Synth Module Detail View (Oscillators, Filter, Envelopes, 3D Waveform) */}
      <SynthDetailModal
        activeSection={activeSynthSection}
        params={params}
        envTab={envTab}
        onEnvTabChange={setEnvTab}
        filterViewMode={filterViewMode}
        onFilterViewModeChange={setFilterViewMode}
        envViewMode={envViewMode}
        onEnvViewModeChange={setEnvViewMode}
        envShowCompare={envShowCompare}
        onToggleEnvCompare={() => setEnvShowCompare((c) => !c)}
        waveViewMode={waveViewMode}
        onWaveViewModeChange={setWaveViewMode}
        waveInteractMode={waveInteractMode}
        onWaveInteractModeChange={setWaveInteractMode}
        getTelemetry={getTelemetry}
        onSelectSection={setActiveSynthSection}
        onChange={handleParamChange}
        onClose={() => setActiveSynthSection(null)}
      />

      {/* 3D Beveled Hardware Chassis with Burnished Brass Rim & Walnut Cheeks */}
      <div className="relative z-10 w-full max-w-[1380px] mx-auto rounded-2xl border-2 border-amber-500/35 shadow-[0_28px_80px_rgba(0,0,0,0.92),0_0_0_1px_rgba(0,0,0,0.85)] overflow-hidden flex">
        <div className="hidden lg:flex w-4 shrink-0 walnut-cheek flex-col items-center justify-between py-4" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300/35 border border-black/70 shadow-inner" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300/35 border border-black/70 shadow-inner" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300/35 border border-black/70 shadow-inner" />
        </div>

        <div className="flex-1 min-w-0 chassis-surface flex flex-col">
          {/* Top Bar: Wordmark · Organized Browser · Transpose / Voices / Master / Mod Matrix / Panic */}
          <TopBrowserBar
            presets={allPresets}
            activePresetId={activePresetId}
            isDirty={isDirty}
            audioReady={audioReady}
            isJuceHosted={isJuceHosted}
            activeModCount={activeModCount}
            params={params}
            onParamChange={handleParamChange}
            onSelectPreset={applyPreset}
            onOpenBrowser={() => setBrowserOpen(true)}
            onOpenModMatrix={() => setModMatrixOpen(true)}
            onSavePreset={handleSavePreset}
            onResetInit={handleResetInit}
            onRandomize={handleRandomize}
            onToggleAudio={handleEnableAudio}
            onPanic={handlePanic}
          />

          {/* Hero Stage: Mascot + Quick Starters + 3D Waveform (2-col on tablet md, 3-col on desktop lg) */}
          <section className="flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-row gap-3 px-3 py-2 items-stretch border-b border-amber-500/20">
            <div className="lg:w-[248px] shrink-0 flex items-stretch">
              <BeastyMascot
                params={params}
                getTelemetry={getTelemetry}
                onRoar={handleRoar}
              />
            </div>

            <div className="md:col-span-2 lg:col-span-1 flex-1 min-w-0 flex flex-col justify-center gap-2 lg:h-[222px] order-3 lg:order-none">
              <PerformanceStrip params={params} onChange={handleParamChange} />
              <QuickPatchPad activePresetId={activePresetId} onSelect={applyPreset} />
            </div>

            <div className="w-full max-w-[320px] md:max-w-none mx-auto lg:mx-0 lg:w-[274px] lg:h-[222px] shrink-0 flex flex-col justify-between order-2 lg:order-none">
              {/* Waveform Header with Sculpt / Orbit / Wave / Ring & Expand Beside Header */}
              <div className="flex items-center justify-between gap-1 h-[20px] mb-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSynthSection('waveform')}
                  title="Click to open large 3D Waveform view"
                  className="flex items-center gap-1 text-left group focus:outline-none shrink-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]" />
                  <span className="font-display text-[11px] font-bold tracking-[0.05em] text-[#f4efe6] group-hover:text-amber-200 uppercase leading-none">
                    Scope
                  </span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#080c09] border border-amber-500/25">
                    <button
                      type="button"
                      onClick={() => setWaveInteractMode('sculpt')}
                      className={`px-1 py-0.5 rounded text-[8.5px] font-semibold leading-none transition-colors ${
                        waveInteractMode === 'sculpt' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                      }`}
                    >
                      Sculpt
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaveInteractMode('orbit')}
                      className={`px-1 py-0.5 rounded text-[8.5px] font-semibold leading-none transition-colors ${
                        waveInteractMode === 'orbit' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                      }`}
                    >
                      Orbit
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#080c09] border border-white/[0.12]">
                    <button
                      type="button"
                      onClick={() => setWaveViewMode('waterfall')}
                      className={`px-1 py-0.5 rounded text-[8.5px] font-semibold leading-none transition-colors ${
                        waveViewMode === 'waterfall' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                      }`}
                    >
                      Wave
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaveViewMode('torus')}
                      className={`px-1 py-0.5 rounded text-[8.5px] font-semibold leading-none transition-colors ${
                        waveViewMode === 'torus' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                      }`}
                    >
                      Ring
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSynthSection('waveform')}
                    title="Expand 3D Waveform view"
                    aria-label="Expand 3D Waveform view"
                    className="p-0.5 text-[#8fa192] hover:text-amber-300 transition-colors"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-[150px] flex">
                <Waveform3DVisualizer
                  params={params}
                  onChange={handleParamChange}
                  getTelemetry={getTelemetry}
                  viewMode={waveViewMode}
                  onViewModeChange={setWaveViewMode}
                  interactMode={waveInteractMode}
                  onInteractModeChange={setWaveInteractMode}
                  hideControls
                />
              </div>
            </div>
          </section>

          {/* 3-Bay Synthesis Deck: Compact 172px Height · Osc Bank + Skinny Noise | Ladder Filter | Envelopes */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.20fr_1.06fr_0.96fr] divide-y lg:divide-y-0 lg:divide-x divide-amber-500/15 px-1.5 py-2 items-stretch">
            {/* Bay 1: Clickable Oscillators + Skinny Bearclaw Noise Fader */}
            <div className="px-2 pb-2 lg:pb-0 lg:h-[172px]">
              <OscillatorBank
                params={params}
                onChange={handleParamChange}
                onOpenDetail={() => setActiveSynthSection('osc')}
              />
            </div>

            {/* Bay 2: Ladder Filter with Spectrum/Harmonics Beside Header + Slim Inline Knobs Strip */}
            <div className="px-2 py-2 lg:py-0 lg:h-[172px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between h-[20px] mb-1">
                  <button
                    type="button"
                    onClick={() => setActiveSynthSection('filter')}
                    title="Click to open large Ladder Filter view"
                    className="flex items-center gap-1.5 group focus:outline-none"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]" />
                    <h2 className="font-display text-[12.5px] font-bold tracking-[0.06em] text-[#f4efe6] group-hover:text-amber-200 uppercase leading-none transition-colors">
                      Ladder Filter
                    </h2>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#080c09] border border-amber-500/25">
                      <button
                        type="button"
                        onClick={() => setFilterViewMode('spectrum')}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold leading-none transition-colors ${
                          filterViewMode === 'spectrum' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                        }`}
                      >
                        Spectrum
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterViewMode('harmonics')}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold leading-none transition-colors ${
                          filterViewMode === 'harmonics' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                        }`}
                      >
                        Harmonics
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveSynthSection('filter')}
                      title="Expand Ladder Filter view"
                      aria-label="Expand Ladder Filter view"
                      className="p-0.5 text-[#8fa192] hover:text-amber-300 transition-colors"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <FilterCurve
                  cutoffHz={params.FILTER_CUTOFF}
                  resonance={params.FILTER_RES}
                  drive={params.FILTER_DRIVE}
                  envAmount={params.FILTER_ENV}
                  keytrack={params.FILTER_KEYTRACK}
                  getTelemetry={getTelemetry}
                  onChange={handleParamChange}
                  viewMode={filterViewMode}
                  onViewModeChange={setFilterViewMode}
                  hideControls
                  heightClass="h-[94px]"
                  viewHeight={94}
                />
              </div>

              <div
                onClick={() => setActiveSynthSection('filter')}
                title="Click bar to expand Ladder Filter view"
                className="mt-1.5 min-h-[48px] sm:h-[48px] px-1.5 py-1 rounded-xl beasty-card-3d hover:border-amber-400/45 flex items-center justify-around gap-0.5 cursor-pointer transition-colors"
              >
                <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap sm:flex-nowrap items-center justify-around gap-x-1.5 gap-y-1 sm:gap-0.5 w-full">
                  <RotaryKnob
                    id="FILTER_CUTOFF"
                    value={params.FILTER_CUTOFF}
                    onChange={handleParamChange}
                    size="xxs"
                    layout="inline"
                    labelOverride="Cut"
                  />
                  <div className="hidden sm:block w-px h-5 bg-amber-500/15 shrink-0" aria-hidden="true" />
                  <RotaryKnob
                    id="FILTER_RES"
                    value={params.FILTER_RES}
                    onChange={handleParamChange}
                    size="xxs"
                    layout="inline"
                    labelOverride="Res"
                  />
                  <div className="hidden sm:block w-px h-5 bg-amber-500/15 shrink-0" aria-hidden="true" />
                  <RotaryKnob
                    id="FILTER_DRIVE"
                    value={params.FILTER_DRIVE}
                    onChange={handleParamChange}
                    size="xxs"
                    layout="inline"
                    labelOverride="Drive"
                    accent="copper"
                  />
                  <div className="hidden sm:block w-px h-5 bg-amber-500/15 shrink-0" aria-hidden="true" />
                  <RotaryKnob
                    id="FILTER_ENV"
                    value={params.FILTER_ENV}
                    onChange={handleParamChange}
                    size="xxs"
                    layout="inline"
                    labelOverride="Env"
                  />
                  <div className="hidden sm:block w-px h-5 bg-amber-500/15 shrink-0" aria-hidden="true" />
                  <RotaryKnob
                    id="FILTER_KEYTRACK"
                    value={params.FILTER_KEYTRACK}
                    onChange={handleParamChange}
                    size="xxs"
                    layout="inline"
                    labelOverride="Key"
                    accent="ivory"
                  />
                </div>
              </div>
            </div>

            {/* Bay 3: Envelopes Full-Height Interactive OLED Visual (ADSR Faders live in Zoomed-In View) */}
            <div className="px-2 pt-2 lg:pt-0 lg:h-[172px] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1 h-[20px] mb-1 shrink-0 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveSynthSection('env')}
                  title="Click to open zoomed-in Envelopes view with Bearclaw ADSR faders"
                  className="flex items-center gap-1 group focus:outline-none min-w-0"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      envTab === 'amp'
                        ? 'bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.85)]'
                        : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]'
                    }`}
                  />
                  <h2 className="font-display text-[11.5px] xl:text-[12.5px] font-bold tracking-[0.05em] text-[#f4efe6] group-hover:text-amber-200 uppercase leading-none transition-colors truncate">
                    Envelopes
                  </h2>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center rounded bg-[#080c09] border border-amber-500/25 p-0.5">
                    <button
                      type="button"
                      onClick={() => setEnvTab('filter')}
                      className={`px-1 py-0.5 rounded text-[9px] font-bold leading-none transition-colors ${
                        envTab === 'filter'
                          ? 'bg-amber-500/25 text-amber-200'
                          : 'text-[#8fa192] hover:text-[#f4efe6]'
                      }`}
                    >
                      Flt
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnvTab('amp')}
                      className={`px-1 py-0.5 rounded text-[9px] font-bold leading-none transition-colors ${
                        envTab === 'amp'
                          ? 'bg-emerald-500/25 text-emerald-200'
                          : 'text-[#8fa192] hover:text-[#f4efe6]'
                      }`}
                    >
                      Amp
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#080c09] border border-white/[0.12]">
                    <button
                      type="button"
                      onClick={() => setEnvViewMode('stage')}
                      className={`px-1 py-0.5 rounded text-[9px] font-semibold leading-none transition-colors ${
                        envViewMode === 'stage' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                      }`}
                    >
                      Stage
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnvViewMode('scope')}
                      className={`px-1 py-0.5 rounded text-[9px] font-semibold leading-none transition-colors ${
                        envViewMode === 'scope' ? 'bg-amber-500/25 text-amber-200' : 'text-[#8c9d8f] hover:text-[#f4efe6]'
                      }`}
                    >
                      Scope
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnvShowCompare((c) => !c)}
                      className={`px-1 py-0.5 rounded text-[9px] font-semibold leading-none transition-colors ${
                        envShowCompare ? 'text-emerald-300' : 'text-[#6e7e71] hover:text-[#f4efe6]'
                      }`}
                      title={`Toggle ghost overlay of ${envTab === 'filter' ? 'Amp' : 'Filter'} envelope`}
                    >
                      Cmp
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSynthSection('env')}
                    title="Open zoomed-in Envelopes view with Bearclaw ADSR faders"
                    aria-label="Open Bearclaw ADSR Faders in zoomed Envelopes view"
                    className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-[8.5px] font-bold text-amber-200 hover:bg-amber-500/25 hover:border-amber-400/60 transition-colors leading-none"
                  >
                    <span>ADSR</span>
                    <Maximize2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

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
                  onChange={handleParamChange}
                  accent="amber"
                  viewMode={envViewMode}
                  onViewModeChange={setEnvViewMode}
                  showCompare={envShowCompare}
                  onToggleCompare={() => setEnvShowCompare((c) => !c)}
                  hideControls
                  heightClass="h-[146px]"
                  viewHeight={146}
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
                  onChange={handleParamChange}
                  accent="ivory"
                  viewMode={envViewMode}
                  onViewModeChange={setEnvViewMode}
                  showCompare={envShowCompare}
                  onToggleCompare={() => setEnvShowCompare((c) => !c)}
                  hideControls
                  heightClass="h-[146px]"
                  viewHeight={146}
                />
              )}
            </div>
          </section>

          {/* Compact 6 Clickable Effect Cards (Delay, Reverb, Phaser, Flanger, Saturation, Filter FX) */}
          <EffectsRack
            params={params}
            onChange={handleParamChange}
            onOpenEffect={setActiveEffect}
          />

          {/* Compact Detailed 3D Playable Piano Keyboard */}
          <footer className="px-3 pb-2">
            <PianoKeyboard
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
              onPitchBend={handlePitchBend}
              onPanic={handlePanic}
              disabled={anyModalOpen}
              panicSignal={panicSignal}
            />
          </footer>
        </div>

        <div className="hidden lg:flex w-4 shrink-0 walnut-cheek flex-col items-center justify-between py-4" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300/35 border border-black/70 shadow-inner" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300/35 border border-black/70 shadow-inner" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300/35 border border-black/70 shadow-inner" />
        </div>
      </div>
    </div>
  );
}
