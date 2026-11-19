import { ParamState, getDefaultParams } from './parameters';

export interface SynthTelemetry {
  rms: number;
  peak: number;
  filterEnv: number;
  ampEnv: number;
  lfo1: number;
  lfo2: number;
  activeVoices: number;
  waveform: Float32Array;
  spectrum: Uint8Array;
}

const WORKLET_PROCESSOR_CODE = `
const MAX_VOICES = 8;
const CONTROL_RATE = 16;
const PI = Math.PI;

class Rng {
  constructor(seed = 0x9E3779B9) { this.s = seed >>> 0 || 1; }
  seed(v) { this.s = (v >>> 0) || 1; }
  next01() {
    let s = this.s;
    s ^= (s << 13) >>> 0;
    s ^= (s >>> 17) >>> 0;
    s ^= (s << 5) >>> 0;
    this.s = s >>> 0;
    return (this.s >>> 8) / 16777216.0;
  }
  nextBi() { return this.next01() * 2 - 1; }
}

class Lfo {
  constructor(seed = 0x517cc1b7) {
    this.phase = 0;
    this.shVal = 0;
    this.rng = new Rng(seed);
  }
  tick(rateHz, wave, dtControl) {
    const prev = this.phase;
    this.phase += Math.max(0.01, rateHz) * dtControl;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      this.shVal = this.rng.nextBi();
    }
    const p = this.phase;
    if (wave === 0) return Math.sin(p * PI * 2);
    if (wave === 1) return p < 0.25 ? p * 4 : p < 0.75 ? 2 - p * 4 : p * 4 - 4;
    if (wave === 2) return p * 2 - 1;
    if (wave === 3) return p < 0.5 ? 1 : -1;
    return this.shVal;
  }
}

class Drift {
  constructor() { this.v = 0; this.target = 0; this.coef = 0; this.count = 0; this.period = 1; }
  prepare(fs, seconds, r) {
    this.period = Math.max(1, Math.floor((fs * seconds) / CONTROL_RATE));
    this.coef = 1 - Math.exp(-1 / (0.5 * this.period));
    this.v = this.target = r.nextBi();
    this.count = 0;
  }
  tick(r) {
    if (--this.count <= 0) { this.target = r.nextBi(); this.count = this.period; }
    this.v += (this.target - this.v) * this.coef;
    return this.v;
  }
}

function polyBlep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

class Osc {
  constructor() { this.phase = 0; this.tri = 0; }
  reset(startPhase) {
    this.phase = startPhase;
    this.tri = startPhase < 0.5 ? -1 + 4 * startPhase : 3 - 4 * startPhase;
  }
  next(dt, wave) {
    let out = 0;
    const t = this.phase;
    if (wave === 1) {
      out = 2 * t - 1 - polyBlep(t, dt);
    } else if (wave === 2 || wave === 0) {
      let sq = t < 0.5 ? 1 : -1;
      let p2 = t + 0.5;
      p2 -= Math.floor(p2);
      sq += polyBlep(t, dt) - polyBlep(p2, dt);
      if (wave === 2) {
        out = sq;
      } else {
        this.tri = this.tri * 0.9999 + 4 * dt * sq;
        out = this.tri;
      }
    } else {
      const w = 0.25;
      let p2 = t + 1 - w;
      p2 -= Math.floor(p2);
      out = (t < w ? 1 : -1) + polyBlep(t, dt) - polyBlep(p2, dt);
      out -= (2 * w - 1);
      out *= 2 / 3;
    }
    this.phase += dt;
    if (this.phase >= 1) this.phase -= 1;
    return out;
  }
}

class Ladder {
  constructor() { this.reset(); }
  reset() {
    this.s0 = 0; this.s1 = 0; this.s2 = 0; this.s3 = 0;
    this.t0 = 0; this.t1 = 0; this.t2 = 0; this.t3 = 0;
    this.prevIn = 0; this.g = 0.1; this.k = 0; this.drv = 1; this.makeup = 1;
  }
  set(cutoffHz, res, drive, fs) {
    const fc = Math.min(cutoffHz, 0.45 * fs);
    this.g = 1 - Math.exp((-2 * PI * fc) / (2 * fs));
    this.k = 4.3 * Math.min(1, Math.max(0, res));
    this.drv = 1 + 5 * Math.min(1, Math.max(0, drive));
    this.makeup = (1 + 0.6 * this.k) / Math.sqrt(this.drv);
  }
  process(x) {
    let acc = 0;
    const g = this.g, k = this.k, drv = this.drv;
    const asym = (drv > 1.05) ? (drv - 1) * 0.035 : 0;
    for (let i = 0; i < 2; i++) {
      const u = i === 0 ? 0.5 * (this.prevIn + x) : x;
      const inSignal = drv * u - k * this.s3;
      const x0 = Math.tanh(inSignal) + asym * (inSignal * inSignal / (1 + inSignal * inSignal));
      this.s0 += g * (x0 - this.t0); this.t0 = Math.tanh(this.s0);
      this.s1 += g * (this.t0 - this.t1); this.t1 = Math.tanh(this.s1);
      this.s2 += g * (this.t1 - this.t2); this.t2 = Math.tanh(this.s2);
      this.s3 += g * (this.t2 - this.t3); this.t3 = Math.tanh(this.s3);
      acc += this.s3;
    }
    this.prevIn = x;
    return 0.5 * acc * this.makeup;
  }
}

class Env {
  constructor() { this.stage = 0; this.lvl = 0; }
  reset() { this.stage = 0; this.lvl = 0; }
  gateOn() { this.stage = 1; }
  gateOff() { if (this.stage !== 0) this.stage = 4; }
  idle() { return this.stage === 0; }
  tick(c, atkCoef) {
    switch (this.stage) {
      case 0: this.lvl = 0; break;
      case 1:
        this.lvl += (1.2 - this.lvl) * (1 - atkCoef);
        if (this.lvl >= 1) { this.lvl = 1; this.stage = 2; }
        break;
      case 2:
        this.lvl = c.sus + (this.lvl - c.sus) * c.dec;
        if (this.lvl - c.sus < 1e-4) { this.lvl = c.sus; this.stage = 3; }
        break;
      case 3: this.lvl = c.sus; break;
      case 4:
        this.lvl *= c.rel;
        if (this.lvl < 1e-4) { this.lvl = 0; this.stage = 0; }
        break;
    }
    return this.lvl;
  }
}

function makeEnv(a, d, s, r, fs) {
  const sec = x => Math.max(x, 0.001);
  return {
    atk: Math.exp(-1.79 / (sec(a) * fs)),
    dec: Math.exp(-3.0 / (sec(d) * fs)),
    rel: Math.exp(-3.0 / (sec(r) * fs)),
    sus: Math.min(1, Math.max(0, s))
  };
}

class Voice {
  constructor() {
    this.active = false; this.gate = false; this.held = false;
    this.note = 60; this.curNote = 60; this.vel = 1; this.age = 0;
    this.osc = [new Osc(), new Osc(), new Osc()];
    this.pitchDrift = [new Drift(), new Drift(), new Drift()];
    this.cutDrift = new Drift();
    this.fenv = new Env(); this.aenv = new Env();
    this.lad = new Ladder(); this.rng = new Rng();
    this.staticCents = [0, 0, 0]; this.staticCut = 0;
    this.fAtk = 0.9; this.aAtk = 0.9; this.atkScale = 1; this.panL = 1; this.panR = 1;
    this.basePan = 0;
    this.dt = [0, 0, 0]; this.fenvVal = 0; this.aenvVal = 0;
  }
  start(n, startNote, v, a, p, fc, ac, fs, seed, legatoGlide) {
    this.note = n;
    this.vel = v;
    this.age = a;
    if (legatoGlide && this.active) {
      this.gate = true;
      this.held = false;
      return;
    }
    this.rng.seed(seed);
    this.active = true; this.gate = true; this.held = false;
    this.curNote = startNote;
    for (let i = 0; i < 3; i++) {
      this.osc[i].reset(this.rng.next01());
      this.pitchDrift[i].prepare(fs, 0.6 + 0.8 * this.rng.next01(), this.rng);
      this.staticCents[i] = this.rng.nextBi() * (1 + 5 * p.ANALOG_DRIFT);
    }
    this.cutDrift.prepare(fs, 1.2, this.rng);
    this.staticCut = this.rng.nextBi() * (3 + 25 * p.ANALOG_DRIFT);
    this.atkScale = 1 + this.rng.nextBi() * 0.25 * p.ANALOG_DRIFT;
    this.fAtk = Math.exp(Math.log(fc.atk) / this.atkScale);
    this.aAtk = Math.exp(Math.log(ac.atk) / this.atkScale);
    this.basePan = this.rng.nextBi() * 0.6 * p.ANALOG_DRIFT;
    this.panL = Math.cos((this.basePan * 0.5 + 0.5) * PI * 0.5) * 1.414;
    this.panR = Math.sin((this.basePan * 0.5 + 0.5) * PI * 0.5) * 1.414;
    // Reuse the per-voice objects: constructing them here allocated on the audio
    // render thread on every note-on (GC pauses → clicks under load).
    this.fenv.reset(); this.aenv.reset();
    this.fenvVal = 0; this.aenvVal = 0;
    this.fenv.gateOn(); this.aenv.gateOn();
    this.lad.reset();
  }
  updateAttackCoefs(fc, ac) {
    this.fAtk = Math.exp(Math.log(fc.atk) / this.atkScale);
    this.aAtk = Math.exp(Math.log(ac.atk) / this.atkScale);
  }
  release() {
    this.gate = false; this.held = false;
    this.fenv.gateOff(); this.aenv.gateOff();
  }
}

class BeastyProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.fs = sampleRate;
    this.voices = Array.from({ length: MAX_VOICES }, () => new Voice());
    this.lfo1 = new Lfo(0x13572468);
    this.lfo2 = new Lfo(0x9abcdef1);
    this.lfo1Val = 0;
    this.lfo2Val = 0;
    this.counter = 0;
    this.seedGen = 12345;
    this.sustainDown = false;
    this.bendSemis = 0;
    this.lastNote = 60;
    this.monoStack = [];
    this.params = null;
    this.fcoef = makeEnv(0.005, 0.4, 0.3, 0.3, this.fs);
    this.acoef = makeEnv(0.005, 0.3, 0.8, 0.25, this.fs);
    this.telemetryCount = 0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === 'params') {
        this.params = msg.params;
        this.fcoef = makeEnv(this.params.FENV_ATTACK, this.params.FENV_DECAY, this.params.FENV_SUSTAIN, this.params.FENV_RELEASE, this.fs);
        this.acoef = makeEnv(this.params.AENV_ATTACK, this.params.AENV_DECAY, this.params.AENV_SUSTAIN, this.params.AENV_RELEASE, this.fs);
        for (const v of this.voices) {
          if (v.active) v.updateAttackCoefs(this.fcoef, this.acoef);
        }
      } else if (msg.type === 'noteOn') {
        this.noteOn(msg.note, msg.vel ?? 0.85);
      } else if (msg.type === 'noteOff') {
        this.noteOff(msg.note);
      } else if (msg.type === 'bend') {
        this.bendSemis = msg.semis || 0;
      } else if (msg.type === 'sustain') {
        this.sustainDown = !!msg.down;
        if (!this.sustainDown) {
          for (const v of this.voices) if (v.active && v.held) v.release();
        }
      } else if (msg.type === 'allOff') {
        for (const v of this.voices) if (v.active) v.release();
        this.monoStack = [];
        this.sustainDown = false;
      }
    };
  }

  noteOn(note, vel) {
    if (!this.params) return;
    const maxV = Math.max(1, Math.min(MAX_VOICES, Math.round(this.params.VOICE_COUNT ?? 8)));
    const legatoOn = (this.params.LEGATO ?? 0) >= 0.45;
    const glideTime = Math.max(0, this.params.GLIDE_TIME ?? 0);

    if (maxV === 1) {
      this.monoStack = this.monoStack.filter(n => n !== note);
      this.monoStack.push(note);
      const v0 = this.voices[0];
      for (let i = 1; i < MAX_VOICES; i++) {
        if (this.voices[i].active) this.voices[i].release();
      }
      const wasPlaying = v0.active && v0.gate;
      this.seedGen = (this.seedGen * 1664525 + 1013904223) >>> 0;
      const startNote = (glideTime > 0.002) ? (v0.active ? v0.curNote : this.lastNote) : note;
      v0.start(note, startNote, vel, ++this.counter, this.params, this.fcoef, this.acoef, this.fs, this.seedGen, legatoOn && wasPlaying);
      this.lastNote = note;
      return;
    }

    const pool = this.voices.slice(0, maxV);
    for (let i = maxV; i < MAX_VOICES; i++) {
      if (this.voices[i].active && this.voices[i].gate) this.voices[i].release();
    }
    let v = pool.find(c => !c.active);
    if (!v) {
      for (const c of pool) if (!c.gate && (!v || c.age < v.age)) v = c;
      if (!v) {
        v = pool[0];
        for (const c of pool) if (c.age < v.age) v = c;
      }
    }
    this.seedGen = (this.seedGen * 1664525 + 1013904223) >>> 0;
    const startNote = glideTime > 0.002 ? this.lastNote : note;
    v.start(note, startNote, vel, ++this.counter, this.params, this.fcoef, this.acoef, this.fs, this.seedGen, false);
    this.lastNote = note;
  }

  noteOff(note) {
    const maxV = Math.max(1, Math.min(MAX_VOICES, Math.round(this.params?.VOICE_COUNT ?? 8)));
    if (maxV === 1) {
      this.monoStack = this.monoStack.filter(n => n !== note);
      const v0 = this.voices[0];
      if (this.monoStack.length > 0) {
        const prev = this.monoStack[this.monoStack.length - 1];
        v0.note = prev;
        this.lastNote = prev;
        return;
      }
      if (v0.active && v0.gate) {
        if (this.sustainDown) { v0.held = true; v0.gate = false; }
        else v0.release();
      }
      return;
    }

    for (const v of this.voices) {
      if (v.active && v.gate && v.note === note) {
        if (this.sustainDown) { v.held = true; v.gate = false; }
        else v.release();
      }
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < 2 || !this.params) return true;
    const L = out[0], R = out[1];
    const n = L.length;
    L.fill(0); R.fill(0);
    const p = this.params;

    const dtCtrl = CONTROL_RATE / this.fs;
    const lfo1Rate = p.LFO1_RATE ?? 2.2;
    const lfo1Wave = Math.round(p.LFO1_WAVE ?? 0);
    const lfo2Rate = p.LFO2_RATE ?? 0.45;
    const lfo2Wave = Math.round(p.LFO2_WAVE ?? 1);

    const modSlots = [
      [Math.round(p.MOD1_SRC ?? 0), Math.round(p.MOD1_DST ?? 0), p.MOD1_AMT ?? 0],
      [Math.round(p.MOD2_SRC ?? 0), Math.round(p.MOD2_DST ?? 0), p.MOD2_AMT ?? 0],
      [Math.round(p.MOD3_SRC ?? 0), Math.round(p.MOD3_DST ?? 0), p.MOD3_AMT ?? 0],
      [Math.round(p.MOD4_SRC ?? 0), Math.round(p.MOD4_DST ?? 0), p.MOD4_AMT ?? 0],
      [Math.round(p.MOD5_SRC ?? 0), Math.round(p.MOD5_DST ?? 0), p.MOD5_AMT ?? 0],
      [Math.round(p.MOD6_SRC ?? 0), Math.round(p.MOD6_DST ?? 0), p.MOD6_AMT ?? 0],
    ];

    const octs = [Math.round(p.OSC1_RANGE) - 2, Math.round(p.OSC2_RANGE) - 2, Math.round(p.OSC3_RANGE) - 2];
    const waves = [Math.round(p.OSC1_WAVE), Math.round(p.OSC2_WAVE), Math.round(p.OSC3_WAVE)];
    const levels = [p.MIX_OSC1, p.MIX_OSC2, p.MIX_OSC3];
    const fines = [0, p.OSC2_FREQ, p.OSC3_FREQ];

    const globalSemis = (p.TRANSPOSE ?? 0) + (p.PITCH_OFFSET ?? 0);
    const globalCents = p.FINE_TUNE ?? 0;
    const glideTime = Math.max(0, p.GLIDE_TIME ?? 0);
    const glideCoef = glideTime > 0.002
      ? 1 - Math.exp(-CONTROL_RATE / (glideTime * this.fs * 0.42))
      : 1;

    // Advance global LFOs once per audio render block
    for (let pos = 0; pos < n; pos += CONTROL_RATE) {
      this.lfo1Val = this.lfo1.tick(lfo1Rate, lfo1Wave, dtCtrl);
      this.lfo2Val = this.lfo2.tick(lfo2Rate, lfo2Wave, dtCtrl);
    }

    let maxFenv = 0;
    let maxAenv = 0;
    let activeCount = 0;

    for (const v of this.voices) {
      if (!v.active) continue;
      activeCount++;
      for (let pos = 0; pos < n; pos += CONTROL_RATE) {
        const len = Math.min(CONTROL_RATE, n - pos);
        v.curNote += (v.note - v.curNote) * glideCoef;
        const driftTick = v.cutDrift.tick(v.rng);

        // Evaluate Mod Matrix per voice
        let modCut = 0, modRes = 0, modDrv = 0, modPitch = 0, modDetune = 0, modAmp = 0, modPan = 0;
        const keyNorm = (v.curNote - 60) / 36;
        const bendNorm = this.bendSemis / 2;
        for (let m = 0; m < 6; m++) {
          const srcId = modSlots[m][0];
          const dstId = modSlots[m][1];
          const amt = modSlots[m][2];
          if (srcId === 0 || dstId === 0 || Math.abs(amt) < 1e-4) continue;
          let sv = 0;
          if (srcId === 1) sv = this.lfo1Val;
          else if (srcId === 2) sv = this.lfo2Val;
          else if (srcId === 3) sv = v.fenvVal;
          else if (srcId === 4) sv = v.aenvVal;
          else if (srcId === 5) sv = v.vel;
          else if (srcId === 6) sv = keyNorm;
          else if (srcId === 7) sv = driftTick;
          else if (srcId === 8) sv = bendNorm;

          const modVal = sv * amt;
          if (dstId === 1) modCut += modVal * 4.5;
          else if (dstId === 2) modRes += modVal * 0.72;
          else if (dstId === 3) modDrv += modVal * 0.65;
          else if (dstId === 4) modPitch += modVal * 12;
          else if (dstId === 5) modDetune += modVal * 65;
          else if (dstId === 6) modAmp += modVal * 0.8;
          else if (dstId === 7) modPan += modVal * 0.9;
        }

        const panClamped = Math.max(-1, Math.min(1, v.basePan + modPan));
        const pL = Math.cos((panClamped * 0.5 + 0.5) * PI * 0.5) * 1.414;
        const pR = Math.sin((panClamped * 0.5 + 0.5) * PI * 0.5) * 1.414;
        const ampModMul = Math.max(0, Math.min(1.6, 1 + modAmp));

        const pitchCents = 1.5 + 10 * p.ANALOG_DRIFT;
        const microJitter = 1 + 0.00015 * (p.ANALOG_DRIFT ?? 0.3) * v.rng.nextBi();
        for (let o = 0; o < 3; o++) {
          const det = o === 1 ? modDetune : o === 2 ? -modDetune : 0;
          const semis = (v.curNote - 69) + globalSemis + this.bendSemis + modPitch + 12 * octs[o] +
            (fines[o] + det + globalCents + v.staticCents[o] + pitchCents * v.pitchDrift[o].tick(v.rng)) * 0.01;
          v.dt[o] = Math.min((440 * Math.pow(2, semis / 12)) / this.fs * microJitter, 0.45);
        }
        const cutCents = (5 + 40 * p.ANALOG_DRIFT) * driftTick + v.staticCut;
        const cutOcts = p.FILTER_ENV * v.fenvVal * 5 + p.FILTER_KEYTRACK * ((v.curNote - 60) / 12) + cutCents / 1200 + modCut;
        const cutoff = Math.min(20000, Math.max(20, p.FILTER_CUTOFF * Math.pow(2, cutOcts)));
        const resVal = Math.min(1, Math.max(0, p.FILTER_RES + modRes));
        const drvVal = Math.min(1, Math.max(0, p.FILTER_DRIVE + modDrv));
        v.lad.set(cutoff, resVal, drvVal, this.fs);

        for (let i = 0; i < len; i++) {
          let mix = v.osc[0].next(v.dt[0], waves[0]) * levels[0]
                  + v.osc[1].next(v.dt[1], waves[1]) * levels[1]
                  + v.osc[2].next(v.dt[2], waves[2]) * levels[2];
          mix += v.rng.nextBi() * p.MIX_NOISE;
          mix *= 0.4;

          v.fenvVal = v.fenv.tick(this.fcoef, v.fAtk);
          v.aenvVal = v.aenv.tick(this.acoef, v.aAtk);
          const amp = v.aenvVal * v.vel * ampModMul;
          const y = v.lad.process(mix) * amp;
          L[pos + i] += y * pL;
          R[pos + i] += y * pR;
        }
        if (v.fenvVal > maxFenv) maxFenv = v.fenvVal;
        if (v.aenvVal > maxAenv) maxAenv = v.aenvVal;
        if (v.aenv.idle()) { v.active = false; break; }
      }
    }

    const master = p.MASTER_VOLUME * 1.5;
    for (let i = 0; i < n; i++) {
      L[i] = Math.tanh(L[i] * master);
      R[i] = Math.tanh(R[i] * master);
    }

    if (++this.telemetryCount >= 4) {
      this.telemetryCount = 0;
      this.port.postMessage({
        type: 'telemetry',
        fenv: maxFenv,
        aenv: maxAenv,
        lfo1: this.lfo1Val,
        lfo2: this.lfo2Val,
        voices: activeCount,
      });
    }
    return true;
  }
}

registerProcessor('beasty-synth-processor', BeastyProcessor);
`;

