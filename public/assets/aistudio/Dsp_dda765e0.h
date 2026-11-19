// Dsp.h - JUCE-free synth core (std only) so it can be unit-tested offline.
#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>

namespace ms
{
constexpr int kNumVoices   = 8;
constexpr int kControlRate = 16;               // samples between coefficient updates
constexpr float kPi        = 3.14159265358979f;

enum Wave { Triangle = 0, Saw, Square, Pulse };

struct Params
{
    int   octave[3]   { 0, 0, 0 };             // -2..+2  (32' .. 2')
    int   wave[3]     { Saw, Saw, Square };
    float fineCents[3]{ 0.f, 0.f, 0.f };
    float level[3]    { 0.8f, 0.6f, 0.5f };
    float noise       = 0.f;

    float cutoffHz = 1800.f, resonance = 0.25f, drive = 0.3f, envAmount = 0.5f, keyTrack = 0.5f;
    float fA = 0.005f, fD = 0.4f, fS = 0.3f, fR = 0.3f;     // filter envelope (seconds / level)
    float aA = 0.005f, aD = 0.3f, aS = 0.8f, aR = 0.25f;    // amp envelope
    float drift = 0.3f, master = 0.7f;
    float bendSemis = 0.f;
};

//==============================================================================
struct Rng
{
    uint32_t s = 0x9E3779B9u;
    void seed (uint32_t v) { s = v ? v : 1u; }
    float next01() { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (float) (s >> 8) * (1.0f / 16777216.0f); }
    float nextBi() { return next01() * 2.f - 1.f; }
};

// Slow random walk; output in about [-1, 1]
struct Drift
{
    float v = 0, target = 0, coef = 0; int count = 0, period = 1;
    void prepare (float fs, float seconds, Rng& r)
    {
        period = std::max (1, (int) (fs * seconds / kControlRate));
        coef   = 1.f - std::exp (-1.f / (0.5f * (float) period));
        v = target = r.nextBi(); count = 0;
    }
    float tick (Rng& r)                       // call once per control block
    {
        if (--count <= 0) { target = r.nextBi(); count = period; }
        v += (target - v) * coef;
        return v;
    }
};

//==============================================================================
inline float polyBlep (float t, float dt)
{
    if (t < dt)         { t /= dt;            return t + t - t * t - 1.f; }
    if (t > 1.f - dt)   { t = (t - 1.f) / dt; return t * t + t + t + 1.f; }
    return 0.f;
}

struct Osc
{
    float phase = 0.f, tri = 0.f;

    void reset (float startPhase)
    {
        phase = startPhase;
        tri = phase < 0.5f ? -1.f + 4.f * phase : 3.f - 4.f * phase;   // matches integrated square
    }

    static float wrap (float p) { return p - std::floor (p); }

    float next (float dt, int wave, bool bandLimited = true)
    {
        float out = 0.f;
        const float t = phase;
        switch (wave)
        {
            case Saw:
                out = 2.f * t - 1.f;
                if (bandLimited) out -= polyBlep (t, dt);
                break;
            case Square:
            case Triangle:
            {
                float sq = t < 0.5f ? 1.f : -1.f;
                if (bandLimited) sq += polyBlep (t, dt) - polyBlep (wrap (t + 0.5f), dt);
                if (wave == Square) { out = sq; break; }
                tri = tri * 0.9999f + 4.f * dt * sq;                    // leaky integrator
                out = tri;
                break;
            }
            case Pulse:
            {
                constexpr float w = 0.25f;
                out = t < w ? 1.f : -1.f;
                if (bandLimited) out += polyBlep (t, dt) - polyBlep (wrap (t + 1.f - w), dt);
                out -= (2.f * w - 1.f);                                 // remove DC
                out *= (2.f / 3.f);                                     // peak back to +/-1
                break;
            }
        }
        phase += dt;
        if (phase >= 1.f) phase -= 1.f;
        return out;
    }
};

//==============================================================================
// 4-pole transistor-ladder style filter (Huovilainen-flavoured), tanh per stage,
// internally 2x oversampled with linear-interpolated input and averaged output.
struct Ladder
{
    float s[4] {}, t[4] {}, prevIn = 0.f, g = 0.1f, k = 0.f, drv = 1.f, makeup = 1.f;

    void reset() { for (int i = 0; i < 4; ++i) s[i] = t[i] = 0.f; prevIn = 0.f; }

