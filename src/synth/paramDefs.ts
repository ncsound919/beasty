export const JUCE_CORE_PARAM_IDS = [
  'OSC1_RANGE',
  'OSC2_RANGE',
  'OSC3_RANGE',
  'OSC1_WAVE',
  'OSC2_WAVE',
  'OSC3_WAVE',
  'OSC2_FREQ',
  'OSC3_FREQ',
  'MIX_OSC1',
  'MIX_OSC2',
  'MIX_OSC3',
  'MIX_NOISE',
  'FILTER_CUTOFF',
  'FILTER_RES',
  'FILTER_DRIVE',
  'FILTER_ENV',
  'FILTER_KEYTRACK',
  'FENV_ATTACK',
  'FENV_DECAY',
  'FENV_SUSTAIN',
  'FENV_RELEASE',
  'AENV_ATTACK',
  'AENV_DECAY',
  'AENV_SUSTAIN',
  'AENV_RELEASE',
  'ANALOG_DRIFT',
  'MASTER_VOLUME',
] as const;

export type CoreParamID = (typeof JUCE_CORE_PARAM_IDS)[number];

export type ExtraParamID =
  | 'TRANSPOSE'
  | 'VOICE_COUNT'
  | 'PITCH_OFFSET'
  | 'FINE_TUNE'
  | 'LEGATO'
  | 'GLIDE_TIME'
  | 'FX_DELAY_ON'
  | 'FX_DELAY_MIX'
  | 'FX_DELAY_TIME'
  | 'FX_DELAY_FEEDBACK'
  | 'FX_DELAY_TONE'
  | 'FX_REVERB_ON'
  | 'FX_REVERB_MIX'
  | 'FX_REVERB_SIZE'
  | 'FX_REVERB_DAMP'
  | 'FX_PHASER_ON'
  | 'FX_PHASER_MIX'
  | 'FX_PHASER_RATE'
  | 'FX_PHASER_DEPTH'
  | 'FX_PHASER_FB'
  | 'FX_FLANGER_ON'
  | 'FX_FLANGER_MIX'
  | 'FX_FLANGER_DEPTH'
  | 'FX_FLANGER_RATE'
  | 'FX_FLANGER_FB'
  | 'FX_SAT_ON'
  | 'FX_SAT_DRIVE'
  | 'FX_SAT_TONE'
  | 'FX_SAT_MIX'
  | 'FX_SAT_MODE'
  | 'FX_FILTER_ON'
  | 'FX_FILTER_TYPE'
  | 'FX_FILTER_CUTOFF'
  | 'FX_FILTER_LP'
  | 'FX_FILTER_HP'
  | 'FX_FILTER_RES'
  | 'FX_FILTER_DRIVE'
  | 'FX_FILTER_MIX'
  | 'LFO1_RATE'
  | 'LFO1_WAVE'
  | 'LFO2_RATE'
  | 'LFO2_WAVE'
  | 'MOD1_SRC' | 'MOD1_DST' | 'MOD1_AMT'
  | 'MOD2_SRC' | 'MOD2_DST' | 'MOD2_AMT'
  | 'MOD3_SRC' | 'MOD3_DST' | 'MOD3_AMT'
  | 'MOD4_SRC' | 'MOD4_DST' | 'MOD4_AMT'
  | 'MOD5_SRC' | 'MOD5_DST' | 'MOD5_AMT'
  | 'MOD6_SRC' | 'MOD6_DST' | 'MOD6_AMT';

export type ParamID = CoreParamID | ExtraParamID;
export type ParamState = Record<ParamID, number>;

export interface ParamSpec {
  id: ParamID;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
  step: number;
  skew: number;
  def: number;
  unit?: string;
  choices?: readonly string[];
}

export const RANGE_LABELS = ["32'", "16'", "8'", "4'", "2'"] as const;
export const WAVE_LABELS = ['Triangle', 'Saw', 'Square', 'Pulse'] as const;
export const SAT_MODE_LABELS = ['Tape', 'Tube', 'Fuzz', 'Overdrive'] as const;
export const CLASSIC_FILTER_LABELS = [
  'Beasty 24dB',
  'TB-303 Acid',
  'SEM StateVar',
  'MS-20 Scream',
  'Juno HPF',
] as const;