function makeSaturationCurve(drive: number, mode = 0): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buf = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buf);
  // Curve order follows SAT_MODE_LABELS (and MiniSynth's FxSaturation):
  //   0 Tape, 1 Tube, 2 Fuzz, 3 Overdrive.
  const d = Math.min(1, Math.max(0, drive));
  const k = 1 + d * (mode === 1 ? 16 : mode === 2 ? 22 : mode === 3 ? 12 : 10);
  const norm = 1 / Math.tanh(mode === 2 ? k * 1.5 : k);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    const xd = x * k;
    if (mode === 1) {
      // Tube: asymmetric triode with 2nd-harmonic bloom
      const pos = xd > 0 ? Math.tanh(xd) : Math.tanh(xd * 1.25) * 0.82;
      curve[i] = (pos + 0.07 * (xd * xd) / (1 + xd * xd)) * norm;
    } else if (mode === 2) {
      // Fuzz: class-A bias offset into a hard tanh knee
      const b = (x + 0.12 * d) * k * 1.5;
      curve[i] = (Math.tanh(b) - 0.08 * d) * norm;
    } else if (mode === 3) {
      // Overdrive: hard-knee clipper (strong odd harmonics)
      const ax = Math.abs(xd);
      const knee = 0.55;
      const y = ax <= knee ? xd : Math.sign(xd) * (knee + (1 - knee) * Math.tanh((ax - knee) / (1 - knee)));
      curve[i] = y * norm;
    } else {
      // Tape: symmetric magnetic soft saturation
      curve[i] = (xd / Math.sqrt(1 + xd * xd)) * norm;
    }
  }
  return curve;
}