    void set (float cutoffHz, float res, float drive, float fs)
    {
        const float fc = std::min (cutoffHz, 0.45f * fs);
        g   = 1.f - std::exp (-2.f * kPi * fc / (2.f * fs));
        k   = 4.3f * std::clamp (res, 0.f, 1.f);          // >4 so max resonance self-oscillates (tanh bounds it)
        drv = 1.f + 5.f * std::clamp (drive, 0.f, 1.f);
        makeup = (1.f + 0.6f * k) / std::sqrt (drv);           // partial bass-loss compensation
    }

    float process (float x)
    {
        float acc = 0.f;
        for (int i = 0; i < 2; ++i)
        {
            const float u = i == 0 ? 0.5f * (prevIn + x) : x;
            const float x0 = std::tanh (drv * u - k * s[3]);
            s[0] += g * (x0   - t[0]); t[0] = std::tanh (s[0]);
            s[1] += g * (t[0] - t[1]); t[1] = std::tanh (s[1]);
            s[2] += g * (t[1] - t[2]); t[2] = std::tanh (s[2]);
            s[3] += g * (t[2] - t[3]); t[3] = std::tanh (s[3]);
            acc += s[3];
        }
        prevIn = x;
        return 0.5f * acc * makeup;
    }
};

//==============================================================================
struct EnvCoefs { float atk = 0.9f, dec = 0.9f, rel = 0.9f, sus = 0.f; };

inline EnvCoefs makeEnv (float a, float d, float s, float r, float fs)
{
    auto sec = [] (float x) { return std::max (x, 0.001f); };
    EnvCoefs c;
    c.atk = std::exp (-1.79f / (sec (a) * fs));
    c.dec = std::exp (-3.0f  / (sec (d) * fs));
    c.rel = std::exp (-3.0f  / (sec (r) * fs));
    c.sus = std::clamp (s, 0.f, 1.f);
    return c;
}

struct Env
{
    enum Stage { Idle, Attack, Decay, Sustain, Release };
    Stage stage = Idle; float lvl = 0.f;

    void gateOn()  { stage = Attack; }
    void gateOff() { if (stage != Idle) stage = Release; }
    bool idle() const { return stage == Idle; }

    float tick (const EnvCoefs& c, float atkCoef)
    {
        switch (stage)
        {
            case Idle:    lvl = 0.f; break;
            case Attack:  lvl += (1.2f - lvl) * (1.f - atkCoef); if (lvl >= 1.f) { lvl = 1.f; stage = Decay; } break;
            case Decay:   lvl = c.sus + (lvl - c.sus) * c.dec;   if (lvl - c.sus < 1e-4f) { lvl = c.sus; stage = Sustain; } break;
            case Sustain: lvl = c.sus; break;
            case Release: lvl *= c.rel; if (lvl < 1e-4f) { lvl = 0.f; stage = Idle; } break;
        }
        return lvl;
    }
};

//==============================================================================
struct Voice
{
    bool active = false, gate = false, held = false;
    int note = 60; float vel = 1.f; uint64_t age = 0;
    Osc osc[3]; Drift pitchDrift[3], cutDrift; Env fenv, aenv; Ladder lad; Rng rng;
    float staticCents[3] {}, staticCut = 0.f, atkScale = 1.f, fAtk = 0.9f, aAtk = 0.9f, panL = 1.f, panR = 1.f;
    float dt[3] {}, fenvVal = 0.f;

    void start (int n, float v, uint64_t a, const Params& p, const EnvCoefs& fc, const EnvCoefs& ac, float fs, uint32_t seed)
    {
        rng.seed (seed);
        active = true; gate = true; held = false; note = n; vel = v; age = a;
        for (int i = 0; i < 3; ++i)
        {
            osc[i].reset (rng.next01());
            pitchDrift[i].prepare (fs, 0.6f + 0.8f * rng.next01(), rng);
            staticCents[i] = rng.nextBi() * (1.f + 5.f * p.drift);
        }
        cutDrift.prepare (fs, 1.2f, rng);
        staticCut = rng.nextBi() * (3.f + 25.f * p.drift);
        atkScale  = 1.f + rng.nextBi() * 0.25f * p.drift;               // +/-25% attack variance at full drift
        fAtk = std::exp (std::log (fc.atk) / atkScale);
        aAtk = std::exp (std::log (ac.atk) / atkScale);
        const float pan = rng.nextBi() * 0.6f * p.drift;                // voice spread widens with drift
        panL = std::cos ((pan * 0.5f + 0.5f) * kPi * 0.5f) * 1.414f;
        panR = std::sin ((pan * 0.5f + 0.5f) * kPi * 0.5f) * 1.414f;
        fenv = {}; aenv = {}; fenvVal = 0.f; fenv.gateOn(); aenv.gateOn(); lad.reset();
    }