export const LFO_WAVE_LABELS = ['Sine', 'Tri', 'Saw', 'Square', 'S&H'] as const;
export const MOD_SOURCE_LABELS = [
  'Off',
  'LFO 1',
  'LFO 2',
  'Filter Env',
  'Amp Env',
  'Velocity',
  'Keytrack',
  'Drift',
  'Pitch Bend',
] as const;

export const MOD_DEST_LABELS = [
  'Off',
  'Filter Cutoff',
  'Filter Res',
  'Filter Drive',
  'Pitch',
  'Osc 2+3 Detune',
  'Amp Level',
  'Stereo Pan',
  'FX LP Cutoff',
  'FX Phaser Depth',
  'FX Delay Mix',
] as const;

export type ToneCharacter = 'Sub' | 'Acid' | 'Warm' | 'Bright' | 'Space';
export type BrowserTag = 'Sub' | 'Acid' | 'Warm' | 'Bright' | 'Space' | 'Mono' | 'Poly' | 'Fat' | 'FX';
export type PresetCategory = 'Bass' | 'Pluck' | 'Lead' | 'Pad' | 'Keys' | 'FX' | 'User';

export interface SynthPreset {
  id: string;
  name: string;
  shortLabel?: string;
  category: PresetCategory;
  tone?: ToneCharacter;
  tags?: BrowserTag[];
  description?: string;
  isFactory: boolean;
  params: ParamState;
}

export interface ModMatrixPreset {
  id: string;
  name: string;
  description: string;
  patch: Partial<ParamState>;
}