function makeReverbImpulse(ctx: AudioContext, seconds = 2.8, decay = 2.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    // Early reflection taps for acoustic spatial dimension
    const erDelays = ch === 0 ? [0.012, 0.023, 0.038, 0.057, 0.082] : [0.015, 0.027, 0.041, 0.063, 0.089];
    const erGains = [0.75, -0.6, 0.48, -0.38, 0.28];
    for (let e = 0; e < erDelays.length; e++) {
      const idx = Math.floor(erDelays[e] * rate);
      if (idx < len) data[idx] = erGains[e] * 0.65;
    }
    // Keep the wet energy roughly constant when Size lengthens the tail
    const energyTrim = Math.sqrt(2.8 / Math.max(0.3, seconds));
    // Lush diffuse late tail with frequency-dependent absorption
    for (let i = 0; i < len; i++) {
      const tNorm = i / len;
      const env = Math.pow(1 - tNorm, decay);
      const white = Math.random() * 2 - 1;
      const damp = 0.58 + 0.38 * tNorm; // progressive high-frequency air absorption
      lp = lp * damp + white * (1 - damp);
      data[i] += lp * env * 0.52 * energyTrim;
    }
  }
  return impulse;
}

interface FxGraph {
  satDry: GainNode;
  satWet: GainNode;
  satShaper: WaveShaperNode;
  satTone: BiquadFilterNode;