    void release() { gate = false; held = false; fenv.gateOff(); aenv.gateOff(); }
};

//==============================================================================
class Engine
{
public:
    void prepare (double sampleRate)
    {
        fs = (float) sampleRate;
        for (auto& v : voices) v = {};
        setParams (params);
    }

    void setParams (const Params& p)
    {
        params = p;
        fcoef = makeEnv (p.fA, p.fD, p.fS, p.fR, fs);
        acoef = makeEnv (p.aA, p.aD, p.aS, p.aR, fs);
    }

    void noteOn (int note, float vel)
    {
        Voice* v = nullptr;
        for (auto& c : voices) if (! c.active) { v = &c; break; }
        if (! v)   // steal: oldest releasing voice, else oldest
        {
            for (auto& c : voices) if (! c.gate && (! v || c.age < v->age)) v = &c;
            if (! v) { v = &voices[0]; for (auto& c : voices) if (c.age < v->age) v = &c; }
        }
        seedGen = seedGen * 1664525u + 1013904223u;
        v->start (note, vel, ++counter, params, fcoef, acoef, fs, seedGen);
    }

    void noteOff (int note)
    {
        for (auto& v : voices)
            if (v.active && v.gate && v.note == note)
            {
                if (sustainDown) { v.held = true; v.gate = false; }
                else v.release();
            }
    }

    void setSustain (bool down)
    {
        sustainDown = down;
        if (! down) for (auto& v : voices) if (v.active && v.held) v.release();
    }

    void allNotesOff() { for (auto& v : voices) if (v.active) v.release(); sustainDown = false; }

    int activeVoices() const { int n = 0; for (auto& v : voices) n += v.active ? 1 : 0; return n; }

    void render (float* L, float* R, int n)
    {
        for (int i = 0; i < n; ++i) { L[i] = 0.f; R[i] = 0.f; }
        for (auto& v : voices)
            if (v.active) renderVoice (v, L, R, n);
        for (int i = 0; i < n; ++i)
        {
            L[i] = std::tanh (L[i] * params.master);
            R[i] = std::tanh (R[i] * params.master);
        }
    }

private:
    void renderVoice (Voice& v, float* L, float* R, int n)
    {
        const Params& p = params;
        for (int pos = 0; pos < n; pos += kControlRate)
        {
            const int len = std::min (kControlRate, n - pos);

            // ---- control-rate updates
            const float pitchCents = (1.5f + 10.f * p.drift);
            for (int o = 0; o < 3; ++o)
            {
                const float semis = (float) (v.note - 69) + p.bendSemis + 12.f * (float) p.octave[o]
                                  + (p.fineCents[o] + v.staticCents[o] + pitchCents * v.pitchDrift[o].tick (v.rng)) * 0.01f;
                v.dt[o] = std::min (440.f * std::exp2 (semis / 12.f) / fs, 0.45f);
            }
            const float cutCents = (5.f + 40.f * p.drift) * v.cutDrift.tick (v.rng) + v.staticCut;
            const float octs = p.envAmount * v.fenvVal * 5.f
                             + p.keyTrack * (float) (v.note - 60) / 12.f + cutCents / 1200.f;
            v.lad.set (std::clamp (p.cutoffHz * std::exp2 (octs), 20.f, 20000.f), p.resonance, p.drive, fs);

            // ---- audio-rate
            for (int i = 0; i < len; ++i)
            {
                float mix = 0.f;
                for (int o = 0; o < 3; ++o) mix += v.osc[o].next (v.dt[o], p.wave[o]) * p.level[o];
                mix += v.rng.nextBi() * p.noise;
                mix *= 0.4f;

                v.fenvVal = v.fenv.tick (fcoef, v.fAtk);
                const float amp = v.aenv.tick (acoef, v.aAtk) * v.vel;
                const float y   = v.lad.process (mix) * amp;
                L[pos + i] += y * v.panL;
                R[pos + i] += y * v.panR;
            }
            if (v.aenv.idle()) { v.active = false; return; }
        }
    }

    float fs = 44100.f;
    Params params;
    EnvCoefs fcoef, acoef;
    std::array<Voice, kNumVoices> voices;
    uint64_t counter = 0; uint32_t seedGen = 12345u; bool sustainDown = false;
};
} // namespace ms