export const MOD_MATRIX_PRESETS: ModMatrixPreset[] = [
  {
    id: 'mod-wobble',
    name: 'Classic Wobble',
    description: 'LFO 1 triangle sweeps ladder cutoff with velocity drive bite',
    patch: {
      LFO1_RATE: 2.8, LFO1_WAVE: 1, LFO2_RATE: 0.4, LFO2_WAVE: 0,
      MOD1_SRC: 1, MOD1_DST: 1, MOD1_AMT: 0.58,
      MOD2_SRC: 5, MOD2_DST: 3, MOD2_AMT: 0.35,
      MOD3_SRC: 3, MOD3_DST: 4, MOD3_AMT: 0.04,
      MOD4_SRC: 0, MOD4_DST: 0, MOD4_AMT: 0,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-tape-drift',
    name: 'Tape Warble',
    description: 'Organic analog pitch flutter, stereo pan wander & subtle filter drift',
    patch: {
      LFO1_RATE: 0.48, LFO1_WAVE: 0, LFO2_RATE: 0.18, LFO2_WAVE: 1,
      MOD1_SRC: 1, MOD1_DST: 4, MOD1_AMT: 0.11,
      MOD2_SRC: 7, MOD2_DST: 7, MOD2_AMT: 0.46,
      MOD3_SRC: 2, MOD3_DST: 1, MOD3_AMT: 0.2,
      MOD4_SRC: 1, MOD4_DST: 5, MOD4_AMT: 0.24,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-tremolo-pan',
    name: '70s Tremolo Pan',
    description: 'Rhythmic amp tremolo paired with wide stereo autopan motion',
    patch: {
      LFO1_RATE: 4.4, LFO1_WAVE: 0, LFO2_RATE: 0.65, LFO2_WAVE: 0,
      MOD1_SRC: 1, MOD1_DST: 6, MOD1_AMT: 0.48,
      MOD2_SRC: 2, MOD2_DST: 7, MOD2_AMT: 0.78,
      MOD3_SRC: 5, MOD3_DST: 1, MOD3_AMT: 0.28,
      MOD4_SRC: 0, MOD4_DST: 0, MOD4_AMT: 0,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-sh-step',
    name: 'S&H Sci-Fi Step',
    description: 'Stepped Sample & Hold modulation on filter, pitch & FX cutoff',
    patch: {
      LFO1_RATE: 6.2, LFO1_WAVE: 4, LFO2_RATE: 3.1, LFO2_WAVE: 4,
      MOD1_SRC: 1, MOD1_DST: 1, MOD1_AMT: 0.66,
      MOD2_SRC: 1, MOD2_DST: 4, MOD2_AMT: 0.28,
      MOD3_SRC: 2, MOD3_DST: 8, MOD3_AMT: 0.56,
      MOD4_SRC: 2, MOD4_DST: 7, MOD4_AMT: 0.65,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-acid-snap',
    name: 'Acid Velocity Snap',
    description: 'Velocity blasts cutoff, resonance & drive for expressive 303-style accents',
    patch: {
      LFO1_RATE: 1.4, LFO1_WAVE: 2, LFO2_RATE: 0.35, LFO2_WAVE: 0,
      MOD1_SRC: 5, MOD1_DST: 1, MOD1_AMT: 0.64,
      MOD2_SRC: 5, MOD2_DST: 2, MOD2_AMT: 0.42,
      MOD3_SRC: 3, MOD3_DST: 3, MOD3_AMT: 0.48,
      MOD4_SRC: 6, MOD4_DST: 1, MOD4_AMT: 0.22,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-unison-swell',
    name: 'Detune Swell',
    description: 'Envelope & slow LFO bloom oscillator detune and stereo spread',
    patch: {
      LFO1_RATE: 0.36, LFO1_WAVE: 0, LFO2_RATE: 1.1, LFO2_WAVE: 1,
      MOD1_SRC: 3, MOD1_DST: 5, MOD1_AMT: 0.56,
      MOD2_SRC: 1, MOD2_DST: 5, MOD2_AMT: 0.32,
      MOD3_SRC: 4, MOD3_DST: 7, MOD3_AMT: 0.44,
      MOD4_SRC: 2, MOD4_DST: 1, MOD4_AMT: 0.18,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-autowah',
    name: 'Auto-Wah Funk',
    description: 'Snappy envelope + velocity sweep with phaser depth accent',
    patch: {
      LFO1_RATE: 1.6, LFO1_WAVE: 0, LFO2_RATE: 0.5, LFO2_WAVE: 1,
      MOD1_SRC: 3, MOD1_DST: 1, MOD1_AMT: 0.54,
      MOD2_SRC: 5, MOD2_DST: 1, MOD2_AMT: 0.48,
      MOD3_SRC: 1, MOD3_DST: 9, MOD3_AMT: 0.52,
      MOD4_SRC: 5, MOD4_DST: 2, MOD4_AMT: 0.25,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-space-throw',
    name: 'Space Delay Throw',
    description: 'Velocity throws extra signal into Tape Delay & sweeps Filter FX',
    patch: {
      LFO1_RATE: 0.22, LFO1_WAVE: 0, LFO2_RATE: 0.14, LFO2_WAVE: 1,
      MOD1_SRC: 5, MOD1_DST: 10, MOD1_AMT: 0.52,
      MOD2_SRC: 3, MOD2_DST: 8, MOD2_AMT: 0.46,
      MOD3_SRC: 1, MOD3_DST: 7, MOD3_AMT: 0.58,
      MOD4_SRC: 2, MOD4_DST: 1, MOD4_AMT: 0.26,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
  {
    id: 'mod-clear',
    name: 'Clear Matrix',
    description: 'Disable all 6 modulation routings',
    patch: {
      MOD1_SRC: 0, MOD1_DST: 0, MOD1_AMT: 0,
      MOD2_SRC: 0, MOD2_DST: 0, MOD2_AMT: 0,
      MOD3_SRC: 0, MOD3_DST: 0, MOD3_AMT: 0,
      MOD4_SRC: 0, MOD4_DST: 0, MOD4_AMT: 0,
      MOD5_SRC: 0, MOD5_DST: 0, MOD5_AMT: 0,
      MOD6_SRC: 0, MOD6_DST: 0, MOD6_AMT: 0,
    },
  },
];

export const PARAM_SPECS: Record<ParamID, ParamSpec> = {
  OSC1_RANGE: { id: 'OSC1_RANGE', label: 'Osc 1 Range', shortLabel: 'Range', min: 0, max: 4, step: 1, skew: 1, def: 2, choices: RANGE_LABELS },
  OSC2_RANGE: { id: 'OSC2_RANGE', label: 'Osc 2 Range', shortLabel: 'Range', min: 0, max: 4, step: 1, skew: 1, def: 2, choices: RANGE_LABELS },
  OSC3_RANGE: { id: 'OSC3_RANGE', label: 'Osc 3 Range', shortLabel: 'Range', min: 0, max: 4, step: 1, skew: 1, def: 1, choices: RANGE_LABELS },
  OSC1_WAVE:  { id: 'OSC1_WAVE',  label: 'Osc 1 Wave',  shortLabel: 'Wave',  min: 0, max: 3, step: 1, skew: 1, def: 1, choices: WAVE_LABELS },
  OSC2_WAVE:  { id: 'OSC2_WAVE',  label: 'Osc 2 Wave',  shortLabel: 'Wave',  min: 0, max: 3, step: 1, skew: 1, def: 1, choices: WAVE_LABELS },
  OSC3_WAVE:  { id: 'OSC3_WAVE',  label: 'Osc 3 Wave',  shortLabel: 'Wave',  min: 0, max: 3, step: 1, skew: 1, def: 2, choices: WAVE_LABELS },
  OSC2_FREQ:  { id: 'OSC2_FREQ',  label: 'Osc 2 Fine',  shortLabel: 'Fine',  min: -100, max: 100, step: 0.1, skew: 1, def: 6, unit: 'ct' },
  OSC3_FREQ:  { id: 'OSC3_FREQ',  label: 'Osc 3 Fine',  shortLabel: 'Fine',  min: -100, max: 100, step: 0.1, skew: 1, def: -5, unit: 'ct' },

  MIX_OSC1:   { id: 'MIX_OSC1',   label: 'Osc 1 Level', shortLabel: 'Osc 1', min: 0, max: 1, step: 0, skew: 1, def: 0.8 },
  MIX_OSC2:   { id: 'MIX_OSC2',   label: 'Osc 2 Level', shortLabel: 'Osc 2', min: 0, max: 1, step: 0, skew: 1, def: 0.6 },
  MIX_OSC3:   { id: 'MIX_OSC3',   label: 'Osc 3 Level', shortLabel: 'Osc 3', min: 0, max: 1, step: 0, skew: 1, def: 0.5 },
  MIX_NOISE:  { id: 'MIX_NOISE',  label: 'Noise Level', shortLabel: 'Noise', min: 0, max: 1, step: 0, skew: 1, def: 0 },

  FILTER_CUTOFF:   { id: 'FILTER_CUTOFF',   label: 'Filter Cutoff',     shortLabel: 'Cutoff',   min: 20, max: 20000, step: 0, skew: 0.3, def: 1800, unit: 'Hz' },
  FILTER_RES:      { id: 'FILTER_RES',      label: 'Filter Resonance',  shortLabel: 'Res',      min: 0, max: 1, step: 0, skew: 1, def: 0.25 },
  FILTER_DRIVE:    { id: 'FILTER_DRIVE',    label: 'Filter Drive',      shortLabel: 'Drive',    min: 0, max: 1, step: 0, skew: 1, def: 0.3 },
  FILTER_ENV:      { id: 'FILTER_ENV',      label: 'Filter Env Amount', shortLabel: 'Contour',  min: 0, max: 1, step: 0, skew: 1, def: 0.5 },
  FILTER_KEYTRACK: { id: 'FILTER_KEYTRACK', label: 'Filter Key Track',  shortLabel: 'Keytrack', min: 0, max: 1, step: 0, skew: 1, def: 0.5 },

  FENV_ATTACK:  { id: 'FENV_ATTACK',  label: 'Filter Attack',  shortLabel: 'Atk', min: 0.001, max: 8, step: 0, skew: 0.35, def: 0.005, unit: 's' },
  FENV_DECAY:   { id: 'FENV_DECAY',   label: 'Filter Decay',   shortLabel: 'Dec', min: 0.001, max: 8, step: 0, skew: 0.35, def: 0.4,   unit: 's' },
  FENV_SUSTAIN: { id: 'FENV_SUSTAIN', label: 'Filter Sustain', shortLabel: 'Sus', min: 0,     max: 1, step: 0, skew: 1,    def: 0.3 },
  FENV_RELEASE: { id: 'FENV_RELEASE', label: 'Filter Release', shortLabel: 'Rel', min: 0.001, max: 8, step: 0, skew: 0.35, def: 0.3,   unit: 's' },

  AENV_ATTACK:  { id: 'AENV_ATTACK',  label: 'Amp Attack',  shortLabel: 'Atk', min: 0.001, max: 8, step: 0, skew: 0.35, def: 0.005, unit: 's' },
  AENV_DECAY:   { id: 'AENV_DECAY',   label: 'Amp Decay',   shortLabel: 'Dec', min: 0.001, max: 8, step: 0, skew: 0.35, def: 0.3,   unit: 's' },
  AENV_SUSTAIN: { id: 'AENV_SUSTAIN', label: 'Amp Sustain', shortLabel: 'Sus', min: 0,     max: 1, step: 0, skew: 1,    def: 0.8 },
  AENV_RELEASE: { id: 'AENV_RELEASE', label: 'Amp Release', shortLabel: 'Rel', min: 0.001, max: 8, step: 0, skew: 0.35, def: 0.25,  unit: 's' },

  ANALOG_DRIFT:  { id: 'ANALOG_DRIFT',  label: 'Analog Drift',  shortLabel: 'Drift',  min: 0, max: 1, step: 0, skew: 1, def: 0.3 },
  MASTER_VOLUME: { id: 'MASTER_VOLUME', label: 'Master Volume', shortLabel: 'Master', min: 0, max: 1, step: 0, skew: 1, def: 0.7 },

  TRANSPOSE:    { id: 'TRANSPOSE',    label: 'Master Transpose', shortLabel: 'Trans',  min: -24, max: 24,  step: 1,   skew: 1,    def: 0,   unit: 'st' },
  VOICE_COUNT:  { id: 'VOICE_COUNT',  label: 'Voice Polyphony',  shortLabel: 'Voices', min: 1,   max: 8,   step: 1,   skew: 1,    def: 8,   unit: 'v' },
  PITCH_OFFSET: { id: 'PITCH_OFFSET', label: 'Pitch Offset',     shortLabel: 'Pitch',  min: -12, max: 12,  step: 0.1, skew: 1,    def: 0,   unit: 'st' },
  FINE_TUNE:    { id: 'FINE_TUNE',    label: 'Master Fine Tune', shortLabel: 'Tune',   min: -100,max: 100, step: 0.5, skew: 1,    def: 0,   unit: 'ct' },
  LEGATO:       { id: 'LEGATO',       label: 'Legato Feel',      shortLabel: 'Legato', min: 0,   max: 1,   step: 0,   skew: 1,    def: 0.25 },
  GLIDE_TIME:   { id: 'GLIDE_TIME',   label: 'Portamento Glide', shortLabel: 'Glide',  min: 0,   max: 1.5, step: 0,   skew: 0.45, def: 0.04, unit: 's' },

  FX_DELAY_ON:       { id: 'FX_DELAY_ON',       label: 'Delay Power',     shortLabel: 'Delay',    min: 0,    max: 1,   step: 1, skew: 1,   def: 0 },
  FX_DELAY_MIX:      { id: 'FX_DELAY_MIX',      label: 'Delay Mix',       shortLabel: 'Mix',      min: 0,    max: 1,   step: 0, skew: 1,   def: 0.28 },
  FX_DELAY_TIME:     { id: 'FX_DELAY_TIME',     label: 'Delay Time',      shortLabel: 'Time',     min: 0.04, max: 0.85,step: 0, skew: 0.6, def: 0.34, unit: 's' },
  FX_DELAY_FEEDBACK: { id: 'FX_DELAY_FEEDBACK', label: 'Delay Feedback',  shortLabel: 'Feedback', min: 0,    max: 0.88,step: 0, skew: 1,   def: 0.44 },
  FX_DELAY_TONE:     { id: 'FX_DELAY_TONE',     label: 'Delay Tone',      shortLabel: 'Damp',     min: 0,    max: 1,   step: 0, skew: 1,   def: 0.62 },

  FX_REVERB_ON:      { id: 'FX_REVERB_ON',      label: 'Reverb Power',    shortLabel: 'Reverb',   min: 0,    max: 1,   step: 1, skew: 1,   def: 0 },
  FX_REVERB_MIX:     { id: 'FX_REVERB_MIX',     label: 'Reverb Mix',      shortLabel: 'Mix',      min: 0,    max: 1,   step: 0, skew: 1,   def: 0.3 },
  FX_REVERB_SIZE:    { id: 'FX_REVERB_SIZE',    label: 'Reverb Size',     shortLabel: 'Size',     min: 0.1,  max: 1,   step: 0, skew: 1,   def: 0.55 },
  FX_REVERB_DAMP:    { id: 'FX_REVERB_DAMP',    label: 'Reverb Damping',  shortLabel: 'Damp',     min: 0,    max: 1,   step: 0, skew: 1,   def: 0.55 },

  FX_PHASER_ON:      { id: 'FX_PHASER_ON',      label: 'Phaser Power',    shortLabel: 'Phaser',   min: 0,    max: 1,   step: 1, skew: 1,   def: 0 },
  FX_PHASER_MIX:     { id: 'FX_PHASER_MIX',     label: 'Phaser Mix',      shortLabel: 'Mix',      min: 0,    max: 1,   step: 0, skew: 1,   def: 0.45 },
  FX_PHASER_RATE:    { id: 'FX_PHASER_RATE',    label: 'Phaser Rate',     shortLabel: 'Rate',     min: 0.08, max: 5,   step: 0, skew: 0.5, def: 0.65, unit: 'Hz' },
  FX_PHASER_DEPTH:   { id: 'FX_PHASER_DEPTH',   label: 'Phaser Depth',    shortLabel: 'Depth',    min: 0,    max: 1,   step: 0, skew: 1,   def: 0.7 },
  FX_PHASER_FB:      { id: 'FX_PHASER_FB',      label: 'Phaser Feedback', shortLabel: 'Res',      min: 0,    max: 0.85,step: 0, skew: 1,   def: 0.35 },

  FX_FLANGER_ON:     { id: 'FX_FLANGER_ON',     label: 'Flanger Power',   shortLabel: 'Flange',   min: 0,    max: 1,   step: 1, skew: 1,   def: 0 },
  FX_FLANGER_MIX:    { id: 'FX_FLANGER_MIX',    label: 'Flanger Mix',     shortLabel: 'Mix',      min: 0,    max: 1,   step: 0, skew: 1,   def: 0.42 },
  FX_FLANGER_DEPTH:  { id: 'FX_FLANGER_DEPTH',  label: 'Flanger Depth',   shortLabel: 'Depth',    min: 0,    max: 1,   step: 0, skew: 1,   def: 0.5 },
  FX_FLANGER_RATE:   { id: 'FX_FLANGER_RATE',   label: 'Flanger Rate',    shortLabel: 'Rate',     min: 0.05, max: 4,   step: 0, skew: 0.5, def: 0.35, unit: 'Hz' },
  FX_FLANGER_FB:     { id: 'FX_FLANGER_FB',     label: 'Flanger Feedback',shortLabel: 'Res',      min: 0,    max: 0.85,step: 0, skew: 1,   def: 0.42 },

  FX_SAT_ON:         { id: 'FX_SAT_ON',         label: 'Saturation Power',shortLabel: 'Sat',      min: 0,    max: 1,   step: 1, skew: 1,   def: 0 },
  FX_SAT_DRIVE:      { id: 'FX_SAT_DRIVE',      label: 'Saturation Drive',shortLabel: 'Drive',    min: 0,    max: 1,   step: 0, skew: 1,   def: 0.42 },
  FX_SAT_TONE:       { id: 'FX_SAT_TONE',       label: 'Saturation Tone', shortLabel: 'Tone',     min: 0,    max: 1,   step: 0, skew: 1,   def: 0.65 },
  FX_SAT_MIX:        { id: 'FX_SAT_MIX',        label: 'Saturation Mix',  shortLabel: 'Mix',      min: 0,    max: 1,   step: 0, skew: 1,   def: 0.85 },
  FX_SAT_MODE:       { id: 'FX_SAT_MODE',       label: 'Saturation Mode', shortLabel: 'Type',     min: 0,    max: 3,   step: 1, skew: 1,   def: 0, choices: SAT_MODE_LABELS },

  FX_FILTER_ON:      { id: 'FX_FILTER_ON',      label: 'Filter FX Power', shortLabel: 'FilterFX', min: 0,    max: 1,   step: 1, skew: 1,   def: 0 },
  FX_FILTER_TYPE:    { id: 'FX_FILTER_TYPE',    label: 'Classic Filter',  shortLabel: 'Model',    min: 0,    max: 4,   step: 1, skew: 1,   def: 0, choices: CLASSIC_FILTER_LABELS },
  FX_FILTER_CUTOFF:  { id: 'FX_FILTER_CUTOFF',  label: 'FX Filter Cutoff',shortLabel: 'Cutoff',   min: 40,   max: 18000,step: 0,skew: 0.3, def: 2600, unit: 'Hz' },
  FX_FILTER_LP:      { id: 'FX_FILTER_LP',      label: 'FX Low-Pass Freq',shortLabel: 'LP',       min: 60,   max: 18000,step: 0,skew: 0.3, def: 14000, unit: 'Hz' },
  FX_FILTER_HP:      { id: 'FX_FILTER_HP',      label: 'FX High-Pass Freq',shortLabel:'HP',       min: 20,   max: 8000, step: 0,skew: 0.32,def: 28, unit: 'Hz' },
  FX_FILTER_RES:     { id: 'FX_FILTER_RES',     label: 'FX Filter Res',   shortLabel: 'Res',      min: 0,    max: 1,   step: 0, skew: 1,   def: 0.36 },
  FX_FILTER_DRIVE:   { id: 'FX_FILTER_DRIVE',   label: 'FX Filter Drive', shortLabel: 'Drive',    min: 0,    max: 1,   step: 0, skew: 1,   def: 0.25 },
  FX_FILTER_MIX:     { id: 'FX_FILTER_MIX',     label: 'FX Filter Mix',   shortLabel: 'Mix',      min: 0,    max: 1,   step: 0, skew: 1,   def: 1.0 },

  LFO1_RATE: { id: 'LFO1_RATE', label: 'LFO 1 Rate', shortLabel: 'Rate', min: 0.05, max: 18, step: 0, skew: 0.45, def: 2.2, unit: 'Hz' },
  LFO1_WAVE: { id: 'LFO1_WAVE', label: 'LFO 1 Wave', shortLabel: 'Wave', min: 0, max: 4, step: 1, skew: 1, def: 0, choices: LFO_WAVE_LABELS },
  LFO2_RATE: { id: 'LFO2_RATE', label: 'LFO 2 Rate', shortLabel: 'Rate', min: 0.05, max: 18, step: 0, skew: 0.45, def: 0.45, unit: 'Hz' },
  LFO2_WAVE: { id: 'LFO2_WAVE', label: 'LFO 2 Wave', shortLabel: 'Wave', min: 0, max: 4, step: 1, skew: 1, def: 1, choices: LFO_WAVE_LABELS },

  MOD1_SRC: { id: 'MOD1_SRC', label: 'Mod 1 Source', shortLabel: 'Src', min: 0, max: 8, step: 1, skew: 1, def: 0, choices: MOD_SOURCE_LABELS },
  MOD1_DST: { id: 'MOD1_DST', label: 'Mod 1 Dest',   shortLabel: 'Dst', min: 0, max: 10,step: 1, skew: 1, def: 0, choices: MOD_DEST_LABELS },
  MOD1_AMT: { id: 'MOD1_AMT', label: 'Mod 1 Depth',  shortLabel: 'Amt', min: -1,max: 1, step: 0, skew: 1, def: 0 },

  MOD2_SRC: { id: 'MOD2_SRC', label: 'Mod 2 Source', shortLabel: 'Src', min: 0, max: 8, step: 1, skew: 1, def: 0, choices: MOD_SOURCE_LABELS },
  MOD2_DST: { id: 'MOD2_DST', label: 'Mod 2 Dest',   shortLabel: 'Dst', min: 0, max: 10,step: 1, skew: 1, def: 0, choices: MOD_DEST_LABELS },
  MOD2_AMT: { id: 'MOD2_AMT', label: 'Mod 2 Depth',  shortLabel: 'Amt', min: -1,max: 1, step: 0, skew: 1, def: 0 },

  MOD3_SRC: { id: 'MOD3_SRC', label: 'Mod 3 Source', shortLabel: 'Src', min: 0, max: 8, step: 1, skew: 1, def: 0, choices: MOD_SOURCE_LABELS },
  MOD3_DST: { id: 'MOD3_DST', label: 'Mod 3 Dest',   shortLabel: 'Dst', min: 0, max: 10,step: 1, skew: 1, def: 0, choices: MOD_DEST_LABELS },
  MOD3_AMT: { id: 'MOD3_AMT', label: 'Mod 3 Depth',  shortLabel: 'Amt', min: -1,max: 1, step: 0, skew: 1, def: 0 },

  MOD4_SRC: { id: 'MOD4_SRC', label: 'Mod 4 Source', shortLabel: 'Src', min: 0, max: 8, step: 1, skew: 1, def: 0, choices: MOD_SOURCE_LABELS },
  MOD4_DST: { id: 'MOD4_DST', label: 'Mod 4 Dest',   shortLabel: 'Dst', min: 0, max: 10,step: 1, skew: 1, def: 0, choices: MOD_DEST_LABELS },
  MOD4_AMT: { id: 'MOD4_AMT', label: 'Mod 4 Depth',  shortLabel: 'Amt', min: -1,max: 1, step: 0, skew: 1, def: 0 },

  MOD5_SRC: { id: 'MOD5_SRC', label: 'Mod 5 Source', shortLabel: 'Src', min: 0, max: 8, step: 1, skew: 1, def: 0, choices: MOD_SOURCE_LABELS },
  MOD5_DST: { id: 'MOD5_DST', label: 'Mod 5 Dest',   shortLabel: 'Dst', min: 0, max: 10,step: 1, skew: 1, def: 0, choices: MOD_DEST_LABELS },
  MOD5_AMT: { id: 'MOD5_AMT', label: 'Mod 5 Depth',  shortLabel: 'Amt', min: -1,max: 1, step: 0, skew: 1, def: 0 },

  MOD6_SRC: { id: 'MOD6_SRC', label: 'Mod 6 Source', shortLabel: 'Src', min: 0, max: 8, step: 1, skew: 1, def: 0, choices: MOD_SOURCE_LABELS },
  MOD6_DST: { id: 'MOD6_DST', label: 'Mod 6 Dest',   shortLabel: 'Dst', min: 0, max: 10,step: 1, skew: 1, def: 0, choices: MOD_DEST_LABELS },
  MOD6_AMT: { id: 'MOD6_AMT', label: 'Mod 6 Depth',  shortLabel: 'Amt', min: -1,max: 1, step: 0, skew: 1, def: 0 },
};

export const ALL_PARAM_IDS = Object.keys(PARAM_SPECS) as ParamID[];

export function getDefaultParams(): ParamState {
  const out = {} as ParamState;
  for (const id of ALL_PARAM_IDS) {
    out[id] = PARAM_SPECS[id].def;
  }
  return out;
}

export function valueToNorm(id: ParamID, value: number): number {
  const s = PARAM_SPECS[id];
  const clamped = Math.min(s.max, Math.max(s.min, value));
  const linear = (clamped - s.min) / (s.max - s.min);
  if (s.skew === 1) return linear;
  return Math.pow(linear, s.skew);
}

export function normToValue(id: ParamID, norm: number): number {
  const s = PARAM_SPECS[id];
  const n = Math.min(1, Math.max(0, norm));
  const skewed = s.skew === 1 ? n : Math.pow(n, 1 / s.skew);
  let val = s.min + skewed * (s.max - s.min);
  if (s.step > 0) {
    val = Math.round((val - s.min) / s.step) * s.step + s.min;
    val = Number(val.toFixed(4));
  }
  return Math.min(s.max, Math.max(s.min, val));
}

export function formatParamValue(id: ParamID, value: number): string {
  const spec = PARAM_SPECS[id];
  if (spec.choices) {
    const idx = Math.min(spec.choices.length - 1, Math.max(0, Math.round(value)));
    return spec.choices[idx];
  }
  if (
    id === 'FILTER_CUTOFF' ||
    id === 'FX_FILTER_CUTOFF' ||
    id === 'FX_FILTER_LP' ||
    id === 'FX_FILTER_HP'
  ) {
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} kHz`;
    return `${Math.round(value)} Hz`;
  }
  if (
    id === 'FX_PHASER_RATE' ||
    id === 'FX_FLANGER_RATE' ||
    id === 'LFO1_RATE' ||
    id === 'LFO2_RATE'
  ) {
    return `${value.toFixed(2)} Hz`;
  }
  if (spec.unit === 'st') {
    const rounded = spec.step >= 1 ? Math.round(value) : Number(value.toFixed(1));
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded} st`;
  }
  if (spec.unit === 'v') {
    const v = Math.round(value);
    return v === 1 ? 'Mono' : `${v} Voices`;
  }
  if (spec.unit === 'ct') {
    const sign = value > 0.05 ? '+' : '';
    return `${sign}${value.toFixed(1)} ct`;
  }
  if (spec.unit === 's') {
    if (value < 0.002 && id === 'GLIDE_TIME') return 'Off';
    if (value < 1) return `${Math.round(value * 1000)} ms`;
    return `${value.toFixed(2)} s`;
  }
  if (id === 'LEGATO') {
    if (value < 0.2) return 'Poly';
    if (value < 0.6) return 'Soft';
    return 'Legato';
  }
  const pct = Math.round(value * 100);
  return spec.min < 0 && pct > 0 ? `+${pct}%` : `${pct}%`;
}