  fltDry: GainNode;
  fltWet: GainNode;
  fltShaper: WaveShaperNode;
  fltHp: BiquadFilterNode;
  fltLp: BiquadFilterNode;
  fltStage1: BiquadFilterNode;
  fltStage2: BiquadFilterNode;

  phaserDry: GainNode;
  phaserWet: GainNode;
  phaserLfo: OscillatorNode;
  phaserLfoGain: GainNode;
  apFilters: BiquadFilterNode[];

  flangerDry: GainNode;
  flangerWet: GainNode;
  flangerLfo: OscillatorNode;
  flangerLfoGain: GainNode;
  flangerFb: GainNode;

  delayDry: GainNode;
  delayWet: GainNode;
  delayNode: DelayNode;
  delayFb: GainNode;
  delayDamp: BiquadFilterNode;

  reverbDry: GainNode;
  reverbWet: GainNode;
  reverbFilter: BiquadFilterNode;
  reverbConvolver: ConvolverNode;
}

class BeastyAudioEngine {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private fx: FxGraph | null = null;
  private initPromise: Promise<boolean> | null = null;
  private currentParams: ParamState = getDefaultParams();
  private filterEnv = 0;
  private ampEnv = 0;
  private lfo1 = 0;
  private lfo2 = 0;
  private activeVoices = 0;
  private waveBuffer = new Float32Array(256);
  private specBuffer = new Uint8Array(128);
  private previewPhase = 0;
  private lastPreviewTime = performance.now();
  private lastSatDrive = -1;
  private lastSatMode = -1;
  private lastFltDrv = -1;
  private lastFltType = -1;
  private lastRevSize = -1;
  private revSizePending = 0.55;
  private revTimer: number | null = null;
  private roarTimer: number | null = null;

