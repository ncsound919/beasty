# Beasty — Analog Beast

Web-first analog synthesizer (three oscillators, ladder filter, dual ADSR, six-slot
mod matrix, six-effect rack, 200 factory presets, animated mascot + 3D scope).
The same patch format ships to the **Modi** VST3 (JUCE) through a mirrored
27-parameter core contract.

## Run

```bash
npm install
npm run dev        # Vite dev server, port 3000
npm run build      # production bundle
npm test           # tsx unit tests (params, presets, automation)
npm run lint       # tsc --noEmit
npm run check:parity   # Beasty <-> Modi shared-parameter contract check
```

## Architecture

| Path | Responsibility |
|---|---|
| `src/synth/audioEngine.ts` | AudioWorklet engine — PolyBLEP osc, 4-pole ladder, envelopes, mod matrix, FX, telemetry |
| `src/synth/paramDefs.ts` | Declarative parameter table (id/label/range/skew/unit/default) + `JUCE_CORE_PARAM_IDS` |
| `src/synth/parameters.ts` | Presets, randomization, localStorage user banks |
| `src/synth/juceBridge.ts` | Host contract: slider events, note/pitch/panic, CC-automation get/set/learn |
| `src/synth/automation.ts` | Defensive CC mapping parser + label formatter |
| `src/components/*` | UI primitives (RotaryKnob, FaderSlider), panels, keyboard, 3D scope |

## Interaction contract

- Knobs/faders: drag (shift = fine), wheel, arrows, Home/End, double-click reset.
- Hosted builds: right-click a knob arms CC learn; mappings flow through
  `automationGet/Set/Learn` and are clamped on parse (`cc -1..127`, range 0..1,
  slew 0..2000 ms).
- All primary controls expose `role="slider"` with ARIA values and keyboard access.
- Reduced motion is respected globally (`prefers-reduced-motion`).

## Cross-synth contract

`JUCE_CORE_PARAM_IDS` (27 IDs) must stay byte-identical to the first 27 entries of
Modi's `ParameterIDs::all[]`. Check with `npm run check:parity`
(`tools/param_parity.py` at the workspace root).
