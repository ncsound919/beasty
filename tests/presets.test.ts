import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PARAM_IDS,
  MOD_MATRIX_PRESETS,
  PARAM_SPECS,
  getDefaultParams,
  normToValue,
  valueToNorm,
  type ParamID,
} from '../src/synth/paramDefs';
import { FACTORY_PRESETS, QUICK_START_PRESETS } from '../src/synth/presets200';

test('factory bank ships 200 patches with 8 quick starts', () => {
  assert.equal(FACTORY_PRESETS.length, 200);
  assert.equal(QUICK_START_PRESETS.length, 8);
});

test('every factory patch has a unique id and name', () => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const preset of FACTORY_PRESETS) {
    assert.ok(!ids.has(preset.id), `duplicate preset id: ${preset.id}`);
    assert.ok(!names.has(preset.name), `duplicate preset name: ${preset.name}`);
    ids.add(preset.id);
    names.add(preset.name);
  }
});

test('every factory patch sets a number for every parameter', () => {
  for (const preset of FACTORY_PRESETS) {
    for (const id of ALL_PARAM_IDS) {
      const value = (preset.params as Record<string, unknown>)[id];
      assert.equal(typeof value, 'number', `${preset.id} is missing ${id}`);
    }
  }
});

test('every factory patch keeps each value inside its parameter range', () => {
  const offenders: string[] = [];
  for (const preset of FACTORY_PRESETS) {
    for (const id of ALL_PARAM_IDS) {
      const spec = PARAM_SPECS[id];
      const value = preset.params[id];
      if (value < spec.min - 1e-6 || value > spec.max + 1e-6) {
        offenders.push(`${preset.id}.${id}=${value} not in [${spec.min}, ${spec.max}]`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('discrete parameters only hold whole steps', () => {
  const offenders: string[] = [];
  for (const id of ALL_PARAM_IDS) {
    const spec = PARAM_SPECS[id];
    if (spec.step !== 1) continue;
    for (const preset of FACTORY_PRESETS) {
      const value = preset.params[id];
      if (Math.abs(value - Math.round(value)) > 1e-6) {
        offenders.push(`${preset.id}.${id}=${value}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('mod matrix preset patches only touch known, in-range parameters', () => {
  assert.ok(MOD_MATRIX_PRESETS.length > 0);
  for (const mod of MOD_MATRIX_PRESETS) {
    for (const [id, value] of Object.entries(mod.patch)) {
      const spec = PARAM_SPECS[id as ParamID];
      assert.ok(spec, `${mod.id} patches unknown parameter ${id}`);
      assert.equal(typeof value, 'number');
      assert.ok(
        (value as number) >= spec.min - 1e-6 && (value as number) <= spec.max + 1e-6,
        `${mod.id}.${id}=${value} not in [${spec.min}, ${spec.max}]`,
      );
    }
  }
});

test('default patch is inside every parameter range', () => {
  const defaults = getDefaultParams();
  for (const id of ALL_PARAM_IDS) {
    const spec = PARAM_SPECS[id];
    assert.ok(defaults[id] >= spec.min && defaults[id] <= spec.max, `${id} default out of range`);
  }
});

test('normalised conversion round-trips every parameter default', () => {
  const defaults = getDefaultParams();
  for (const id of ALL_PARAM_IDS) {
    const spec = PARAM_SPECS[id];
    const back = normToValue(id, valueToNorm(id, spec.def));
    const tolerance = spec.step === 1 ? 0.51 : Math.max(1e-3, Math.abs(spec.def) * 1e-3);
    assert.ok(
      Math.abs(back - spec.def) <= tolerance,
      `${id}: def ${spec.def} -> ${back} (tolerance ${tolerance})`,
    );
  }
});

test('normalised conversion clamps out-of-range input', () => {
  assert.equal(valueToNorm('FILTER_CUTOFF', -1000), 0);
  assert.equal(valueToNorm('FILTER_CUTOFF', 1e9), 1);
});