  private buildFxGraph(ctx: AudioContext, source: AudioNode, dest: AudioNode): FxGraph {
    // 1. Analog Tape/Tube/Fuzz Saturation Stage
    const satIn = ctx.createGain();
    const satDry = ctx.createGain();
    const satWet = ctx.createGain();
    const satShaper = ctx.createWaveShaper();
    satShaper.curve = makeSaturationCurve(0.42, 0);
    satShaper.oversample = '2x';
    const satTone = ctx.createBiquadFilter();
    satTone.type = 'lowpass';
    satTone.frequency.value = 6500;
    const satOut = ctx.createGain();

    source.connect(satIn);
    satIn.connect(satDry);
    satDry.connect(satOut);
    satIn.connect(satShaper);
    satShaper.connect(satTone);
    satTone.connect(satWet);
    satWet.connect(satOut);

    // 2. Classic Synth Filter FX Stage (HP + Classic Model + LP)
    const fltDry = ctx.createGain();
    const fltWet = ctx.createGain();
    const fltOut = ctx.createGain();
    const fltShaper = ctx.createWaveShaper();
    fltShaper.curve = makeSaturationCurve(0.25, 0);
    const fltHp = ctx.createBiquadFilter();
    fltHp.type = 'highpass';
    fltHp.frequency.value = 28;
    fltHp.Q.value = 0.7;
    const fltStage1 = ctx.createBiquadFilter();
    fltStage1.type = 'lowpass';
    fltStage1.frequency.value = 2600;
    const fltStage2 = ctx.createBiquadFilter();
    fltStage2.type = 'lowpass';
    fltStage2.frequency.value = 2600;
    const fltLp = ctx.createBiquadFilter();
    fltLp.type = 'lowpass';
    fltLp.frequency.value = 14000;
    fltLp.Q.value = 0.7;

    satOut.connect(fltDry);
    fltDry.connect(fltOut);
    satOut.connect(fltShaper);
    fltShaper.connect(fltHp);
    fltHp.connect(fltStage1);
    fltStage1.connect(fltStage2);
    fltStage2.connect(fltLp);
    fltLp.connect(fltWet);
    fltWet.connect(fltOut);

    // 3. 4-Stage Allpass Phaser
    const phaserDry = ctx.createGain();
    const phaserWet = ctx.createGain();
    const phaserOut = ctx.createGain();
    const apFilters = Array.from({ length: 4 }, () => {
      const f = ctx.createBiquadFilter();
      f.type = 'allpass';
      f.frequency.value = 900;
      f.Q.value = 1.1;
      return f;
    });
    const phaserLfo = ctx.createOscillator();
    phaserLfo.type = 'sine';
    phaserLfo.frequency.value = 0.65;
    const phaserLfoGain = ctx.createGain();
    phaserLfoGain.gain.value = 650;
    phaserLfo.connect(phaserLfoGain);
    for (const f of apFilters) phaserLfoGain.connect(f.frequency);
    phaserLfo.start();

    fltOut.connect(phaserDry);
    phaserDry.connect(phaserOut);
    fltOut.connect(apFilters[0]);
    apFilters[0].connect(apFilters[1]);
    apFilters[1].connect(apFilters[2]);
    apFilters[2].connect(apFilters[3]);
    apFilters[3].connect(phaserWet);
    phaserWet.connect(phaserOut);

    // 4. Modulated Short-Delay Flanger
    const flangerDry = ctx.createGain();
    const flangerWet = ctx.createGain();
    const flangerOut = ctx.createGain();
    const flangerDelay = ctx.createDelay(0.05);
    flangerDelay.delayTime.value = 0.004;
    const flangerFb = ctx.createGain();
    flangerFb.gain.value = 0.42;
    const flangerLfo = ctx.createOscillator();
    flangerLfo.type = 'sine';
    flangerLfo.frequency.value = 0.35;
    const flangerLfoGain = ctx.createGain();
    flangerLfoGain.gain.value = 0.0022;
    flangerLfo.connect(flangerLfoGain);
    flangerLfoGain.connect(flangerDelay.delayTime);
    flangerLfo.start();

    phaserOut.connect(flangerDry);
    flangerDry.connect(flangerOut);
    phaserOut.connect(flangerDelay);
    flangerDelay.connect(flangerFb);
    flangerFb.connect(flangerDelay);
    flangerDelay.connect(flangerWet);
    flangerWet.connect(flangerOut);

    // 5. Warm Feedback Tape Delay
    const delayDry = ctx.createGain();
    const delayWet = ctx.createGain();
    const delayOut = ctx.createGain();
    const delayNode = ctx.createDelay(1.2);
    delayNode.delayTime.value = 0.34;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.44;
    const delayDamp = ctx.createBiquadFilter();
    delayDamp.type = 'lowpass';
    delayDamp.frequency.value = 3200;

    flangerOut.connect(delayDry);
    delayDry.connect(delayOut);
    flangerOut.connect(delayNode);
    delayNode.connect(delayDamp);
    delayDamp.connect(delayFb);
    delayFb.connect(delayNode);
    delayDamp.connect(delayWet);
    delayWet.connect(delayOut);

    // 6. Lush Forest Hall Reverb
    const reverbDry = ctx.createGain();
    const reverbWet = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = makeReverbImpulse(ctx, 2.8, 2.2);
    const reverbFilter = ctx.createBiquadFilter();
    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 4600;

    delayOut.connect(reverbDry);
    reverbDry.connect(dest);
    delayOut.connect(convolver);
    convolver.connect(reverbFilter);
    reverbFilter.connect(reverbWet);
    reverbWet.connect(dest);

    return {
      satDry, satWet, satShaper, satTone,
      fltDry, fltWet, fltShaper, fltHp, fltLp, fltStage1, fltStage2,
      phaserDry, phaserWet, phaserLfo, phaserLfoGain, apFilters,
      flangerDry, flangerWet, flangerLfo, flangerLfoGain, flangerFb,
      delayDry, delayWet, delayNode, delayFb, delayDamp,
      reverbDry, reverbWet, reverbFilter, reverbConvolver: convolver,
    };
  }

