import { ParamState } from './paramDefs';
import { SynthPreset } from './paramDefs';

export * from './paramDefs';
export * from './presets200';

export function randomizeParams(current: ParamState): ParamState {
  const next = { ...current };
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

  const archetype = pick(['bass', 'pluck', 'lead', 'pad'] as const);

  next.OSC1_RANGE = archetype === 'bass' ? pick([0, 1]) : pick([1, 2, 3]);
  next.OSC2_RANGE = pick([1, 2, 3]);
  next.OSC3_RANGE = pick([0, 1, 2, 3]);
  next.OSC1_WAVE = Math.floor(Math.random() * 4);
  next.OSC2_WAVE = Math.floor(Math.random() * 4);
  next.OSC3_WAVE = Math.floor(Math.random() * 4);
  next.OSC2_FREQ = Number(rand(-24, 24).toFixed(1));
  next.OSC3_FREQ = Number(rand(-24, 24).toFixed(1));

  next.MIX_OSC1 = Number(rand(0.65, 1.0).toFixed(2));
  next.MIX_OSC2 = Number(rand(0.25, 0.92).toFixed(2));
  next.MIX_OSC3 = Number(rand(0.15, 0.85).toFixed(2));
  next.MIX_NOISE = Math.random() < 0.35 ? Number(rand(0.02, 0.22).toFixed(2)) : 0;

  next.FILTER_CUTOFF = Math.round(
    archetype === 'bass' ? rand(180, 1600) : archetype === 'pad' ? rand(420, 3200) : rand(380, 7500),
  );
  next.FILTER_RES = Number(rand(0.08, 0.86).toFixed(2));
  next.FILTER_DRIVE = Number(rand(0.1, 0.85).toFixed(2));
  next.FILTER_ENV = Number(rand(0.22, 0.88).toFixed(2));
  next.FILTER_KEYTRACK = Number(rand(0.25, 0.9).toFixed(2));

  if (archetype === 'pluck') {
    next.FENV_ATTACK = Number(rand(0.001, 0.015).toFixed(3));
    next.FENV_DECAY = Number(rand(0.12, 0.45).toFixed(2));
    next.FENV_SUSTAIN = Number(rand(0, 0.2).toFixed(2));
    next.FENV_RELEASE = Number(rand(0.12, 0.55).toFixed(2));
    next.AENV_ATTACK = Number(rand(0.001, 0.012).toFixed(3));
    next.AENV_DECAY = Number(rand(0.15, 0.6).toFixed(2));
    next.AENV_SUSTAIN = Number(rand(0, 0.25).toFixed(2));
    next.AENV_RELEASE = Number(rand(0.15, 0.7).toFixed(2));
  } else if (archetype === 'pad') {
    next.FENV_ATTACK = Number(rand(0.25, 1.8).toFixed(2));
    next.FENV_DECAY = Number(rand(0.8, 3.2).toFixed(2));
    next.FENV_SUSTAIN = Number(rand(0.35, 0.85).toFixed(2));
    next.FENV_RELEASE = Number(rand(0.8, 3.2).toFixed(2));
    next.AENV_ATTACK = Number(rand(0.2, 1.5).toFixed(2));
    next.AENV_DECAY = Number(rand(0.6, 2.2).toFixed(2));
    next.AENV_SUSTAIN = Number(rand(0.6, 0.95).toFixed(2));
    next.AENV_RELEASE = Number(rand(0.8, 3.2).toFixed(2));
  } else {
    next.FENV_ATTACK = Number(rand(0.002, 0.08).toFixed(3));
    next.FENV_DECAY = Number(rand(0.18, 1.1).toFixed(2));
    next.FENV_SUSTAIN = Number(rand(0.1, 0.7).toFixed(2));
    next.FENV_RELEASE = Number(rand(0.12, 0.8).toFixed(2));
    next.AENV_ATTACK = Number(rand(0.002, 0.04).toFixed(3));
    next.AENV_DECAY = Number(rand(0.18, 0.9).toFixed(2));
    next.AENV_SUSTAIN = Number(rand(0.55, 0.96).toFixed(2));
    next.AENV_RELEASE = Number(rand(0.1, 0.75).toFixed(2));
  }

  next.ANALOG_DRIFT = Number(rand(0.15, 0.85).toFixed(2));
  next.VOICE_COUNT = archetype === 'bass' || (archetype === 'lead' && Math.random() < 0.6) ? 1 : pick([4, 6, 8]);
  next.LEGATO = next.VOICE_COUNT === 1 ? Number(rand(0.45, 0.95).toFixed(2)) : Number(rand(0, 0.4).toFixed(2));
  next.GLIDE_TIME = next.VOICE_COUNT === 1 ? Number(rand(0.02, 0.18).toFixed(3)) : 0;

  next.FX_DELAY_ON = Math.random() < 0.5 ? 1 : 0;
  next.FX_DELAY_MIX = Number(rand(0.18, 0.44).toFixed(2));
  next.FX_DELAY_TIME = Number(rand(0.16, 0.55).toFixed(2));

  next.FX_REVERB_ON = Math.random() < 0.55 ? 1 : 0;
  next.FX_REVERB_MIX = Number(rand(0.18, 0.5).toFixed(2));
  next.FX_REVERB_SIZE = Number(rand(0.35, 0.88).toFixed(2));

  next.FX_PHASER_ON = Math.random() < 0.35 ? 1 : 0;
  next.FX_PHASER_MIX = Number(rand(0.25, 0.65).toFixed(2));
  next.FX_PHASER_RATE = Number(rand(0.2, 2.2).toFixed(2));

  next.FX_FLANGER_ON = Math.random() < 0.3 ? 1 : 0;
  next.FX_FLANGER_MIX = Number(rand(0.2, 0.55).toFixed(2));
  next.FX_FLANGER_DEPTH = Number(rand(0.25, 0.8).toFixed(2));

  next.FX_SAT_ON = Math.random() < 0.45 ? 1 : 0;
  next.FX_SAT_DRIVE = Number(rand(0.22, 0.78).toFixed(2));
  next.FX_SAT_TONE = Number(rand(0.4, 0.9).toFixed(2));

  next.FX_FILTER_ON = Math.random() < 0.35 ? 1 : 0;
  next.FX_FILTER_TYPE = Math.floor(Math.random() * 5);
  next.FX_FILTER_CUTOFF = Math.round(rand(450, 5200));
  next.FX_FILTER_LP = Math.round(rand(2200, 16500));
  next.FX_FILTER_HP = Math.round(rand(24, 340));
  next.FX_FILTER_RES = Number(rand(0.18, 0.65).toFixed(2));

  return next;
}

const STORAGE_KEY = 'beasty_user_presets_v1';
const FAV_STORAGE_KEY = 'beasty_favorite_presets_v1';

export function loadUserPresets(): SynthPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SynthPreset =>
        p && typeof p.id === 'string' && typeof p.name === 'string' && p.params && typeof p.params === 'object',
    );
  } catch {
    return [];
  }
}

export function saveUserPresets(presets: SynthPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage errors
  }
}

export function loadFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavoriteIds(ids: string[]): void {
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}