  private applyFxParams(p: ParamState, onlyModulated = false): void {
    if (!this.ctx || !this.fx) return;
    const t = this.ctx.currentTime;
    const f = this.fx;

    // Evaluate FX Mod Matrix modulation contributions
    let fxCutOctMod = 0;
    let fxPhaserMod = 0;
    let fxDelayMod = 0;
    const modSlots: [number, number, number][] = [
      [Math.round(p.MOD1_SRC ?? 0), Math.round(p.MOD1_DST ?? 0), p.MOD1_AMT ?? 0],
      [Math.round(p.MOD2_SRC ?? 0), Math.round(p.MOD2_DST ?? 0), p.MOD2_AMT ?? 0],
      [Math.round(p.MOD3_SRC ?? 0), Math.round(p.MOD3_DST ?? 0), p.MOD3_AMT ?? 0],
      [Math.round(p.MOD4_SRC ?? 0), Math.round(p.MOD4_DST ?? 0), p.MOD4_AMT ?? 0],
      [Math.round(p.MOD5_SRC ?? 0), Math.round(p.MOD5_DST ?? 0), p.MOD5_AMT ?? 0],
      [Math.round(p.MOD6_SRC ?? 0), Math.round(p.MOD6_DST ?? 0), p.MOD6_AMT ?? 0],
    ];
    for (const [src, dst, amt] of modSlots) {
      if (src === 0 || dst < 8 || Math.abs(amt) < 1e-4) continue;
      let sv = 0;
      if (src === 1) sv = this.lfo1;
      else if (src === 2) sv = this.lfo2;
      else if (src === 3) sv = this.filterEnv;
      else if (src === 4) sv = this.ampEnv;
      else if (src === 5 || src === 7) sv = 0.5;
      if (dst === 8) fxCutOctMod += sv * amt * 3.0;
      else if (dst === 9) fxPhaserMod += sv * amt * 0.6;
      else if (dst === 10) fxDelayMod += sv * amt * 0.45;
    }

    if (onlyModulated && fxCutOctMod === 0 && fxPhaserMod === 0 && fxDelayMod === 0) {
      return;
    }

    // 1. Saturation (cache curve allocations to eliminate GC churn and audio clicks)
    const satOn = (p.FX_SAT_ON ?? 0) >= 0.5;
    const satMix = satOn ? (p.FX_SAT_MIX ?? 0.85) : 0;
    const satDrive = p.FX_SAT_DRIVE ?? 0.42;
    const satMode = Math.round(p.FX_SAT_MODE ?? 0);
    if (!onlyModulated) {
      if (Math.abs(satDrive - this.lastSatDrive) > 1e-4 || satMode !== this.lastSatMode) {
        this.lastSatDrive = satDrive;
        this.lastSatMode = satMode;
        f.satShaper.curve = makeSaturationCurve(satDrive, satMode);
      }
      f.satTone.frequency.setTargetAtTime(1200 + (p.FX_SAT_TONE ?? 0.65) * 14000, t, 0.02);
      f.satDry.gain.setTargetAtTime(1 - satMix * 0.78, t, 0.02);
      f.satWet.gain.setTargetAtTime(satMix * 0.9, t, 0.02);
    }

    // 2. Classic Synth Filter FX (LP + HP + Classic Model)
    const fltOn = (p.FX_FILTER_ON ?? 0) >= 0.5;
    const fltMix = fltOn ? (p.FX_FILTER_MIX ?? 1.0) : 0;
    const fltType = Math.round(p.FX_FILTER_TYPE ?? 0);
    const fltCut = Math.min(18000, Math.max(40, (p.FX_FILTER_CUTOFF ?? 2600) * Math.pow(2, fxCutOctMod)));
    const fltLp = Math.min(18000, Math.max(60, (p.FX_FILTER_LP ?? 14000) * Math.pow(2, fxCutOctMod)));
    const fltHp = Math.min(8000, Math.max(20, p.FX_FILTER_HP ?? 28));
    const fltRes = Math.min(1, Math.max(0, p.FX_FILTER_RES ?? 0.36));
    const fltDrv = Math.min(1, Math.max(0, p.FX_FILTER_DRIVE ?? 0.25));

    if (!onlyModulated) {
      if (Math.abs(fltDrv - this.lastFltDrv) > 1e-4 || fltType !== this.lastFltType) {
        this.lastFltDrv = fltDrv;
        this.lastFltType = fltType;
        f.fltShaper.curve = makeSaturationCurve(fltDrv * 0.7, fltType === 3 ? 2 : 0);
      }
      f.fltHp.frequency.setTargetAtTime(fltHp, t, 0.015);
      f.fltHp.Q.setTargetAtTime(0.7 + fltRes * 2.5, t, 0.015);
    }
    f.fltLp.frequency.setTargetAtTime(fltLp, t, 0.015);
    if (!onlyModulated) {
      f.fltLp.Q.setTargetAtTime(0.7 + fltRes * 2.5, t, 0.015);
    }

    if (fltType === 0) {
      // Beasty 24dB Ladder (Dual 12dB LP)
      f.fltStage1.type = 'lowpass';
      f.fltStage2.type = 'lowpass';
      f.fltStage1.frequency.setTargetAtTime(fltCut, t, 0.015);
      f.fltStage2.frequency.setTargetAtTime(fltCut, t, 0.015);
      f.fltStage1.Q.setTargetAtTime(0.7 + fltRes * 7.5, t, 0.015);
      f.fltStage2.Q.setTargetAtTime(0.7 + fltRes * 5.5, t, 0.015);
    } else if (fltType === 1) {
      // TB-303 Acid Diode 18dB punch
      f.fltStage1.type = 'lowpass';
      f.fltStage2.type = 'peaking';
      f.fltStage1.frequency.setTargetAtTime(fltCut, t, 0.015);
      f.fltStage2.frequency.setTargetAtTime(fltCut * 1.04, t, 0.015);
      f.fltStage1.Q.setTargetAtTime(1.1 + fltRes * 11.5, t, 0.015);
      f.fltStage2.Q.setTargetAtTime(3.2, t, 0.015);
      f.fltStage2.gain.setTargetAtTime(fltRes * 9.5, t, 0.015);
    } else if (fltType === 2) {
      // SEM 12dB smooth State Variable
      f.fltStage1.type = 'lowpass';
      f.fltStage2.type = 'allpass';
      f.fltStage1.frequency.setTargetAtTime(fltCut, t, 0.015);
      f.fltStage2.frequency.setTargetAtTime(fltCut * 0.8, t, 0.015);
      f.fltStage1.Q.setTargetAtTime(0.6 + fltRes * 9.0, t, 0.015);
      f.fltStage2.Q.setTargetAtTime(0.8 + fltRes * 2.5, t, 0.015);
    } else if (fltType === 3) {
      // MS-20 Dual HPF + Screaming LPF
      f.fltStage1.type = 'highpass';
      f.fltStage2.type = 'lowpass';
      f.fltStage1.frequency.setTargetAtTime(Math.max(40, fltCut * 0.22), t, 0.015);
      f.fltStage2.frequency.setTargetAtTime(fltCut, t, 0.015);
      f.fltStage1.Q.setTargetAtTime(0.9 + fltRes * 5.0, t, 0.015);
      f.fltStage2.Q.setTargetAtTime(1.2 + fltRes * 13.0, t, 0.015);
    } else {
      // Juno Chorus-style Resonant Highpass
      f.fltStage1.type = 'highpass';
      f.fltStage2.type = 'highpass';
      f.fltStage1.frequency.setTargetAtTime(fltCut, t, 0.015);
      f.fltStage2.frequency.setTargetAtTime(fltCut * 0.9, t, 0.015);
      f.fltStage1.Q.setTargetAtTime(0.7 + fltRes * 6.5, t, 0.015);
      f.fltStage2.Q.setTargetAtTime(0.7, t, 0.015);
    }

    f.fltDry.gain.setTargetAtTime(1 - fltMix, t, 0.018);
    f.fltWet.gain.setTargetAtTime(fltMix, t, 0.018);

    // 3. Phaser
    const phaserOn = (p.FX_PHASER_ON ?? 0) >= 0.5;
    const phaserMix = phaserOn ? (p.FX_PHASER_MIX ?? 0.45) : 0;
    const phaserDepth = Math.min(1, Math.max(0, (p.FX_PHASER_DEPTH ?? 0.7) + fxPhaserMod));
    f.phaserLfo.frequency.setTargetAtTime(p.FX_PHASER_RATE ?? 0.65, t, 0.02);
    f.phaserLfoGain.gain.setTargetAtTime(180 + phaserDepth * 950, t, 0.02);
    for (const ap of f.apFilters) ap.Q.setTargetAtTime(0.6 + (p.FX_PHASER_FB ?? 0.35) * 4.2, t, 0.02);
    f.phaserDry.gain.setTargetAtTime(1 - phaserMix * 0.45, t, 0.02);
    f.phaserWet.gain.setTargetAtTime(phaserMix * 0.75, t, 0.02);

    // 4. Flanger
    const flangerOn = (p.FX_FLANGER_ON ?? 0) >= 0.5;
    const flangerMix = flangerOn ? (p.FX_FLANGER_MIX ?? 0.42) : 0;
    f.flangerLfo.frequency.setTargetAtTime(p.FX_FLANGER_RATE ?? 0.35, t, 0.02);
    f.flangerLfoGain.gain.setTargetAtTime(0.0004 + (p.FX_FLANGER_DEPTH ?? 0.5) * 0.003, t, 0.02);
    f.flangerFb.gain.setTargetAtTime(p.FX_FLANGER_FB ?? 0.42, t, 0.02);
    f.flangerDry.gain.setTargetAtTime(1 - flangerMix * 0.4, t, 0.02);
    f.flangerWet.gain.setTargetAtTime(flangerMix * 0.72, t, 0.02);

    // 5. Delay
    const delayOn = (p.FX_DELAY_ON ?? 0) >= 0.5;
    const delayMix = delayOn ? Math.min(1, Math.max(0, (p.FX_DELAY_MIX ?? 0.28) + fxDelayMod)) : 0;
    f.delayNode.delayTime.setTargetAtTime(p.FX_DELAY_TIME ?? 0.34, t, 0.03);
    f.delayFb.gain.setTargetAtTime(p.FX_DELAY_FEEDBACK ?? 0.44, t, 0.02);
    f.delayDamp.frequency.setTargetAtTime(800 + (p.FX_DELAY_TONE ?? 0.62) * 9000, t, 0.02);
    f.delayDry.gain.setTargetAtTime(1, t, 0.02);
    f.delayWet.gain.setTargetAtTime(delayMix * 0.76, t, 0.02);

    // 6. Reverb
    const revOn = (p.FX_REVERB_ON ?? 0) >= 0.5;
    const revMix = revOn ? (p.FX_REVERB_MIX ?? 0.3) : 0;
    const revSize = Math.min(1, Math.max(0.1, p.FX_REVERB_SIZE ?? 0.55));
    const dampHz = 1200 + (1 - (p.FX_REVERB_DAMP ?? 0.55) * 0.65) * revSize * 9000;
    f.reverbFilter.frequency.setTargetAtTime(dampHz, t, 0.03);
    f.reverbDry.gain.setTargetAtTime(1 - revMix * 0.22, t, 0.02);
    f.reverbWet.gain.setTargetAtTime(revMix * 0.85, t, 0.02);

    // Rebuild the impulse when Size moves so the control actually changes the decay
    // (it used to be baked once at start-up, leaving Size audibly inert).
    if (Math.abs(revSize - this.lastRevSize) > 0.02) {
      this.lastRevSize = revSize;
      this.scheduleReverbRebuild(revSize);
    }
  }

  /** Debounced IR rebuild: Size sets the tail length, Damp sets the absorption slope. */
  private scheduleReverbRebuild(sizeNorm: number): void {
    if (!this.fx) return;
    if (this.revTimer !== null) window.clearTimeout(this.revTimer);
    this.revSizePending = sizeNorm;
    this.revTimer = window.setTimeout(() => {
      this.revTimer = null;
      if (!this.ctx || !this.fx) return;
      const size = this.revSizePending;
      const seconds = 0.9 + size * 5.1;          // 0.9 s .. 6.0 s tail
      const decay = 2.6 - size * 1.2;            // larger rooms decay more slowly
      this.fx.reverbConvolver.buffer = makeReverbImpulse(this.ctx, seconds, decay);
    }, 90);
  }

  async ensureStarted(): Promise<boolean> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return true;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx({ latencyHint: 'interactive' });
        const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        const node = new AudioWorkletNode(ctx, 'beasty-synth-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.74;

        this.fx = this.buildFxGraph(ctx, node, analyser);
        analyser.connect(ctx.destination);

        node.port.onmessage = (e) => {
          if (e.data?.type === 'telemetry') {
            this.filterEnv = e.data.fenv ?? 0;
            this.ampEnv = e.data.aenv ?? 0;
            this.lfo1 = e.data.lfo1 ?? 0;
            this.lfo2 = e.data.lfo2 ?? 0;
            this.activeVoices = e.data.voices ?? 0;
            if (this.activeVoices > 0) {
              this.applyFxParams(this.currentParams, true);
            }
          }
        };

        this.ctx = ctx;
        this.node = node;
        this.analyser = analyser;
        this.waveBuffer = new Float32Array(analyser.fftSize);
        this.specBuffer = new Uint8Array(analyser.frequencyBinCount);

        node.port.postMessage({ type: 'params', params: this.currentParams });
        this.applyFxParams(this.currentParams);
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        return true;
      } catch (err) {
        console.warn('Beasty AudioWorklet unavailable:', err);
        this.initPromise = null;
        return false;
      }
    })();

    return this.initPromise;
  }

  isRunning(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setParams(params: ParamState): void {
    this.currentParams = params;
    this.node?.port.postMessage({ type: 'params', params });
    this.applyFxParams(params);
  }

  async noteOn(note: number, vel = 0.85): Promise<void> {
    await this.ensureStarted();
    this.node?.port.postMessage({ type: 'noteOn', note, vel });
  }

  noteOff(note: number): void {
    this.node?.port.postMessage({ type: 'noteOff', note });
  }

  setPitchBend(semis: number): void {
    this.node?.port.postMessage({ type: 'bend', semis });
  }

  setSustain(down: boolean): void {
    this.node?.port.postMessage({ type: 'sustain', down });
  }

  allNotesOff(): void {
    this.node?.port.postMessage({ type: 'allOff' });
  }

  async triggerRoar(): Promise<void> {
    await this.ensureStarted();
    const root = 36;
    if (this.roarTimer !== null) {
      window.clearTimeout(this.roarTimer);
      this.roarTimer = null;
    }
    this.noteOn(root, 0.95);
    this.noteOn(root + 7, 0.8);
    this.roarTimer = window.setTimeout(() => {
      this.roarTimer = null;
      this.noteOff(root);
      this.noteOff(root + 7);
    }, 520);
  }

  getTelemetry(): SynthTelemetry {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastPreviewTime) / 1000);
    this.lastPreviewTime = now;

    if (this.analyser && this.ctx?.state === 'running' && this.activeVoices > 0) {
      this.analyser.getFloatTimeDomainData(this.waveBuffer);
      this.analyser.getByteFrequencyData(this.specBuffer);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < this.waveBuffer.length; i++) {
        const s = this.waveBuffer[i];
        sum += s * s;
        const a = Math.abs(s);
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / this.waveBuffer.length);
      return {
        rms,
        peak,
        filterEnv: this.filterEnv,
        ampEnv: this.ampEnv,
        lfo1: this.lfo1,
        lfo2: this.lfo2,
        activeVoices: this.activeVoices,
        waveform: this.waveBuffer,
        spectrum: this.specBuffer,
      };
    }

    this.previewPhase += dt * 1.8;
    const p = this.currentParams;
    const len = this.waveBuffer.length;
    const cutoffNorm = Math.log10(Math.max(20, p.FILTER_CUTOFF) / 20) / 3;
    const harmonics = Math.max(1, Math.round(1 + cutoffNorm * 12));
    const waves = [Math.round(p.OSC1_WAVE), Math.round(p.OSC2_WAVE), Math.round(p.OSC3_WAVE)];
    const levels = [p.MIX_OSC1, p.MIX_OSC2, p.MIX_OSC3];
    const octScale = [
      Math.pow(2, Math.round(p.OSC1_RANGE) - 2),
      Math.pow(2, Math.round(p.OSC2_RANGE) - 2),
      Math.pow(2, Math.round(p.OSC3_RANGE) - 2),
    ];

    const satBoost = (p.FX_SAT_ON ?? 0) >= 0.5 ? (p.FX_SAT_DRIVE ?? 0.4) * 0.9 : 0;

    for (let i = 0; i < len; i++) {
      const t = (i / len) * 2 + this.previewPhase * 0.25;
      let sample = 0;
      for (let o = 0; o < 3; o++) {
        const ph = (t * octScale[o] + o * 0.13) % 1;
        const w = waves[o];
        let v = 0;
        if (w === 0) {
          v = ph < 0.5 ? -1 + 4 * ph : 3 - 4 * ph;
        } else if (w === 1) {
          for (let h = 1; h <= harmonics; h++) {
            v += (Math.sin(ph * Math.PI * 2 * h) / h) * (1 - (h / (harmonics + 1)) * 0.45);
          }
          v *= 0.65;
        } else if (w === 2) {
          for (let h = 1; h <= harmonics; h += 2) {
            v += Math.sin(ph * Math.PI * 2 * h) / h;
          }
          v *= 0.9;
        } else {
          v = ph < 0.25 ? 0.85 : -0.85;
        }
        sample += v * levels[o] * 0.22;
      }
      if (p.FILTER_RES > 0.15) {
        sample += Math.sin(t * Math.PI * 2 * (3 + harmonics * 0.5)) * p.FILTER_RES * 0.12;
      }
      sample = Math.tanh(sample * (1 + p.FILTER_DRIVE * 1.8 + satBoost));
      this.waveBuffer[i] = sample * 0.55;
    }

    const sLen = this.specBuffer.length;
    for (let b = 0; b < sLen; b++) {
      const normF = b / Math.max(1, sLen - 1);
      const hz = 20 * Math.pow(1000, normF);
      const ratio = hz / Math.max(20, p.FILTER_CUTOFF);
      const lp = 1 / Math.sqrt(Math.pow(1 + ratio * ratio, 2));
      const bump =
        p.FILTER_RES > 0.04
          ? p.FILTER_RES * 0.65 * Math.exp(-Math.pow((Math.log2(Math.max(0.05, ratio)) + 0.03) * 3.8, 2))
          : 0;
      const harmonicRipple = 0.72 + 0.28 * Math.sin(b * 0.85 + this.previewPhase * 1.4);
      const noiseTail = p.MIX_NOISE * 48 * lp;
      const mag = Math.min(245, Math.max(4, (lp * 135 + bump * 150) * harmonicRipple + noiseTail));
      this.specBuffer[b] = Math.round(mag);
    }

    const previewLfo1 = Math.sin(now * 0.001 * (p.LFO1_RATE ?? 2.2) * Math.PI * 2);
    const previewLfo2 = Math.sin(now * 0.001 * (p.LFO2_RATE ?? 0.45) * Math.PI * 2);

    return {
      rms: 0.04,
      peak: 0.08,
      filterEnv: 0,
      ampEnv: 0,
      lfo1: previewLfo1,
      lfo2: previewLfo2,
      activeVoices: 0,
      waveform: this.waveBuffer,
      spectrum: this.specBuffer,
    };
  }
}

export const audioEngine = new BeastyAudioEngine();
